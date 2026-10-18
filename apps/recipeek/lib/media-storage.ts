import type { Database } from './repository.ts';
import { HttpError } from './http.ts';

export const storagePolicy = {maxBytes:250_000_000,maxFiles:500,graceHours:24,uploadLimit:30,apiLimit:300};
// Materialize the owner's references once, rather than reparse every recipe
// for every uploaded file. Missing/empty image fields never enter the set.
const unreferenced = `uploads.id NOT IN (
 SELECT substr(json_extract(document,'$.image'),12) FROM recipes WHERE owner_id=? AND json_extract(document,'$.image') LIKE '/api/media/%'
 UNION SELECT substr(json_extract(s.value,'$.image'),12) FROM recipes r,json_each(r.document,'$.steps') s WHERE r.owner_id=? AND json_extract(s.value,'$.image') LIKE '/api/media/%'
 UNION SELECT substr(p.value,12) FROM ai_imports a,json_each(a.document,'$.input.photos') p WHERE a.owner_id=uploads.owner_id AND a.status<>'discarded' AND p.value LIKE '/api/media/%'
 UNION SELECT substr(json_extract(s.value,'$.photoPath'),12) FROM ai_imports a,json_each(a.document,'$.sources') s WHERE a.owner_id=uploads.owner_id AND a.status<>'discarded' AND json_extract(s.value,'$.photoPath') LIKE '/api/media/%'
)`;

// Fixed UTC windows live in D1, not in an individual Worker isolate.
export async function enforceRateLimit(db: Database, owner: string, scope: 'api'|'upload'|'restore'|'backup', now = Date.now()) {
  const seconds = Math.floor(now/1000), duration = scope==='api'?60:3600;
  const start = Math.floor(seconds/duration)*duration, limit = {api:storagePolicy.apiLimit,upload:storagePolicy.uploadLimit,restore:600,backup:20}[scope];
  const result = await db.batch([
    db.prepare('DELETE FROM request_limits WHERE expires_at<=?').bind(seconds),
    db.prepare('INSERT INTO request_limits (owner_id,scope,window_start,expires_at,hits) VALUES (?,?,?,?,1) ON CONFLICT(owner_id,scope,window_start) DO UPDATE SET hits=hits+1 WHERE hits<?').bind(owner,scope,start,start+duration,limit),
  ]);
  if (!result[1].meta.changes) throw new HttpError(429,scope==='upload'?'Hai raggiunto il limite di 30 caricamenti in questa ora. Riprova più tardi.':'Troppe richieste. Attendi prima di riprovare.',{'Retry-After':String(start+duration-seconds)});
}

export async function storageUsage(db: Database, owner: string) {
  const usage = await db.prepare(`SELECT count(*) AS files,coalesce(sum(byte_size),0) AS bytes,coalesce(sum(CASE WHEN ${unreferenced} AND coalesce(last_used_at,created_at)<? THEN 1 ELSE 0 END),0) AS removable FROM uploads WHERE owner_id=?`).bind(owner,owner,new Date(Date.now()-storagePolicy.graceHours*3600_000).toISOString(),owner).first<{files:number;bytes:number;removable:number}>();
  return {...usage!,...storagePolicy};
}

export async function reserveUpload(db: Database, owner: string, id: string, bytes: number, type: string, now = Date.now()) {
  if (!Number.isSafeInteger(bytes)||bytes<=0||bytes>6_000_000) throw new HttpError(400,'Dimensione foto non valida.');
  const result = await db.prepare(`INSERT INTO uploads (id,owner_id,name,content_type,created_at,byte_size,state) SELECT ?,?,'Foto ricetta',?,?,?,'pending' WHERE (SELECT count(*) FROM uploads WHERE owner_id=?)<? AND (SELECT coalesce(sum(byte_size),0) FROM uploads WHERE owner_id=?)+?<=?`).bind(id,owner,type,new Date(now).toISOString(),bytes,owner,storagePolicy.maxFiles,owner,bytes,storagePolicy.maxBytes).run();
  if (!result.meta.changes) throw new HttpError(409,'Spazio foto esaurito (250 MB o 500 foto). Elimina foto dalle ricette e libera spazio nelle impostazioni dopo 24 ore.');
}

// The reservation precedes R2 writes: even interrupted requests remain accounted for.
export async function storeUpload(db: Database, bucket: Pick<R2Bucket,'put'|'delete'>, owner: string, data: Uint8Array, type: string, requestedId?:string) {
  const id = requestedId??crypto.randomUUID();
  if(requestedId){const existing=await db.prepare('SELECT state FROM uploads WHERE id=? AND owner_id=?').bind(id,owner).first<{state:string}>();if(existing?.state==='ready')return `/api/media/${id}`;if(existing)throw new HttpError(409,'Ripristino foto già in corso. Riprova tra poco.');}
  try{await reserveUpload(db,owner,id,data.byteLength,type);}catch(error){if(requestedId&&await db.prepare("SELECT id FROM uploads WHERE id=? AND owner_id=? AND state='ready'").bind(id,owner).first())return `/api/media/${id}`;throw error;}
  try {
    await bucket.put(id,data,{httpMetadata:{contentType:type}});
    const ready = await db.prepare("UPDATE uploads SET state='ready' WHERE id=? AND owner_id=? AND state='pending'").bind(id,owner).run();
    if (!ready.meta.changes) throw new Error('UPLOAD_EXPIRED');
    return `/api/media/${id}`;
  } catch (error) {
    // If deletion fails, retain the reservation so maintenance can retry safely.
    try { await bucket.delete(id); await db.prepare("DELETE FROM uploads WHERE id=? AND owner_id=? AND state='pending'").bind(id,owner).run(); } catch { /* retried by cleanup */ }
    throw error;
  }
}

export async function cleanupUploads(db: Database, bucket: Pick<R2Bucket,'delete'>, owner: string, now = Date.now()) {
  const cutoff = new Date(now-storagePolicy.graceHours*3600_000).toISOString();
  // Claim before touching R2. Recipe validation triggers reject a concurrent attach
  // after this transition; claims made after an attach see the new reference.
  await db.prepare(`UPDATE uploads SET state='deleting' WHERE id IN (SELECT id FROM uploads WHERE owner_id=? AND state IN ('ready','pending') AND coalesce(last_used_at,created_at)<? AND ${unreferenced} ORDER BY created_at LIMIT 10)`).bind(owner,cutoff,owner,owner).run();
  const claimed = await db.prepare("SELECT id FROM uploads WHERE owner_id=? AND state='deleting' ORDER BY created_at LIMIT 10").bind(owner).all<{id:string}>();
  let removed=0, failed=0;
  for (const {id} of claimed.results) {
    try { await bucket.delete(id); await db.prepare("DELETE FROM uploads WHERE id=? AND owner_id=? AND state='deleting'").bind(id,owner).run(); removed++; }
    catch { failed++; }
  }
  return {removed,failed};
}
