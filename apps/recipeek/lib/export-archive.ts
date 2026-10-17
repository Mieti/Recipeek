import {decodeRecipe,type Database} from './repository.ts';
import {archiveStream,photoPaths,type ArchiveEntry} from './archive.ts';
import {HttpError,readLimitedBody} from './http.ts';
import {sanitizePhoto} from './photo.ts';

export async function exportArchive(db:Database,bucket:Pick<R2Bucket,'get'>,user:string,ids:string[]){
  const rows=await db.prepare('SELECT r.*,p.name AS author_name FROM recipes r JOIN profiles p ON p.id=r.owner_id WHERE r.owner_id=? AND r.deleted_at IS NULL AND r.id IN (SELECT value FROM json_each(?)) ORDER BY r.id').bind(user,JSON.stringify(ids)).all<Parameters<typeof decodeRecipe>[0]>();
  if(rows.results.length!==ids.length)throw new HttpError(404,'Una ricetta non è più disponibile. Ricarica il ricettario.');
  const recipes=rows.results.map(decodeRecipe),encoder=new TextEncoder();
  if(recipes.reduce((size,r)=>size+encoder.encode(JSON.stringify(r)).length,0)>5_000_000)throw new HttpError(413,'Dividi il ricettario in parti più piccole.');
  const paths=[...new Set(recipes.flatMap(photoPaths))],mediaIds=paths.map(p=>p.slice(11));
  const uploads=await db.prepare("SELECT id,content_type FROM uploads WHERE owner_id=? AND state='ready' AND id IN (SELECT value FROM json_each(?))").bind(user,JSON.stringify(mediaIds)).all<{id:string;content_type:string}>();
  if(uploads.results.length!==mediaIds.length)throw new HttpError(409,'Una foto non è disponibile. Controlla le ricette prima di esportare.');
  async function* entries():AsyncGenerator<ArchiveEntry>{
    for(const upload of uploads.results){const object=await bucket.get(upload.id);if(!object)throw new Error('Foto mancante: ripeti il backup.');
      const {data}=sanitizePhoto(await readLimitedBody(new Request('https://archive.internal',{method:'POST',body:object.body,duplex:'half'} as RequestInit),6_000_000),upload.content_type);
      yield {name:`media/${upload.id}.${upload.content_type==='image/jpeg'?'jpg':upload.content_type.slice(6)}`,data};
    }
    for(const recipe of recipes)yield {name:`recipes/${recipe.id}.json`,data:encoder.encode(JSON.stringify(recipe))};
  }
  return new Response(archiveStream(entries()),{headers:{'content-type':'application/zip','content-disposition':'attachment; filename="recipeek-completo.zip"','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
}
