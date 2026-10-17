import {Zip,ZipPassThrough,Unzip} from 'fflate';
import {z} from 'zod';
import {digest} from './identity.ts';
import {sanitizePhoto} from './photo.ts';
import {recipeSchema,type Recipe} from './model.ts';
import type {ImportSource} from './repository.ts';

const entrySchema=z.object({name:z.string().max(160),size:z.number().int().min(0).max(6_000_000),sha256:z.string().regex(/^[a-f0-9]{64}$/)});
const manifestSchema=z.object({format:z.literal('recipeek'),version:z.literal(2),entries:z.array(entrySchema).max(600)});
export type ArchiveEntry={name:string;data:Uint8Array};
const path=/^(?:recipes\/[a-zA-Z0-9-]+\.json|media\/[a-zA-Z0-9-]+\.(?:jpg|png|webp)|recipeek\.json)$/;
export const archiveByteLimit=270_000_000;
const decode=(bytes:Uint8Array)=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
const bytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value));
export async function recipeSource(raw:unknown):Promise<ImportSource> {
  const source=z.object({id:z.string().min(1).max(80),ownerId:z.string().min(1).max(200)}).safeParse(raw);
  return source.success?{key:JSON.stringify([source.data.ownerId,source.data.id]),sourceId:source.data.id,sourceOwner:source.data.ownerId}:{key:await digest(JSON.stringify(recipeSchema.parse(raw)))};
}
export function photoPaths(recipe:Pick<Recipe,'image'|'steps'>){return [...new Set([recipe.image,...recipe.steps.map(s=>s.image)].filter(p=>p.startsWith('/api/media/')))];}

// STORE entries: photos are already compressed. Yield after every entry so the
// HTTP consumer provides backpressure; only one photo is buffered at a time.
export async function* createArchive(entries:AsyncIterable<ArchiveEntry>):AsyncGenerator<Uint8Array>{
  const chunks:Uint8Array[]=[],manifest:z.infer<typeof entrySchema>[]=[];
  const zip=new Zip((error,data)=>{if(error)throw error;chunks.push(data);});
  for await(const entry of entries){
    if(!path.test(entry.name)||entry.name==='recipeek.json'||manifest.some(e=>e.name===entry.name)||manifest.length>=600||entry.data.length>6_000_000)throw new Error('Archivio non valido.');
    manifest.push({name:entry.name,size:entry.data.length,sha256:await digest(entry.data)});
    const file=new ZipPassThrough(entry.name);zip.add(file);file.push(entry.data,true);while(chunks.length)yield chunks.shift()!;
  }
  const file=new ZipPassThrough('recipeek.json');zip.add(file);file.push(bytes({format:'recipeek',version:2,entries:manifest}),true);zip.end();while(chunks.length)yield chunks.shift()!;
}
export function archiveStream(entries:AsyncIterable<ArchiveEntry>){
  const iterator=createArchive(entries);
  return new ReadableStream<Uint8Array>({async pull(controller){try{const next=await iterator.next();if(next.done)controller.close();else controller.enqueue(next.value);}catch(error){controller.error(error);}},async cancel(){await iterator.return(undefined);}});
}

// Bounded streaming extraction. Only our uncompressed archive format is accepted:
// no inflate/ZIP bombs, arbitrary paths, duplicate names or filesystem writes.
export async function* archiveEntries(file:Blob):AsyncGenerator<ArchiveEntry>{
  if(file.size>archiveByteLimit||file.size<22)throw new Error('Backup troppo grande o incompleto.');
  const tail=new DataView(await file.slice(-22).arrayBuffer());if(tail.getUint32(0,true)!==0x06054b50||tail.getUint16(20,true)!==0)throw new Error('Backup incompleto: scaricalo di nuovo.');
  const expected=tail.getUint16(10,true),seen=new Set<string>(),ready:ArchiveEntry[]=[];let failure:Error|undefined,total=0;
  const unzip=new Unzip(entry=>{
    if(!path.test(entry.name)||entry.compression!==0||seen.has(entry.name)||seen.size>=601){failure=new Error('Contenuto ZIP non supportato.');return;}
    seen.add(entry.name);const chunks:Uint8Array[]=[];let size=0;
    entry.ondata=(error,data,final)=>{if(error){failure=error;return;}size+=data.length;total+=data.length;
      const limit=entry.name.startsWith('media/')?6_000_000:250_000;
      if(size>limit||total>265_000_000){failure=new Error('Dimensione dei file nel backup non valida.');entry.terminate();return;}
      chunks.push(data);if(final){const joined=new Uint8Array(size);let at=0;for(const part of chunks){joined.set(part,at);at+=part.length;}ready.push({name:entry.name,data:joined});}
    };entry.start();
  });
  // Feed small slices, awaiting the caller between completed files. Unzip never
  // gets the entire archive or an unbounded number of queued photo buffers.
  for(let at=0;at<file.size;at+=65536){unzip.push(new Uint8Array(await file.slice(at,at+65536).arrayBuffer()),at+65536>=file.size);if(failure)throw failure;while(ready.length)yield ready.shift()!;}
  if(failure)throw failure;if(seen.size!==expected)throw new Error('Indice ZIP incompleto.');
}

export async function inspectArchive(file:Blob){
  const observed:z.infer<typeof entrySchema>[]=[],recipes:{name:string;recipe:Recipe;source:ImportSource}[]=[];let manifest:z.infer<typeof manifestSchema>|undefined,phase='media';
  for await(const entry of archiveEntries(file)){
    if(manifest)throw new Error('Manifest del backup fuori ordine.');
    if(entry.name==='recipeek.json'){manifest=manifestSchema.parse(decode(entry.data));continue;}
    observed.push({name:entry.name,size:entry.data.length,sha256:await digest(entry.data)});
    if(entry.name.startsWith('recipes/')){phase='recipes';const raw=decode(entry.data);const recipe=recipeSchema.parse(raw);recipes.push({name:entry.name,recipe:recipe as Recipe,source:await recipeSource(raw)});if(recipes.length>100)throw new Error('Usa le singole parti del backup (massimo 100 ricette).');}
    else {if(phase!=='media')throw new Error('Ordine dei file del backup non valido.');sanitizePhoto(entry.data,entry.name.endsWith('.jpg')?'image/jpeg':entry.name.endsWith('.png')?'image/png':'image/webp');}
  }
  if(!manifest||JSON.stringify(manifest.entries)!==JSON.stringify(observed))throw new Error('Backup danneggiato: controllo di integrità fallito.');
  const media=new Set(observed.filter(e=>e.name.startsWith('media/')).map(e=>`/api/media/${e.name.slice(6).replace(/\.(jpg|png|webp)$/,'')}`));
  for(const item of recipes)for(const image of photoPaths(item.recipe))if(!media.has(image))throw new Error('Una foto manca dal backup.');
  return recipes;
}
