import { z } from 'zod';
export const categories = ['Antipasti', 'Primi', 'Secondi', 'Contorni', 'Dolci', 'Pane e lievitati', 'Colazione', 'Altro'] as const;
export const methods = ['Fornelli', 'Forno', 'Senza cottura', 'Friggitrice ad aria', 'Vapore', 'Griglia', 'Altro'] as const;
const optionalUrl = z.string().max(1500).refine(v => { if (!v) return true; try { const url = new URL(v); return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password; } catch { return false; } }, 'Usa un link HTTPS valido, senza credenziali');
const media = z.string().max(1500).refine(v => !v || /^\/api\/media\/[a-zA-Z0-9-]+$/.test(v) || /^\/images\/[a-z0-9-]+\.jpg$/.test(v), 'Immagine non valida');
export const recipeSchema = z.object({
  title: z.string().trim().min(2, 'Dai un titolo alla ricetta').max(140), description: z.string().max(3000), category: z.enum(categories), method: z.enum(methods), servings: z.number().int().min(1).max(100), prepMinutes: z.number().int().min(0).max(1440), cookMinutes: z.number().int().min(0).max(1440), image: media, sourceUrl: optionalUrl, sourceAuthor: z.string().max(200), notes: z.string().max(10000), collection: z.string().trim().max(80), favorite: z.boolean(), visibility: z.enum(['private', 'shared']),
  pan: z.object({ shape: z.enum(['round', 'rectangle']), width: z.number().min(1).max(100), length: z.number().min(1).max(100) }).nullable(),
  ingredients: z.array(z.object({ id: z.string().min(1).max(80), name: z.string().trim().min(1).max(150), quantity: z.number().positive().max(100000).nullable(), unit: z.string().max(40) })).min(1, 'Aggiungi almeno un ingrediente').max(100),
  steps: z.array(z.object({ id: z.string().min(1).max(80), text: z.string().trim().min(1).max(5000), image: media, videoUrl: optionalUrl, timerMinutes: z.number().int().min(0).max(1440), ingredients: z.array(z.object({ ingredientId: z.string().max(80), quantity: z.number().positive().max(100000).nullable() })).max(100) })).min(1, 'Aggiungi almeno un passaggio').max(100),
}).superRefine((r, ctx) => {
  const ids = new Set(r.ingredients.map(i => i.id));
  if (ids.size !== r.ingredients.length || new Set(r.steps.map(s => s.id)).size !== r.steps.length) ctx.addIssue({code: 'custom', message: 'Identificativi duplicati'});
  for (const [index, step] of r.steps.entries()) {
    if (new Set(step.ingredients.map(i => i.ingredientId)).size !== step.ingredients.length) ctx.addIssue({code: 'custom', message: 'Ingrediente ripetuto nello stesso passaggio', path: ['steps', index]});
    for (const use of step.ingredients) if (!ids.has(use.ingredientId)) ctx.addIssue({code: 'custom', message: 'Un passaggio fa riferimento a un ingrediente rimosso', path: ['steps', index]});
  }
});
export type RecipeInput = z.infer<typeof recipeSchema>;
export type Recipe = RecipeInput & { id: string; ownerId: string; authorName: string; createdAt: string; updatedAt: string };
export type Profile = { id: string; name: string; bio: string; discoverable: number; following?: boolean; recipeCount?: number };
export function blankRecipe(): RecipeInput { return {title: '', description: '', category: 'Primi', method: 'Fornelli', servings: 2, prepMinutes: 10, cookMinutes: 15, image: '', sourceUrl: '', sourceAuthor: '', notes: '', collection: '', favorite: false, visibility: 'private', pan: null, ingredients: [{id: crypto.randomUUID(), name: '', quantity: null, unit: 'g'}], steps: [{id: crypto.randomUUID(), text: '', image: '', videoUrl: '', timerMinutes: 0, ingredients: []}]}; }
export function ingredientKey(name: string) { return name.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it').replace(/\s+/g, ' '); }
export function formatQuantity(quantity: number | null, factor = 1) { return quantity === null ? 'q.b.' : new Intl.NumberFormat('it-IT', {maximumFractionDigits: 2}).format(quantity * factor); }
export function panArea(pan: NonNullable<RecipeInput['pan']>) { return pan.shape === 'round' ? Math.PI * (pan.width / 2) ** 2 : pan.width * pan.length; }
export function scalingFactor(recipe: RecipeInput, servings: number, targetPan: RecipeInput['pan'] = null) { return recipe.pan && targetPan ? panArea(targetPan) / panArea(recipe.pan) : servings / recipe.servings; }
export function canRead(ownerId: string, visibility: string, userId: string) { return ownerId === userId || visibility === 'shared'; }
export function filterRecipes(recipes: Recipe[], query: string, category: string, method: string, maxMinutes: number, favorite: boolean, collection: string) { const terms = ingredientKey(query).split(' ').filter(Boolean); return recipes.filter(r => (!category || r.category === category) && (!method || r.method === method) && (!maxMinutes || r.prepMinutes + r.cookMinutes <= maxMinutes) && (!favorite || r.favorite) && (!collection || r.collection === collection) && terms.every(t => ingredientKey([r.title, r.description, ...r.ingredients.map(i => i.name)].join(' ')).includes(t))); }
