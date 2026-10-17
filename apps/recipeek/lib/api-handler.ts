import { exportArchive } from './export-archive.ts';
import { digest } from './identity.ts';
import { z } from 'zod';
import { recipeSchema } from './model.ts';
import { listRecipes, readRecipe, readableUpload, saveRecipe, removeRecipe, listTrash, restoreRecipe, purgeRecipe, importRecipe, findImported } from './repository.ts';
import { HttpError, readLimitedBody, readJsonBody, assertSameOrigin } from './http.ts';
import { enforceRateLimit, cleanupUploads, storageUsage, storeUpload } from './media-storage.ts';
import { sanitizePhoto } from './photo.ts';

import type {Database} from './repository.ts';
export type ApiUser={userId:string};
const json = (body: unknown, status = 200, headers: Record<string,string> = {}) => Response.json(body, {status, headers: {'cache-control':'private, no-store', 'x-content-type-options':'nosniff', ...headers}});
const methods: Record<string, string[]> = {me:['GET','PATCH'],ingredients:['GET'],recipes:['GET','POST'],'recipes/id':['GET','PATCH','DELETE'],people:['GET'],'follow/id':['POST','DELETE'],media:['POST'],'media/id':['GET'],storage:['GET','POST'],trash:['GET'],'trash/id':['POST','DELETE'],backup:['GET'],imports:['POST'],'imports/id':['POST'],'import-media':['POST']};

