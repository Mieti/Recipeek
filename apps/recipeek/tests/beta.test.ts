import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {zipSync,strToU8} from 'fflate';
import {fixture} from './database.ts';
import {saveRecipe,removeRecipe,restoreRecipe,listTrash,listRecipes,readRecipe,purgeRecipe,importRecipe,findImported} from '../lib/repository.ts';
import {examples} from '../lib/examples.ts';
import {blankRecipe} from '../lib/model.ts';
import {parseDraft,writeDraft,readDrafts,discardDraft} from '../lib/drafts.ts';
import {createArchive,inspectArchive,archiveEntries} from '../lib/archive.ts';
import {exportArchive} from '../lib/export-archive.ts';
import {restoreBackup} from '../lib/restore-backup.ts';
import {cleanupUploads} from '../lib/media-storage.ts';

async function archive(entries:{name:string;data:Uint8Array}[]){async function* source(){yield* entries;}const chunks:Uint8Array[]=[];for await(const chunk of createArchive(source()))chunks.push(new Uint8Array(chunk));return new Blob(chunks.map(chunk=>new Uint8Array(chunk)));}
const original={...examples[0],id:'r1',ownerId:'original',authorName:'Originale',createdAt:'2026',updatedAt:'2026'};
const jpeg=new Uint8Array(readFileSync(new URL('./fixtures/photo.jpeg',import.meta.url)));
const encoder=new TextEncoder();

test('le bozze incomplete conservano campi, revisione e sezione, senza mescolare gli utenti',()=>{
  const backing:Record<string,string>={};const storage=Object.assign(backing,{getItem:(key:string)=>backing[key]??null,setItem:(key:string,value:string)=>{backing[key]=value;},removeItem:(key:string)=>{delete backing[key];}});
  const draft={key:'new',section:1,modifiedAt:new Date().toISOString(),value:{...blankRecipe(),title:'La mia bozza',servings:0,sourceUrl:'https://'}};
  assert.equal(writeDraft('alice',draft,storage),true);assert.equal(readDrafts('alice',storage)[0].value.servings,0);assert.equal(readDrafts('alice',storage)[0].section,1);assert.equal(readDrafts('bob',storage).length,0);
  discardDraft('alice','new',storage);assert.equal(readDrafts('alice',storage).length,0);assert.equal(parseDraft('{broken'),null);
  assert.equal(writeDraft('alice',draft,{...storage,setItem:()=>{throw new Error('quota');}}),false);
  assert.equal(writeDraft('alice',draft,null),false);
});

test('il cestino è privato, ripristina senza ricondividere e invalida modifiche precedenti',async()=>{
  const {db,sqlite}=fixture();try{
    const recipe=await saveRecipe(db,'alice',{...examples[0],visibility:'shared'});
    assert.equal(await removeRecipe(db,recipe.id,'bob'),false);assert.equal(await purgeRecipe(db,recipe.id,'alice'),false);
    assert.equal(await removeRecipe(db,recipe.id,'alice'),true);assert.equal((await listRecipes(db,'alice')).length,0);assert.equal((await listRecipes(db,'bob','community')).length,0);
    assert.equal(await readRecipe(db,recipe.id,'bob'),null);assert.equal((await listTrash(db,'bob')).length,0);assert.equal((await listTrash(db,'alice')).length,1);
    assert.equal(await restoreRecipe(db,recipe.id,'bob'),null);const restored=await restoreRecipe(db,recipe.id,'alice');assert.equal(restored?.visibility,'private');
    assert.notEqual(restored?.updatedAt,recipe.updatedAt);await assert.rejects(()=>saveRecipe(db,'alice',recipe,recipe.id,recipe.updatedAt),/CONFLICT/);
    await removeRecipe(db,recipe.id,'alice');assert.equal(await purgeRecipe(db,recipe.id,'bob'),false);assert.equal(await purgeRecipe(db,recipe.id,'alice'),true);assert.equal((await listTrash(db,'alice')).length,0);
  }finally{sqlite.close();}
});

test('il cestino protegge le foto dalla pulizia fino all’eliminazione definitiva',async()=>{
  const {db,sqlite}=fixture();try{
    sqlite.exec("INSERT INTO uploads (id,owner_id,name,content_type,created_at,byte_size) VALUES ('photo','alice','Foto','image/jpeg','2000',10)");
    const recipe=await saveRecipe(db,'alice',{...examples[0],image:'/api/media/photo'});await removeRecipe(db,recipe.id,'alice');
    const bucket={delete:async()=>{}} as unknown as Pick<R2Bucket,'delete'>;
    assert.equal((await cleanupUploads(db,bucket,'alice',Date.now()+40*86400_000)).removed,0);
    await purgeRecipe(db,recipe.id,'alice');assert.equal((await cleanupUploads(db,bucket,'alice')).removed,0);
    assert.equal((await cleanupUploads(db,bucket,'alice',Date.now()+25*3600_000)).removed,1);
  }finally{sqlite.close();}
});

