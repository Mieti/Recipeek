import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseEnv } from 'node:util';
import { z } from 'zod';
import { acquire, extract, type ProviderConfig } from './providers.js';
import { draftSchema, inputSchema, validateDraft, type Draft, type Material, type Validation } from './schema.js';
import { RecipeSelectionRequired } from './web.js';
import { demo } from './demo.js';

const port = Number(process.env.PORT || 4317);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT non valida.');
const origin = `http://127.0.0.1:${port}`;
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const output = join(root, '.local/import-lab');
const publicDir = fileURLToPath(new URL('./public/', import.meta.url));
await mkdir(output, { recursive: true });

type StoredMaterial = Omit<Material, 'photos'>;
type Job = {
  id: string; demo: boolean; state: 'acquiring' | 'extracting' | 'draft' | 'accepted' | 'rejected' | 'failed' | 'selection_required';
  createdAt: string; elapsedMs: number; material?: StoredMaterial; draft?: Draft; validation?: Validation;
  usage?: unknown; error?: string; titles?: string[]; review?: unknown;
};
const jobs = new Map<string, Job>();
let busy = false;
let liveCalls = 0;
const sessionLimit = 20;

async function config(): Promise<ProviderConfig> {
  let local: Record<string, string | undefined> = {};
  try { local = parseEnv(await readFile(join(root, '.env.local'), 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  const get = (key: string) => local[key]?.trim() || process.env[key]?.trim();
  return { geminiKey: get('GEMINI_API_KEY'), supadataKey: get('SUPADATA_API_KEY'), model: get('GEMINI_MODEL') || 'gemini-3.5-flash-lite', transcriptMode: get('SUPADATA_TRANSCRIPT_MODE') === 'auto' ? 'auto' : 'native' };
}

function respond(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function body(req: IncomingMessage): Promise<unknown> {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('Content-Type application/json richiesto.');
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 17_000_000) throw new Error('Richiesta troppo grande.');
    chunks.push(chunk as Buffer);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('Richiesta JSON non valida.'); }
}

async function persist(job: Job) { await writeFile(join(output, `${job.id}.json`), JSON.stringify(job, null, 2), 'utf8'); }
const publicMaterial = ({ photos: _photos, ...material }: Material): StoredMaterial => material;

async function execute(job: Job, input: z.infer<typeof inputSchema>, settings: ProviderConfig) {
  const started = performance.now();
  try {
    const material = await acquire(input, settings);
    job.material = publicMaterial(material); job.state = 'extracting';
    const result = await extract(material, settings);
    job.draft = result.draft; job.usage = result.usage;
    job.validation = validateDraft(result.draft, material.sources); job.state = 'draft';
  } catch (error) {
    if (error instanceof RecipeSelectionRequired) { job.state = 'selection_required'; job.titles = error.titles; job.error = error.message; }
    else { job.state = 'failed'; job.error = error instanceof z.ZodError ? 'La risposta non rispetta lo schema previsto. Nessuna bozza è stata approvata.' : error instanceof Error ? error.message : 'Importazione non riuscita.'; }
  } finally {
    job.elapsedMs = Math.round(performance.now() - started);
    try { await persist(job); } catch { job.error = 'Impossibile scrivere il risultato locale.'; job.state = 'failed'; }
    busy = false;
  }
}

export const server = createServer(async (req, res) => {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  if (req.headers.host !== `127.0.0.1:${port}` || (req.headers.origin && req.headers.origin !== origin)) { respond(res, 403, { error: 'Solo accesso locale dalla stessa origine.' }); return; }
  const path = new URL(req.url || '/', origin).pathname;
  try {
    if (req.method === 'GET' && path === '/api/status') {
      const settings = await config();
      respond(res, 200, { gemini: Boolean(settings.geminiKey), supadata: Boolean(settings.supadataKey), model: settings.model, transcriptMode: settings.transcriptMode, liveCalls, sessionLimit, busy }); return;
    }
    if (req.method === 'GET' && path.startsWith('/api/jobs/')) {
      const job = jobs.get(path.slice('/api/jobs/'.length));
      respond(res, job ? 200 : 404, job ?? { error: 'Risultato non presente nella sessione. I file salvati sono in .local/import-lab.' }); return;
    }
    if (req.method === 'POST' && path === '/api/import') {
      if (busy) { respond(res, 409, { error: 'Attendi la conclusione dell’importazione corrente.' }); return; }
      const input = inputSchema.parse(await body(req));
      const settings = await config();
      if (!settings.geminiKey) { respond(res, 400, { error: 'Aggiungi GEMINI_API_KEY in .env.local. Il pulsante Esempio locale funziona senza chiavi.' }); return; }
      if (liveCalls >= sessionLimit) { respond(res, 429, { error: 'Raggiunto il limite di 20 tentativi della sessione. Verifica i consumi prima di riavviare.' }); return; }
      const job: Job = { id: randomUUID(), demo: false, state: 'acquiring', createdAt: new Date().toISOString(), elapsedMs: 0 };
      jobs.set(job.id, job); liveCalls++; busy = true;
      respond(res, 202, { id: job.id });
      void execute(job, input, settings); return;
    }
    if (req.method === 'POST' && path === '/api/demo') {
      await body(req);
      const { material, draft } = demo();
      const job: Job = { id: randomUUID(), demo: true, state: 'draft', createdAt: new Date().toISOString(), elapsedMs: 0, material: publicMaterial(material), draft, validation: validateDraft(draft, material.sources), usage: { estimatedAiUsd: 0, model: 'Esempio locale, nessun modello' } };
      jobs.set(job.id, job); await persist(job); respond(res, 200, job); return;
    }
    if (req.method === 'POST' && path === '/api/review') {
      const review = z.object({ id: z.string().uuid(), decision: z.enum(['accepted', 'rejected']), confirmed: z.boolean(), draft: draftSchema, notes: z.string().max(2000), rating: z.enum(['usable', 'minor_edits', 'major_edits', 'unusable']), correctionSeconds: z.number().nonnegative().max(86400) }).strict().parse(await body(req));
      const job = jobs.get(review.id);
      if (!job?.draft || !job.material || !['draft','accepted','rejected'].includes(job.state)) { respond(res, 404, { error: 'Bozza non trovata.' }); return; }
      const validation = validateDraft(review.draft, job.material.sources, true);
      if (review.decision === 'accepted' && (!review.confirmed || validation.blocking.length)) { respond(res, 400, { error: 'Conferma la revisione e risolvi gli errori strutturali prima di salvare.', validation }); return; }
      job.review = { ...review, reviewedAt: new Date().toISOString() };
      // Keep the original model draft for evaluation; human edits live in review.draft.
      job.state = review.decision; await persist(job); respond(res, 200, job); return;
    }
    const assets: Record<string, [string, string]> = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
    const asset = assets[path];
    if (req.method === 'GET' && asset) { res.writeHead(200, { 'content-type': `${asset[1]}; charset=utf-8`, 'cache-control': 'no-store' }); res.end(await readFile(join(publicDir, asset[0]))); return; }
    respond(res, 404, { error: 'Risorsa non trovata.' });
  } catch (error) {
    respond(res, 400, { error: error instanceof z.ZodError ? 'Dati non validi: controlla campi e dimensioni.' : error instanceof Error ? error.message : 'Richiesta non valida.' });
  }
});
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.listen(port, '127.0.0.1', () => console.log(`Recipeek Import Lab: ${origin}`));
