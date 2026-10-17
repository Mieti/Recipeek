import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture} from './database.ts';
import {reserveUpload,storeUpload,cleanupUploads,storageUsage,enforceRateLimit,storagePolicy} from '../lib/media-storage.ts';
import {saveRecipe,removeRecipe,readableUpload} from '../lib/repository.ts';
import {examples} from '../lib/examples.ts';
import {HttpError} from '../lib/http.ts';
import {sanitizePhoto} from '../lib/photo.ts';

const old=Date.now()-49*3600_000;
const bucket=(deleteFile:(id:string)=>Promise<void>=async()=>{})=>({delete:deleteFile} as Pick<R2Bucket,'delete'>);
function seed(sqlite:ReturnType<typeof fixture>['sqlite'],id:string,owner='alice',bytes=10,state='ready',created=old){sqlite.prepare('INSERT INTO uploads (id,owner_id,name,content_type,created_at,byte_size,state) VALUES (?,?,\'Foto\',\'image/jpeg\',?,?,?)').run(id,owner,new Date(created).toISOString(),bytes,state);}

test('la quota prenota i byte prima di R2, include richieste simultanee e separa gli utenti',async()=>{
  const {db,sqlite}=fixture();try{
    seed(sqlite,'full','alice',storagePolicy.maxBytes-10);
    const results=await Promise.allSettled(Array.from({length:10},(_,i)=>reserveUpload(db,'alice',`reserve-${i}`,10,'image/jpeg')));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal((await storageUsage(db,'alice')).bytes,storagePolicy.maxBytes);
    await reserveUpload(db,'bob','bob-photo',10,'image/jpeg');
    assert.equal((await storageUsage(db,'bob')).files,1);
    const pending=sqlite.prepare("SELECT count(*) n FROM uploads WHERE state='pending'").get() as {n:number};assert.equal(pending.n,2);
  }finally{sqlite.close();}
});

test('il limite di file è atomico anche per prenotazioni non ancora completate',async()=>{
  const {db,sqlite}=fixture();try{
    sqlite.exec("WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<499) INSERT INTO uploads (id,owner_id,name,content_type,created_at,byte_size) SELECT 'file-'||x,'alice','Foto','image/jpeg','2026',1 FROM n");
    await reserveUpload(db,'alice','last',1,'image/jpeg');
    await assert.rejects(()=>reserveUpload(db,'alice','excess',1,'image/jpeg'),e=>e instanceof HttpError&&e.status===409);
  }finally{sqlite.close();}
});

test('limiti persistenti: 30 upload/ora e 300 API/minuto, Retry-After e riapertura finestra',async()=>{
  const {db,sqlite}=fixture();try{
    const now=1792200000000;
    for(let i=0;i<30;i++)await enforceRateLimit(db,'alice','upload',now);
    await assert.rejects(()=>enforceRateLimit({...db},'alice','upload',now),e=>e instanceof HttpError&&e.status===429&&Number(e.headers['Retry-After'])>0);
    await enforceRateLimit(db,'bob','upload',now);await enforceRateLimit(db,'alice','upload',now+3600_000);
    for(let i=0;i<300;i++)await enforceRateLimit(db,'alice','api',now+3600_000);
    await assert.rejects(()=>enforceRateLimit(db,'alice','api',now+3600_000),e=>e instanceof HttpError&&e.status===429);
    await enforceRateLimit(db,'alice','api',now+3660_000);
    assert.equal((sqlite.prepare('SELECT count(*) n FROM request_limits WHERE expires_at<=?').get(Math.floor((now+3660_000)/1000)) as {n:number}).n,0);
  }finally{sqlite.close();}
});

test('la pulizia conserva foto recenti, collegate e altrui; recupera orfani e prenotazioni interrotte',async()=>{
  const {db,sqlite}=fixture();try{
    seed(sqlite,'linked');seed(sqlite,'orphan');seed(sqlite,'pending','alice',10,'pending');seed(sqlite,'fresh','alice',10,'ready',Date.now());seed(sqlite,'other','bob');
    await saveRecipe(db,'alice',{...examples[0],steps:[{...examples[0].steps[0],image:'/api/media/linked'}]});
    const deleted:string[]=[];const result=await cleanupUploads(db,bucket(async id=>{deleted.push(id);}), 'alice');
    assert.equal(result.removed,2);assert.deepEqual(deleted.sort(),['orphan','pending']);
    assert.ok(await readableUpload(db,'linked','alice'));assert.ok(await readableUpload(db,'fresh','alice'));assert.ok(await readableUpload(db,'other','bob'));
  }finally{sqlite.close();}
});

