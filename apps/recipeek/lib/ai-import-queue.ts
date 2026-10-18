import type {Database} from './repository.ts';
import type {ImportEnv} from './ai-import-provider.ts';
import {processImportJob} from './ai-import-service.ts';

export const queuePath='/internal/import-queue';
const stages=['acquire','analyze','transcript','transcriptPoll','analyzeTranscript','analyzeSupplement','videoStart','videoPoll','saving'];
export async function runImportQueue(db:Database,env:ImportEnv,bucket?:R2Bucket,fetcher:typeof fetch=fetch){
  await db.prepare("INSERT INTO ai_queue_state (id,last_tick) VALUES ('imports',?) ON CONFLICT(id) DO UPDATE SET last_tick=excluded.last_tick").bind(Date.now()).run();
  if(!env.GEMINI_API_KEY)return {processed:0,disabled:true};
  const now=Date.now();
  const due=await db.prepare(`SELECT id,owner_id,CASE WHEN json_extract(document,'$.hasPhotos')=1 THEN 'photos' ELSE json_extract(document,'$.input.kind') END AS kind FROM ai_imports WHERE status IN (${stages.map(()=>'?').join(',')}) AND lease_until<=? AND next_run_at<=? ORDER BY next_run_at,updated_at,id LIMIT 2`).bind(...stages,now,now).all<{id:string;owner_id:string;kind:string}>();
  // Never hold two sets of image buffers/base64 payloads in the same 128 MB isolate.
  const selected=due.results.every(r=>r.kind==='photos')?due.results.slice(0,1):due.results;
  const results=await Promise.allSettled(selected.map(r=>processImportJob(db,r.id,r.owner_id,env,bucket,fetcher)));
  const failures=results.filter(r=>r.status==='rejected').length;
  if(failures)console.error('Import queue persistence failure',failures);
  return {processed:results.filter(r=>r.status==='fulfilled'&&r.value.processed).length,failures};
}
async function secretEqual(a:string,b:string){
  const [x,y]=await Promise.all([a,b].map(s=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))));
  const left=new Uint8Array(x),right=new Uint8Array(y);let diff=0;for(let i=0;i<left.length;i++)diff|=left[i]^right[i];return diff===0;
}
export async function handleImportQueue(request:Request,db:Database|undefined,env:ImportEnv,bucket?:R2Bucket,fetcher:typeof fetch=fetch){
  const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
  if(!env.RECIPEEK_IMPORT_QUEUE_TOKEN||!await secretEqual(request.headers.get('authorization')??'',`Bearer ${env.RECIPEEK_IMPORT_QUEUE_TOKEN}`))return Response.json({error:'Non autorizzato.'},{status:401,headers});
  if(request.method!=='POST')return Response.json({error:'Metodo non consentito.'},{status:405,headers:{...headers,Allow:'POST'}});
  if(!db)return Response.json({error:'Coda non disponibile.'},{status:503,headers});
  // No caller-selected owner, job, URL or provider credentials are accepted.
  const result=await runImportQueue(db,env,bucket,fetcher);return Response.json(result,{headers});
}