export async function handleApi(req:Request,{user,db,bucket}:{user:ApiUser|null;db:Database|undefined;bucket?:R2Bucket}) {
  try {
    if (!user) return json({error:'Accedi per usare il tuo ricettario.'},401);
    assertSameOrigin(req);
    const segments = new URL(req.url).pathname.replace(/^\/api\//,'').split('/');
    const [resource, rawId] = segments;
    const route = rawId ? `${resource}/id` : resource;
    if (segments.length > 2 || !methods[route] || (segments.length===2 && !rawId)) return json({error:'Operazione non disponibile.'},404);
    if (!methods[route].includes(req.method)) return json({error:'Metodo non consentito.'},405,{Allow:methods[route].join(', ')});
    let id: string | undefined;
    if (rawId) {
      try { id = decodeURIComponent(rawId); } catch { throw new HttpError(400,'Identificativo non valido.'); }
      if (id.length>200 || id.includes('/')) throw new HttpError(400,'Identificativo non valido.');
    }
    if (!db) return json({error:'Database non disponibile. Riprova tra poco.'},503);
    await enforceRateLimit(db,user.userId,'api');
    await db.prepare('INSERT OR IGNORE INTO profiles (id,name,bio,discoverable,created_at) VALUES (?,?,?,?,?)').bind(user.userId,'Cuoco di casa','',0,new Date().toISOString()).run();

    if (resource === 'me') {
      if (req.method === 'PATCH') {
        const profile = z.object({name:z.string().trim().min(2).max(60),bio:z.string().max(300),discoverable:z.boolean()}).parse(await readJsonBody(req));
        await db.prepare('UPDATE profiles SET name=?,bio=?,discoverable=? WHERE id=?').bind(profile.name,profile.bio,Number(profile.discoverable),user.userId).run();
      }
      return json(await db.prepare('SELECT * FROM profiles WHERE id=?').bind(user.userId).first());
    }
    if (resource === 'ingredients') {
      const result = await db.prepare('SELECT min(i.display) AS name, count(DISTINCT ri.recipe_id) AS recipes FROM ingredients i JOIN recipe_ingredients ri ON ri.ingredient_id=i.id JOIN recipes r ON r.id=ri.recipe_id WHERE r.deleted_at IS NULL AND i.owner_id=? GROUP BY i.canonical ORDER BY i.canonical').bind(user.userId).all();
      return json(result.results);
    }
    if(resource==='trash') {
      if(!id)return json(await listTrash(db,user.userId));
      if(req.method==='POST'){const recipe=await restoreRecipe(db,id,user.userId);return json(recipe??{error:'Ricetta non trovata nel cestino.'},recipe?200:404);}
      return json({removed:await purgeRecipe(db,id,user.userId)});
    }
    if(resource==='backup') {
      if(!bucket)throw new HttpError(503,'Archivio foto non disponibile.');
      await enforceRateLimit(db,user.userId,'backup');
      const ids=z.array(z.string().regex(/^[a-zA-Z0-9-]{1,80}$/)).min(1).max(100).refine(ids=>new Set(ids).size===ids.length).parse((new URL(req.url).searchParams.get('ids')??'').split(','));
      return await exportArchive(db,bucket,user.userId,ids);
    }
    if(resource==='imports') {
      const source=z.object({key:z.string().min(1).max(500),sourceId:z.string().max(80).optional(),sourceOwner:z.string().max(200).optional()});
      if(id==='check'){const sources=z.array(source).max(100).parse(await readJsonBody(req));const found=[];for(const item of sources)found.push(Boolean(await findImported(db,user.userId,item)));return json(found);}
      if(id)return json({error:'Operazione non disponibile.'},404);
      const value=z.object({recipe:recipeSchema,source}).parse(await readJsonBody(req));
      return json(await importRecipe(db,user.userId,value.recipe,value.source));
    }
    if (resource === 'recipes') {
      if (req.method === 'GET') {
        if (!id) return json(await listRecipes(db,user.userId,new URL(req.url).searchParams.get('scope') === 'community' ? 'community' : 'mine'));
        const recipe = await readRecipe(db,id,user.userId);
        return json(recipe ?? {error:'Ricetta non trovata.'},recipe ? 200 : 404);
      }
      if (req.method === 'POST' || req.method === 'PATCH') {
        const value = z.object({recipe:recipeSchema, updatedAt:z.string().datetime().optional()}).parse(await readJsonBody(req));
        if (id && !(await db.prepare('SELECT id FROM recipes WHERE id=? AND owner_id=?').bind(id,user.userId).first())) return json({error:'Ricetta non trovata.'},404);
        const mediaIds = [...new Set([value.recipe.image,...value.recipe.steps.map(s => s.image)].filter(v => v.startsWith('/api/media/')).map(v => v.split('/').at(-1)!))];
        if (mediaIds.length) {
          const owned = await db.prepare("SELECT id FROM uploads WHERE owner_id=? AND state='ready' AND id IN (SELECT value FROM json_each(?))").bind(user.userId,JSON.stringify(mediaIds)).all();
          if (owned.results.length !== mediaIds.length) return json({error:'Una foto non appartiene al tuo account. Caricala di nuovo.'},400);
        }
        return json(await saveRecipe(db,user.userId,value.recipe,id,value.updatedAt),id ? 200 : 201);
      }
      if (req.method === 'DELETE' && id) return json({removed:await removeRecipe(db,id,user.userId)});
    }
    if (resource === 'people') {
      const result = await db.prepare("SELECT p.id,p.name,p.bio,p.discoverable,EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=? AND f.followed_id=p.id) AS following,(SELECT count(*) FROM recipes r WHERE r.owner_id=p.id AND r.deleted_at IS NULL AND r.visibility='shared') AS recipeCount FROM profiles p WHERE p.discoverable=1 AND p.id<>? ORDER BY p.name LIMIT 200").bind(user.userId,user.userId).all();
      return json(result.results);
    }
    if (resource === 'follow' && id) {
      if (id === user.userId) return json({error:'Non puoi seguire te stesso.'},400);
      if (req.method === 'POST') {
        if (!(await db.prepare('SELECT id FROM profiles WHERE id=? AND discoverable=1').bind(id).first())) return json({error:'Profilo non trovato.'},404);
        await db.prepare('INSERT OR IGNORE INTO follows (follower_id,followed_id) VALUES (?,?)').bind(user.userId,id).run();
      } else await db.prepare('DELETE FROM follows WHERE follower_id=? AND followed_id=?').bind(user.userId,id).run();
      return json({following:req.method === 'POST'});
    }
    if (resource === 'storage') {
      if(req.method==='POST') {
        if(!bucket)return json({error:'Archivio foto non disponibile.'},503);
        const result=await cleanupUploads(db,bucket,user.userId);
        return json({...await storageUsage(db,user.userId),...result});
      }
      return json(await storageUsage(db,user.userId));
    }
    if (resource === 'media'||resource==='import-media') {
      if (!bucket) return json({error:'Archivio foto non disponibile.'},503);
      if (req.method === 'POST') {
        await enforceRateLimit(db,user.userId,resource==='import-media'?'restore':'upload');
        const type = req.headers.get('content-type') || '';
        if (!['image/jpeg','image/png','image/webp'].includes(type)) return json({error:'Usa una foto JPEG, PNG o WebP.'},400);
        const {data} = sanitizePhoto(await readLimitedBody(req,6_000_000),type);
        await cleanupUploads(db,bucket,user.userId);
        const restoredId=resource==='import-media'?`restore-${await digest(JSON.stringify([user.userId,type,await digest(data)]))}`:undefined;
        return json({url:await storeUpload(db,bucket,user.userId,data,type,restoredId)},201);
      }
      if (id) {
        const upload = await readableUpload(db,id,user.userId);
        if (!upload) return json({error:'Foto non trovata.'},404);
        const object = await bucket.get(id);
        if (!object) return json({error:'Foto non trovata.'},404);
        // Also protect previously uploaded photos: never send their original
        // metadata to another viewer. Read through the same bounded sanitizer.
        const {data} = sanitizePhoto(await readLimitedBody(new Request('https://media.internal',{method:'POST',body:object.body,duplex:'half'} as RequestInit),6_000_000),upload.content_type);
        await db.prepare("UPDATE uploads SET byte_size=? WHERE id=? AND owner_id=? AND state='ready'").bind(object.size,id,upload.owner_id).run();
        return new Response(data,{headers:{'content-type':upload.content_type,'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
      }
    }
    return json({error:'Operazione non disponibile.'},404);
  } catch (error) {
    if (error instanceof HttpError) return json({error:error.message},error.status,error.headers);
    if (error instanceof Error && error.message.includes('INVALID_MEDIA')) return json({error:'Una foto non è più disponibile o non appartiene al tuo account. Caricala di nuovo.'},400);
    if (error instanceof z.ZodError) return json({error:error.issues.map(i => i.message).join('. ')},400);
    if (error instanceof Error && error.message === 'NOT_FOUND') return json({error:'La ricetta è stata eliminata. Le modifiche non sono state salvate.'},404);
    if (error instanceof Error && error.message === 'LIMIT_REACHED') return json({error:'Raggiunto il limite di 1.000 ricette. Esporta il ricettario ed elimina definitivamente dal cestino le ricette che non servono prima di aggiungerne altre.'},409);
    if (error instanceof Error && error.message === 'CONFLICT') return json({error:'La ricetta è cambiata in un’altra finestra. Ricaricala prima di salvare.'},409);
    if (error instanceof Error && error.message === 'FORBIDDEN') return json({error:'Operazione non consentita.'},403);
    console.error('Recipeek request failed',error instanceof Error ? (error.name) : 'Unknown');
    return json({error:'Non siamo riusciti a completare l’operazione. Riprova tra poco.'},500);
  }
}

