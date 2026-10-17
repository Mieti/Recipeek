export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

// Count actual bytes while reading: Content-Length can be absent or misleading.
export async function readLimitedBody(request: Request, limit: number): Promise<Uint8Array> {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)))) throw new HttpError(400, 'Dimensione della richiesta non valida.');
  // Reject declared oversize before opening the body stream. Cancelling an
  // unopened inbound stream can abort the HTTP connection before the response.
  if (declared !== null && Number(declared) > limit) throw new HttpError(413, 'Richiesta troppo grande.');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.byteLength;
      if (size > limit) { await reader.cancel(); throw new HttpError(413, 'Richiesta troppo grande.'); }
      chunks.push(result.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function readJsonBody(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new HttpError(415, 'Usa il formato JSON.');
  const bytes = await readLimitedBody(request, 200_000);
  try { return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)); }
  catch { throw new HttpError(400, 'Dati JSON non validi.'); }
}

export function assertSameOrigin(request: Request) {
  if (['GET','HEAD'].includes(request.method)) return;
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'Origine non consentita.');
}
