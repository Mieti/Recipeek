import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftSchema, inputSchema, validateDraft, validatePhotos, type Photo } from '../schema.js';
import { demo } from '../demo.js';
import { isPublicAddress, publicUrl, platformFor, extractWebMaterial, RecipeSelectionRequired, fetchPublicHtml } from '../web.js';
import { acquireSocial, geminiPayload, parseGemini, type Fetcher, type ProviderConfig } from '../providers.js';

test('blocks private IPs, alternative IP notation, credentials and non-HTTPS sources', async () => {
  for (const url of ['http://example.com', 'https://127.0.0.1', 'https://0x7f000001', 'https://2130706433', 'https://[::1]', 'https://[::ffff:127.0.0.1]', 'https://169.254.169.254', 'https://user:pass@example.com', 'https://example.com:444']) assert.throws(() => publicUrl(url), url);
  for (const ip of ['10.0.0.1','172.16.1.1','192.168.0.1','100.64.0.1','fc00::1','fe80::1','::','0.0.0.0']) assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  await assert.rejects(fetchPublicHtml('https://localhost'), /locale/);
});

test('social domains are matched by hostname, never substring', () => {
  assert.equal(platformFor(publicUrl('https://www.instagram.com/reel/abc/')), 'instagram');
  assert.equal(platformFor(publicUrl('https://vm.tiktok.com/abc/')), 'tiktok');
  assert.equal(platformFor(publicUrl('https://instagram.com.attacker.example/reel/abc')), 'web');
});

test('Recipe JSON-LD in @graph wins over unrelated page text', () => {
  const html = `<main>Pubblicità, altra ricetta, ignorare</main><script type="application/ld+json">${JSON.stringify({ '@graph': [{ '@type': 'WebPage', name: 'Page' }, { '@type': ['Thing','Recipe'], name: 'Pasta', recipeIngredient: ['180 g pasta'] }] })}</script>`;
  const material = extractWebMaterial(html, 'https://example.com/recipe');
  assert.match(material.sources[0]!.text, /180 g pasta/);
  assert.doesNotMatch(material.sources[0]!.text, /Pubblicità/);
});

test('multiple recipes require explicit selection rather than mixing ingredients', () => {
  const html = `<script type="application/ld+json">${JSON.stringify([{ '@type': 'Recipe', name: 'Pasta', recipeIngredient: ['pasta'] }, { '@type': 'Recipe', name: 'Torta', recipeIngredient: ['farina'] }])}</script>`;
  assert.throws(() => extractWebMaterial(html, 'https://example.com'), RecipeSelectionRequired);
  const chosen = extractWebMaterial(html, 'https://example.com', 1);
  assert.match(chosen.sources[0]!.text, /Torta/); assert.doesNotMatch(chosen.sources[0]!.text, /pasta/);
  assert.throws(() => extractWebMaterial(html, 'https://example.com', 9));
});

test('fallback ignores scripts/navigation and preserves useful page text', () => {
  const material = extractWebMaterial('<nav>MENU</nav><script>alert("injection")</script><main>Ingredienti: 200 g pasta. Cuocere la pasta in acqua.</main>', 'https://example.com');
  assert.match(material.sources[0]!.text, /200 g pasta/); assert.doesNotMatch(material.sources[0]!.text, /MENU|injection/);
});

test('missing quantities remain null and trigger review; dangling references block saving', () => {
  const { draft, material } = demo();
  assert.equal(draftSchema.parse(draft).ingredients[3]!.quantity, null);
  assert.equal(validateDraft(draft, material.sources).blocking.length, 0);
  draft.ingredients[0]!.quantity = 250;
  draft.steps[0]!.ingredientIds.push('i99');
  const result = validateDraft(draft, material.sources);
  assert.ok(result.warnings.some(w => w.includes('quantità numerica non riscontrata')));
  assert.ok(result.blocking.some(w => w.includes('inesistente')));
});

test('unverified quotes and visual evidence remain visible in review', () => {
  const { draft, material } = demo();
  draft.ingredients[0]!.evidence.quote = '999 g inventati';
  assert.ok(validateDraft(draft, material.sources).warnings.some(w => w.includes('citazione non riscontrata')));
  material.sources[0]!.kind = 'photo';
  assert.ok(validateDraft(draft, material.sources).warnings.some(w => w.includes('foto originale')));
});

test('model cannot claim user provenance; explicit human edits can', () => {
  const { draft, material } = demo();
  draft.ingredients[0]!.evidence = { sourceId: 'user', quote: 'Correzione umana' };
  assert.ok(validateDraft(draft, material.sources).blocking.length > 0);
  assert.equal(validateDraft(draft, material.sources, true).blocking.length, 0);
});

