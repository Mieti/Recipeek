import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLimitedBody, readJsonBody, assertSameOrigin, HttpError } from '../lib/http.ts';
import { parseCookingSession, parseTimerState, timerSeconds, readKitchenState, writeKitchenState, removeKitchenState } from '../lib/kitchen-state.ts';
import { prepareBackupParts, parseBackup, backupByteLimit } from '../lib/backup.ts';
import { secureResponse } from '../lib/security-headers.ts';
import { recipeSchema, type Recipe } from '../lib/model.ts';
import { examples } from '../lib/examples.ts';

const recipe:Recipe={...examples[0],id:'recipe',ownerId:'alice',authorName:'Alice',createdAt:'2026',updatedAt:'2026'};
test('il limite interrompe e cancella uno stream senza Content-Length prima di leggerlo per intero',async()=>{
  let reads=0,cancelled=false;
  const body=new ReadableStream({pull(controller){reads++;controller.enqueue(new Uint8Array(16));},cancel(){cancelled=true;}});
  const request=new Request('https://site.test/api/media',{method:'POST',body,duplex:'half'} as RequestInit);
  await assert.rejects(()=>readLimitedBody(request,30),(e:unknown)=>e instanceof HttpError&&e.status===413);
  assert.equal(cancelled,true);assert.ok(reads<=4);
});
test('JSON e upload contano byte UTF-8 reali; Content-Length piccolo non aggira il limite',async()=>{
  const req=new Request('https://site.test/api/recipes',{method:'POST',headers:{'content-length':'1'},body:'è'.repeat(20)});
  await assert.rejects(()=>readLimitedBody(req,30),/troppo grande/);
  await assert.rejects(()=>readJsonBody(new Request('https://site.test',{method:'POST',headers:{'content-type':'application/json'},body:'{'})),/JSON non validi/);
  await assert.rejects(()=>readJsonBody(new Request('https://site.test',{method:'POST',headers:{'content-type':'text/plain'},body:'{}'})),/formato JSON/);
});
test('CSRF confronta l’origine completa, inclusi schema e porta',()=>{
  for(const origin of ['http://site.test','https://site.test:444','https://attacker.test','null'])assert.throws(()=>assertSameOrigin(new Request('https://site.test/api/me',{method:'PATCH',headers:{origin}})));
  assert.doesNotThrow(()=>assertSameOrigin(new Request('https://site.test/api/me',{method:'PATCH',headers:{origin:'https://site.test'}})));
});
test('localStorage indisponibile o pieno non blocca cooking, con recupero in memoria',()=>{
  const storage={getItem(){throw new Error('disabled');},setItem(){throw new Error('quota');},removeItem(){throw new Error('disabled');}};
  writeKitchenState('test','value',storage);assert.equal(readKitchenState('test',storage),'value');removeKitchenState('test',storage);assert.equal(readKitchenState('test',storage),null);
  const full={getItem(){return 'old';},setItem(){throw new Error('quota');},removeItem(){}};
  writeKitchenState('newest','latest',full);assert.equal(readKitchenState('newest',full),'latest');
  assert.equal(parseCookingSession('{bad'),null);assert.equal(parseCookingSession(JSON.stringify({recipe:{id:'broken'},factor:1,step:0})),null);
  assert.equal(parseCookingSession(JSON.stringify({recipe,servings:2,factor:1,step:100})),null);
  assert.ok(parseCookingSession(JSON.stringify({recipe,servings:2,factor:1,step:0})));
});
test('i timer mantengono pausa/scadenza e chiavi indipendenti tra passaggi',()=>{
  writeKitchenState('timer-step-one',JSON.stringify({end:5000,remaining:0}));
  writeKitchenState('timer-step-two',JSON.stringify({end:null,remaining:60}));
  assert.equal(timerSeconds(parseTimerState(readKitchenState('timer-step-one'),120,3000),3000),2);
  assert.equal(parseTimerState(readKitchenState('timer-step-one'),120,6000).expired,true);
  assert.equal(timerSeconds(parseTimerState(readKitchenState('timer-step-two'),120,6000),6000),60);
  assert.equal(parseTimerState('null',120).remaining,120);
});
test('il backup oltre 100 ricette viene diviso in parti tutte reimportabili, senza foto private o visibilità condivisa',()=>{
  const recipes=Array.from({length:205},(_,i)=>({...recipe,id:`r${i}`,image:'/api/media/private',visibility:'shared' as const}));
  const parts=prepareBackupParts(recipes);assert.deepEqual(parts.map(p=>p.count),[100,100,5]);
  const imported=parts.flatMap(p=>{assert.ok(new TextEncoder().encode(p.content).length<=backupByteLimit);return parseBackup(JSON.parse(p.content));});
  assert.equal(imported.length,205);assert.ok(imported.every(r=>r.image===''&&r.visibility==='private'));
  assert.throws(()=>parseBackup({format:'recipeek',version:1,recipes:[{image:9}]}));
});
test('il backup rispetta anche il limite in byte su ricette grandi e Unicode',()=>{
  const parts=prepareBackupParts(Array.from({length:100},()=>({...recipe,notes:'🍝'.repeat(20000)})));
  assert.ok(parts.length>1);assert.ok(parts.every(p=>new TextEncoder().encode(p.content).byteLength<=backupByteLimit));
});
test('dimensioni teglia e URL non validi sono rifiutati prima del ricalcolo o del salvataggio',()=>{
  for(const url of ['https://','https://user:password@example.com','javascript:alert(1)'])assert.equal(recipeSchema.safeParse({...recipe,sourceUrl:url}).success,false);
  assert.equal(recipeSchema.safeParse({...recipe,pan:{shape:'round',width:1e-300,length:20}}).success,false);
});
test('le pagine private non ereditano cache pubblica e i link esterni non ricevono il referrer',()=>{
  const response=secureResponse(new Request('https://site.test/'),new Response('private',{headers:{'cache-control':'public, max-age=3600'}}));
  assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.match(response.headers.get('content-security-policy')!,/object-src 'none'/);
  assert.equal(secureResponse(new Request('https://site.test/import/monitor'),new Response('private',{headers:{'cache-control':'public'}})).headers.get('cache-control'),'private, no-store');
});
