import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { getChatGPTUser } from '../../chatgpt-auth';
import { recipeSchema } from '../../../lib/model';
import { listRecipes, readRecipe, readableUpload, saveRecipe, removeRecipe } from '../../../lib/repository';
import { HttpError, readLimitedBody, readJsonBody, assertSameOrigin } from '../../../lib/http';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200, headers: Record<string,string> = {}) => Response.json(body, {status, headers: {'cache-control':'private, no-store', 'x-content-type-options':'nosniff', ...headers}});
const methods: Record<string, string[]> = {me:['GET','PATCH'],ingredients:['GET'],recipes:['GET','POST'],'recipes/id':['GET','PATCH','DELETE'],people:['GET'],'follow/id':['POST','DELETE'],media:['POST'],'media/id':['GET']};

async function handle(req: Request) {
  try {
    const user = await getChatGPTUser();
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
    const db = env.DB;
    if (!db) return json({error:'Database non disponibile. Riprova tra poco.'},503);
    await db.prepare('INSERT OR IGNORE INTO profiles (id,name,bio,discoverable,created_at) VALUES (?,?,?,?,?)').bind(user.userId,'Cuoco di casa','',0,new Date().toISOString()).run();

    if (resource === 'me') {
      if (req.method === 'PATCH') {
        const profile = z.object({name:z.string().trim().min(2).max(60),bio:z.string().max(300),discoverable:z.boolean()}).parse(await readJsonBody(req));
        await db.prepare('UPDATE profiles SET name=?,bio=?,discoverable=? WHERE id=?').bind(profile.name,profile.bio,Number(profile.discoverable),user.userId).run();
      }
      return json(await db.prepare('SELECT * FROM profiles WHERE id=?').bind(user.userId).first());
    }
    if (resource === 'ingredients') {
      const result = await db.prepare('SELECT min(i.display) AS name, count(DISTINCT ri.recipe_id) AS recipes FROM ingredients i JOIN recipe_ingredients ri ON ri.ingredient_id=i.id WHERE i.owner_id=? GROUP BY i.canonical ORDER BY i.canonical').bind(user.userId).all();
      return json(result.results);
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
          const owned = await db.prepare('SELECT id FROM uploads WHERE owner_id=? AND id IN (SELECT value FROM json_each(?))').bind(user.userId,JSON.stringify(mediaIds)).all();
          if (owned.results.length !== mediaIds.length) return json({error:'Una foto non appartiene al tuo account. Caricala di nuovo.'},400);
        }
        return json(await saveRecipe(db,user.userId,value.recipe,id,value.updatedAt),id ? 200 : 201);
      }
      if (req.method === 'DELETE' && id) return json({removed:await removeRecipe(db,id,user.userId)});
    }
    if (resource === 'people') {
      const result = await db.prepare("SELECT p.id,p.name,p.bio,p.discoverable,EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=? AND f.followed_id=p.id) AS following,(SELECT count(*) FROM recipes r WHERE r.owner_id=p.id AND r.visibility='shared') AS recipeCount FROM profiles p WHERE p.discoverable=1 AND p.id<>? ORDER BY p.name LIMIT 200").bind(user.userId,user.userId).all();
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
    if (resource === 'media') {
      const bucket = env.BUCKET;
      if (!bucket) return json({error:'Archivio foto non disponibile.'},503);
      if (req.method === 'POST') {
        const type = req.headers.get('content-type') || '';
        if (!['image/jpeg','image/png','image/webp'].includes(type)) return json({error:'Usa una foto JPEG, PNG o WebP.'},400);
        const data = await readLimitedBody(req,6_000_000);
        if (data.byteLength < 12) return json({error:'Dimensione foto non valida.'},400);
        const b = data;
        const valid = type === 'image/jpeg' ? b[0]===255 && b[1]===216 && b[2]===255 : type === 'image/png' ? b[0]===137 && b[1]===80 && b[2]===78 && b[3]===71 : String.fromCharCode(...b.slice(0,4))==='RIFF' && String.fromCharCode(...b.slice(8,12))==='WEBP';
        if (!valid) return json({error:'Il contenuto non corrisponde al formato della foto.'},400);
        const uploadId = crypto.randomUUID();
        await bucket.put(uploadId,data,{httpMetadata:{contentType:type}});
        try { await db.prepare('INSERT INTO uploads (id,owner_id,name,content_type,created_at) VALUES (?,?,?,?,?)').bind(uploadId,user.userId,'Foto ricetta',type,new Date().toISOString()).run(); }
        catch (e) { await bucket.delete(uploadId); throw e; }
        return json({url:`/api/media/${uploadId}`},201);
      }
      if (id) {
        const upload = await readableUpload(db,id,user.userId);
        if (!upload) return json({error:'Foto non trovata.'},404);
        const object = await bucket.get(id);
        if (!object) return json({error:'Foto non trovata.'},404);
        return new Response(object.body,{headers:{'content-type':upload.content_type,'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
      }
    }
    return json({error:'Operazione non disponibile.'},404);
  } catch (error) {
    if (error instanceof HttpError) return json({error:error.message},error.status);
    if (error instanceof z.ZodError) return json({error:error.issues.map(i => i.message).join('. ')},400);
    if (error instanceof Error && error.message === 'NOT_FOUND') return json({error:'La ricetta è stata eliminata. Le modifiche non sono state salvate.'},404);
    if (error instanceof Error && error.message === 'LIMIT_REACHED') return json({error:'Raggiunto il limite di 1.000 ricette. Esporta il ricettario e libera spazio prima di aggiungerne altre.'},409);
    if (error instanceof Error && error.message === 'CONFLICT') return json({error:'La ricetta è cambiata in un’altra finestra. Ricaricala prima di salvare.'},409);
    if (error instanceof Error && error.message === 'FORBIDDEN') return json({error:'Operazione non consentita.'},403);
    console.error('Recipeek request failed',error instanceof Error ? (import.meta.env.DEV ? error.message : error.name) : 'Unknown');
    return json({error:'Non siamo riusciti a completare l’operazione. Riprova tra poco.'},500);
  }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