test('photo input rejects spoofed MIME, invalid base64 and unsupported formats', () => {
  assert.throws(() => validatePhotos([{ name: 'x.png', mimeType: 'image/png', data: Buffer.from('<html>not an image</html>').toString('base64') }]));
  assert.throws(() => validatePhotos([{ name: 'x.png', mimeType: 'image/png', data: '@@@@' }]));
  assert.equal(inputSchema.safeParse({ kind: 'photos', photos: [{ name: 'x.heic', mimeType: 'image/heic', data: 'AAAA' }] }).success, false);
  const photo: Photo = { name: 'pixel.png', mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV8sAAAAASUVORK5CYII=' };
  validatePhotos([photo]);
  const { material } = demo(); material.photos = [photo];
  const payload = geminiPayload(material, 'test-model');
  assert.equal(payload.store, false);
  assert.ok(payload.input.some(p => p.type === 'image' && p.data === photo.data));
  assert.equal('tools' in payload, false);
});

test('Gemini contract rejects incomplete output and keeps thought-token costs separate', () => {
  const { draft } = demo();
  const data = { status: 'completed', steps: [{ type: 'thought', content: [{ type: 'text', text: 'ignored' }] }, { type: 'model_output', content: [{ type: 'text', text: JSON.stringify(draft) }] }], usage: { total_input_tokens: 1000, total_output_tokens: 2000, total_thought_tokens: 100 } };
  const result = parseGemini(data, 'gemini-3.5-flash-lite');
  assert.equal(result.draft.title, draft.title);
  assert.equal(result.usage.estimatedAiUsd, (1000 * .3 + 2100 * 2.5) / 1000000);
  assert.equal(parseGemini(data, 'other-model').usage.estimatedAiUsd, null);
  assert.throws(() => parseGemini({ ...data, status: 'incomplete' }, 'test'), /non ha completato/);
});

const settings: ProviderConfig = { geminiKey: 'test', supadataKey: 'test', model: 'test', transcriptMode: 'auto' };
const json = (data: unknown, status = 200, credits: string | null = '1') => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...(credits === null ? {} : { 'x-billable-requests': credits }) } });
function queuedFetch(responses: Response[], urls: string[] = []): Fetcher { return (async (url: string | URL | Request) => { urls.push(String(url)); const next = responses.shift(); assert.ok(next, 'unexpected duplicate request'); return next; }) as Fetcher; }

test('social pipeline preserves caption when transcript is unavailable', async () => {
  const urls: string[] = [];
  const material = await acquireSocial('https://www.instagram.com/reel/abc', settings, queuedFetch([json({ description: 'Pasta: 180 g per 2 persone', media: { duration: 60 } }), json({ error: 'unavailable' }, 206)], urls));
  assert.equal(material.sources.length, 1); assert.equal(material.sources[0]!.kind, 'caption');
  assert.ok(material.warnings.some(w => w.includes('non disponibile')));
  assert.equal(material.credits, 2); assert.equal(urls.length, 2);
});

test('social async transcript is polled without creating duplicate jobs', async () => {
  const urls: string[] = [];
  const material = await acquireSocial('https://www.tiktok.com/@x/video/123', settings, queuedFetch([
    json({ description: 'Ricetta', media: { duration: 60 } }),
    json({ jobId: 'job-1' }, 202, '2'),
    json({ status: 'active' }, 200, '0'),
    json({ status: 'completed', content: [{ text: 'Usa 200 g di pasta.', offset: 1000 }] }, 200, '0'),
  ], urls), async () => {});
  assert.equal(urls.filter(u => u.includes('transcript?')).length, 1);
  assert.match(material.sources[1]!.text, /\[1.0s\] Usa 200 g/);
  assert.equal(material.credits, 3); assert.equal(material.creditsAreEstimate, true);
});

test('unknown duration disables generated transcript; long video skips it', async () => {
  const urls: string[] = [];
  await acquireSocial('https://www.tiktok.com/@x/video/123', settings, queuedFetch([json({ description: 'Ricetta' }), json({ content: [] })], urls));
  assert.match(urls[1]!, /mode=native/);
  const longUrls: string[] = [];
  const material = await acquireSocial('https://www.tiktok.com/@x/video/123', settings, queuedFetch([json({ description: 'Ricetta', media: { duration: 181 } })], longUrls));
  assert.equal(longUrls.length, 1); assert.ok(material.warnings.some(w => w.includes('3 minuti')));
});

test('missing usage is not reported as zero cost and missing social text fails explicitly', async () => {
  const result = await acquireSocial('https://www.tiktok.com/@x/video/123', settings, queuedFetch([json({ description: 'Ricetta' }, 200, null), json({ content: [] })]));
  assert.equal(result.credits, null);
  await assert.rejects(acquireSocial('https://www.tiktok.com/@x/video/123', settings, queuedFetch([json({}), json({ content: [] })])), /Nessun testo acquisito/);
});
