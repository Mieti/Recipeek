import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import * as cheerio from 'cheerio';
import type { Material } from './schema.js';

export function publicUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Usare una URL HTTPS pubblica senza credenziali o porte personalizzate.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || !host.includes('.') && !isIP(host) || host.endsWith('.local')) throw new Error('Indirizzo locale non consentito.');
  if (isIP(host) && !isPublicAddress(host)) throw new Error('Indirizzo di rete non pubblico.');
  url.hash = '';
  return url;
}

export function isPublicAddress(address: string): boolean {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}

export function platformFor(url: URL): 'instagram' | 'tiktok' | 'web' {
  const host = url.hostname.toLowerCase();
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
  return 'web';
}

// Resolve, reject non-public answers, then connect to the selected IP: no second DNS lookup.
export async function fetchPublicHtml(raw: string, redirects = 0): Promise<{ html: string; url: string }> {
  if (redirects > 3) throw new Error('Troppi reindirizzamenti.');
  const url = publicUrl(raw);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await Promise.race([
    lookup(host, { all: true }),
    new Promise<never>((_, reject) => { const t = setTimeout(() => reject(new Error('Timeout DNS.')), 5000); t.unref(); }),
  ]);
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) throw new Error('La destinazione risolve a una rete non pubblica.');
  const address = addresses[0]!;
  const result = await new Promise<{ html: string; redirect?: string }>((resolve, reject) => {
    const req = request({
      hostname: address.address, family: address.family, servername: isIP(host) ? undefined : host,
      port: 443, path: url.pathname + url.search, method: 'GET',
      headers: { host: url.host, 'user-agent': 'RecipeekImportLab/0.1', accept: 'text/html,application/xhtml+xml', 'accept-encoding': 'identity' },
    }, res => {
      if ([301,302,303,307,308].includes(res.statusCode ?? 0)) {
        res.resume();
        if (!res.headers.location) reject(new Error('Reindirizzamento senza destinazione.'));
        else resolve({ html: '', redirect: new URL(res.headers.location, url).href });
        return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`Sito non accessibile (HTTP ${res.statusCode}). Prova con testo o foto.`)); return; }
      if (!/text\/html|application\/xhtml\+xml/i.test(res.headers['content-type'] ?? '')) { res.resume(); reject(new Error('La URL non restituisce una pagina HTML.')); return; }
      if (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') { res.resume(); reject(new Error('Pagina compressa non supportata dal laboratorio.')); return; }
      const chunks: Buffer[] = []; let bytes = 0;
      res.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 2_000_000) req.destroy(new Error('Pagina superiore al limite di 2 MB.'));
        else chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8') }));
    });
    const timer = setTimeout(() => req.destroy(new Error('Timeout del sito.')), 15000);
    req.on('close', () => clearTimeout(timer));
    req.on('error', reject);
    req.end();
  });
  if (result.redirect) return fetchPublicHtml(result.redirect, redirects + 1);
  return { html: result.html, url: url.href };
}

export class RecipeSelectionRequired extends Error {
  constructor(public titles: string[]) { super('Questa pagina contiene più ricette: scegline una.'); }
}

export function extractWebMaterial(html: string, url: string, index?: number): Material {
  const $ = cheerio.load(html);
  const recipes: Record<string, unknown>[] = [];
  let visited = 0;
  function visit(value: unknown, depth = 0) {
    if (++visited > 5000 || depth > 15 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) { for (const v of value) visit(v, depth + 1); return; }
    const obj = value as Record<string, unknown>;
    const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
    if (types.some(t => typeof t === 'string' && /(^|[/#])Recipe$/.test(t))) { recipes.push(obj); return; }
    for (const v of Object.values(obj)) visit(v, depth + 1);
  }
  $('script[type="application/ld+json"]').each((_, el) => { try { visit(JSON.parse($(el).text())); } catch { /* Some pages contain malformed JSON-LD. Fall back to visible text. */ } });
  const unique = [...new Map(recipes.map(r => [JSON.stringify(r), r])).values()];
  if (unique.length > 1 && index === undefined) throw new RecipeSelectionRequired(unique.map((r, i) => typeof r.name === 'string' ? r.name : `Ricetta ${i + 1}`));
  if (index !== undefined && (!Number.isInteger(index) || index < 0 || index >= unique.length)) throw new Error('Selezione ricetta non valida.');
  const selected = unique[index ?? 0];
  let text: string;
  if (selected) {
    text = JSON.stringify(selected, null, 2);
  } else {
    $('script,style,nav,footer,header,noscript,iframe,form').remove();
    const body = $('main').first().length ? $('main').first() : $('article').first().length ? $('article').first() : $('body');
    text = body.text().replace(/\s+/g, ' ').trim();
  }
  if (text.length < 20) throw new Error('Testo insufficiente: usa il testo della ricetta o una foto.');
  return { sources: [{ id: 'web-1', kind: 'web', label: selected ? 'Ricetta strutturata del sito' : 'Testo della pagina', text: text.slice(0, 24000) }], photos: [], warnings: text.length > 24000 ? ['Pagina limitata ai primi 24.000 caratteri: verificare eventuali parti mancanti.'] : [], url, credits: 0, creditsAreEstimate: false };
}
