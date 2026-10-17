import { ingredientKey, recipeSchema, type Recipe, type RecipeInput } from './model.ts';
export type Database = Pick<D1Database, 'prepare' | 'batch'>;
type Row = {id: string; owner_id: string; document: string; created_at: string; updated_at: string; author_name: string};
export function decodeRecipe(row: Row): Recipe { return {...JSON.parse(row.document), id: row.id, ownerId: row.owner_id, authorName: row.author_name, createdAt: row.created_at, updatedAt: row.updated_at}; }
export async function listRecipes(db: Database, user: string, scope: 'mine' | 'community' = 'mine') { const result = await db.prepare(`SELECT r.*, p.name AS author_name FROM recipes r JOIN profiles p ON p.id=r.owner_id WHERE ${scope === 'mine' ? 'r.owner_id=?' : "r.visibility='shared'"} ORDER BY r.updated_at DESC LIMIT 1000`).bind(...(scope === 'mine' ? [user] : [])).all<Row>(); return result.results.map(decodeRecipe); }
export async function readRecipe(db: Database, id: string, user: string) { const row = await db.prepare("SELECT r.*, p.name AS author_name FROM recipes r JOIN profiles p ON p.id=r.owner_id WHERE r.id=? AND (r.owner_id=? OR r.visibility='shared')").bind(id,user).first<Row>(); return row ? decodeRecipe(row) : null; }
export async function saveRecipe(db: Database, user: string, input: RecipeInput, requestedId?: string, expectedUpdatedAt?: string) {
  const id = requestedId ?? crypto.randomUUID();
  const doc = recipeSchema.parse(input);
  const existing = await db.prepare('SELECT owner_id, updated_at FROM recipes WHERE id=?').bind(id).first<{owner_id:string; updated_at:string}>();
  if (requestedId && !existing) throw new Error('NOT_FOUND');
  if (existing && existing.owner_id !== user) throw new Error('FORBIDDEN');
  if (existing && expectedUpdatedAt !== existing.updated_at) throw new Error('CONFLICT');
  const now = new Date(Math.max(Date.now(),existing ? Date.parse(existing.updated_at)+1 : 0)).toISOString();
  const document = JSON.stringify(doc);
  const statements: D1PreparedStatement[] = [];
  if (existing) statements.push(db.prepare('UPDATE recipes SET title=?,category=?,method=?,visibility=?,favorite=?,collection=?,document=?,updated_at=? WHERE id=? AND owner_id=? AND updated_at=?').bind(doc.title,doc.category,doc.method,doc.visibility,Number(doc.favorite),doc.collection,JSON.stringify(doc),now,id,user,expectedUpdatedAt));
  else statements.push(db.prepare('INSERT INTO recipes (id,owner_id,title,category,method,visibility,favorite,collection,document,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM recipes WHERE owner_id=?)<1000').bind(id,user,doc.title,doc.category,doc.method,doc.visibility,Number(doc.favorite),doc.collection,document,now,now,user));
  const guard = 'EXISTS(SELECT 1 FROM recipes WHERE id=? AND owner_id=? AND updated_at=? AND document=?)';
  statements.push(db.prepare(`DELETE FROM recipe_ingredients WHERE recipe_id=? AND ${guard}`).bind(id,id,user,now,document));
  const indexedIngredients = JSON.stringify([...new Map(doc.ingredients.map(i => [ingredientKey(i.name), i])).values()].map(i => { const canonical = ingredientKey(i.name); return {id:JSON.stringify([user,canonical]),canonical,display:i.name}; }));
  statements.push(db.prepare(`INSERT OR IGNORE INTO ingredients (id,owner_id,canonical,display) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.canonical'),json_extract(value,'$.display') FROM json_each(?) WHERE ${guard}`).bind(user,indexedIngredients,id,user,now,document));
  statements.push(db.prepare(`INSERT INTO recipe_ingredients (recipe_id,ingredient_id) SELECT ?,json_extract(value,'$.id') FROM json_each(?) WHERE ${guard}`).bind(id,indexedIngredients,id,user,now,document));
  const results = await db.batch(statements);
  if (results[0].meta.changes === 0) throw new Error(existing ? 'CONFLICT' : 'LIMIT_REACHED');
  return (await readRecipe(db,id,user))!;
}
export async function removeRecipe(db: Database, id: string, user: string) { const existing = await db.prepare('SELECT id FROM recipes WHERE id=? AND owner_id=?').bind(id,user).first(); if (!existing) return false; await db.batch([db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id=?').bind(id),db.prepare('DELETE FROM recipes WHERE id=? AND owner_id=?').bind(id,user)]); return true; }

export async function readableUpload(db: Database, id: string, user: string) {
  const upload = await db.prepare("SELECT owner_id,content_type FROM uploads WHERE id=? AND state='ready'").bind(id).first<{owner_id:string;content_type:string}>();
  if (!upload) return null;
  if (upload.owner_id === user) return upload;
  const path = `/api/media/${id}`;
  const shared = await db.prepare("SELECT 1 FROM recipes WHERE owner_id=? AND visibility='shared' AND (json_extract(document,'$.image')=? OR EXISTS(SELECT 1 FROM json_each(document,'$.steps') WHERE json_extract(value,'$.image')=?)) LIMIT 1").bind(upload.owner_id,path,path).first();
  return shared ? upload : null;
}