test('rimuovere l’ultimo riferimento fa ripartire 24 ore di attesa, anche cancellando la ricetta',async()=>{
  const {db,sqlite}=fixture();try{
    seed(sqlite,'cover');seed(sqlite,'step');
    const original=await saveRecipe(db,'alice',{...examples[0],image:'/api/media/cover',steps:[{...examples[0].steps[0],image:'/api/media/step'}]});
    const changed=await saveRecipe(db,'alice',{...original,image:''},original.id,original.updatedAt);
    await removeRecipe(db,changed.id,'alice');
    assert.equal((await cleanupUploads(db,bucket(),'alice')).removed,0);
    assert.equal((await cleanupUploads(db,bucket(),'alice',Date.now()+25*3600_000)).removed,2);
  }finally{sqlite.close();}
});

test('una foto già reclamata dalla pulizia non può essere agganciata da un salvataggio concorrente',async()=>{
  const {db,sqlite}=fixture();try{
    seed(sqlite,'race');const original=await saveRecipe(db,'alice',examples[0]);let blocked=0;
    const result=await cleanupUploads(db,bucket(async()=>{
      await assert.rejects(()=>saveRecipe(db,'alice',{...original,image:'/api/media/race'},original.id,original.updatedAt),/INVALID_MEDIA/);blocked++;
      assert.equal(await readableUpload(db,'race','alice'),null);
    }),'alice');
    assert.equal(result.removed,1);assert.equal(blocked,1);
    await assert.rejects(()=>saveRecipe(db,'alice',{...examples[0],image:'/api/media/race'}),/INVALID_MEDIA/);
    seed(sqlite,'foreign','bob');await assert.rejects(()=>saveRecipe(db,'alice',{...examples[0],image:'/api/media/foreign'}),/INVALID_MEDIA/);
    seed(sqlite,'notready','alice',10,'pending');await assert.rejects(()=>saveRecipe(db,'alice',{...examples[0],image:'/api/media/notready'}),/INVALID_MEDIA/);
  }finally{sqlite.close();}
});

test('R2 indisponibile conserva il conteggio e permette di ritentare la cancellazione',async()=>{
  const {db,sqlite}=fixture();try{
    seed(sqlite,'failed');assert.deepEqual(await cleanupUploads(db,bucket(async()=>{throw new Error('offline');}),'alice'),{removed:0,failed:1});
    assert.equal((await storageUsage(db,'alice')).bytes,10);
    assert.deepEqual(await cleanupUploads(db,bucket(),'alice'),{removed:1,failed:0});
    const unavailable={put:async()=>{throw new Error('put failed');},delete:async()=>{throw new Error('delete failed');}} as unknown as Pick<R2Bucket,'put'|'delete'>;
    await assert.rejects(()=>storeUpload(db,unavailable,'alice',new Uint8Array(12),'image/jpeg'),/put failed/);
    assert.equal((await storageUsage(db,'alice')).bytes,12);
    assert.equal((await cleanupUploads(db,bucket(),'alice',Date.now()+25*3600_000)).removed,1);
    const rollback={...unavailable,delete:async()=>{}} as unknown as Pick<R2Bucket,'put'|'delete'>;
    await assert.rejects(()=>storeUpload(db,rollback,'alice',new Uint8Array(12),'image/jpeg'),/put failed/);
    assert.equal((await storageUsage(db,'alice')).files,0);
  }finally{sqlite.close();}
});

test('JPEG, PNG e WebP perdono metadati personali senza perdere dimensioni e orientamento',()=>{
  for(const [file,type] of [['jpeg','image/jpeg'],['png','image/png'],['webp','image/webp']]){
    const original=readFileSync(new URL(`./fixtures/photo.${file}`,import.meta.url));assert.ok(original.includes(Buffer.from('Private Artist')));
    const photo=sanitizePhoto(original,type);
    assert.equal(photo.width,3);assert.equal(photo.height,2);assert.equal(Buffer.from(photo.data).includes(Buffer.from('Private Artist')),false);assert.equal(Buffer.from(photo.data).includes(Buffer.from('Private location')),false);
    assert.ok(photo.data.length<original.length);assert.deepEqual(sanitizePhoto(photo.data,type).data,photo.data);
  }
});

test('firme false, contenitori troncati, code arbitrarie e dimensioni eccessive vengono rifiutati',()=>{
  for(const [file,type] of [['jpeg','image/jpeg'],['png','image/png'],['webp','image/webp']]){
    const original=readFileSync(new URL(`./fixtures/photo.${file}`,import.meta.url));
    assert.throws(()=>sanitizePhoto(original.subarray(0,16),type),HttpError);
    assert.throws(()=>sanitizePhoto(Buffer.concat([original,Buffer.from('trailing data')]),type),HttpError);
    assert.throws(()=>sanitizePhoto(original,type==='image/jpeg'?'image/png':'image/jpeg'),HttpError);
  }
  const big=readFileSync(new URL('./fixtures/photo.jpeg',import.meta.url));let at=2;
  while(at<big.length){const marker=big[at+1],length=big.readUInt16BE(at+2);if(marker===192||marker===194){big.writeUInt16BE(8193,at+5);break;}at+=2+length;}
  assert.throws(()=>sanitizePhoto(big,'image/jpeg'),/troppo grande/);
});