test('ripetere un import non duplica o sovrascrive ricette, neppure nel cestino',async()=>{
  const {db,sqlite}=fixture();try{
    const source={key:'original/r1',sourceId:'r1',sourceOwner:'original'};
    const first=await importRecipe(db,'alice',examples[0],source);assert.equal(first.duplicate,false);assert.ok(first.recipe);
    const changed=await saveRecipe(db,'alice',{...first.recipe!,title:'Modifica personale'},first.recipe!.id,first.recipe!.updatedAt);
    assert.equal((await importRecipe(db,'alice',examples[0],source)).duplicate,true);assert.equal((await readRecipe(db,changed.id,'alice'))?.title,'Modifica personale');
    await removeRecipe(db,changed.id,'alice');assert.equal((await importRecipe(db,'alice',examples[0],source)).duplicate,true);
    assert.equal((await listTrash(db,'alice')).length,1);assert.equal(await findImported(db,'bob',source),null);
    const own=await saveRecipe(db,'bob',examples[1]);assert.equal((await importRecipe(db,'bob',examples[1],{key:'backup-own',sourceId:own.id,sourceOwner:'bob'})).duplicate,true);
  }finally{sqlite.close();}
});

test('l’archivio completo include foto e ricette e controlla l’integrità prima del ripristino',async()=>{
  const recipe={...original,image:'/api/media/photo'};
  const file=await archive([{name:'media/photo.jpg',data:jpeg},{name:'recipes/r1.json',data:encoder.encode(JSON.stringify(recipe))}]);
  const inspected=await inspectArchive(file);assert.equal(inspected.length,1);assert.equal(inspected[0].source.sourceId,'r1');assert.equal(inspected[0].recipe.image,'/api/media/photo');
  const data=new Uint8Array(await file.arrayBuffer());data[100]^=1;await assert.rejects(()=>inspectArchive(new Blob([data])));
  await assert.rejects(()=>inspectArchive(file.slice(0,file.size-10)),/incompleto/);
  const incomplete=await archive([{name:'recipes/r1.json',data:encoder.encode(JSON.stringify(recipe))}]);await assert.rejects(()=>inspectArchive(incomplete),/foto manca/);
});

test('ZIP arbitrari, compressi, con path traversal o nomi ripetuti sono rifiutati',async()=>{
  const compressed=new Blob([zipSync({'recipeek.json':strToU8('x'.repeat(1000))})]);await assert.rejects(()=>inspectArchive(compressed),/supportato/);
  const traversal=new Blob([zipSync({'../recipeek.json':[strToU8('{}'),{level:0}]})]);await assert.rejects(()=>inspectArchive(traversal),/supportato/);
  await assert.rejects(()=>archive([{name:'recipes/r1.json',data:strToU8('{}')},{name:'recipes/r1.json',data:strToU8('{}')}]),/non valido/);
});

test('export privato a flusso e ripristino completo mantengono collegamenti e dosi',async()=>{
  const {db,sqlite}=fixture();try{
    sqlite.exec("INSERT INTO uploads (id,owner_id,name,content_type,created_at,byte_size) VALUES ('photo','alice','Foto','image/jpeg','2026',1014)");
    const recipe=await saveRecipe(db,'alice',{...examples[0],image:'/api/media/photo',steps:[{...examples[0].steps[0],image:'/api/media/photo'}]});
    const r2={get:async()=>({body:new ReadableStream({start(c){c.enqueue(jpeg);c.close();}})})} as unknown as Pick<R2Bucket,'get'>;
    await assert.rejects(()=>exportArchive(db,r2,'bob',[recipe.id]),/non è più disponibile/);
    const response=await exportArchive(db,r2,'alice',[recipe.id]),file=await response.blob();assert.equal((await inspectArchive(file)).length,1);
    let photos=0;const imported:unknown[]=[];
    const result=await restoreBackup(file,true,{check:async()=>[false],photo:async()=>{photos++;return '/api/media/restored';},recipe:async(input)=>{imported.push(input);return {duplicate:false,recipe:{...recipe,...input}};}},()=>{},()=>{});
    assert.equal(result.imported,1);assert.equal(photos,1);const input=imported[0] as typeof recipe;assert.equal(input.image,'/api/media/restored');assert.equal(input.steps[0].image,'/api/media/restored');assert.deepEqual(input.ingredients,recipe.ingredients);assert.equal(input.visibility,'private');
    const retry=await restoreBackup(file,true,{check:async()=>[true],photo:async()=>{throw new Error('should skip');},recipe:async()=>{throw new Error('should skip');}},()=>{},()=>{});assert.equal(retry.skipped,1);
    const entries=[];for await(const entry of archiveEntries(file))entries.push(entry.name);assert.equal(entries.filter(name=>name.startsWith('media/')).length,1);
  }finally{sqlite.close();}
});
