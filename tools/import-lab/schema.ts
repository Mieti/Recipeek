import { z } from 'zod';

export const evidenceSchema = z.object({
  sourceId: z.string().min(1).max(80),
  quote: z.string().min(1).max(2000),
}).strict();

export const draftSchema = z.object({
  classification: z.enum(['recipe', 'partial_recipe', 'not_recipe', 'insufficient_content']),
  title: z.string().max(200).nullable(),
  description: z.string().max(2000).nullable(),
  servings: z.number().positive().max(10000).nullable(),
  servingsEvidence: evidenceSchema.nullable(),
  prepMinutes: z.number().nonnegative().max(100000).nullable(),
  cookMinutes: z.number().nonnegative().max(100000).nullable(),
  category: z.string().max(100).nullable(),
  cookingMethods: z.array(z.string().max(80)).max(10),
  ingredients: z.array(z.object({
    id: z.string().regex(/^i\d+$/),
    name: z.string().min(1).max(200),
    quantity: z.number().positive().max(1000000).nullable(),
    unit: z.string().max(80).nullable(),
    originalText: z.string().min(1).max(1000),
    evidence: evidenceSchema,
  }).strict()).max(80),
  steps: z.array(z.object({
    id: z.string().regex(/^s\d+$/),
    text: z.string().min(1).max(3000),
    ingredientIds: z.array(z.string().regex(/^i\d+$/)).max(80),
    evidence: evidenceSchema,
  }).strict()).max(60),
  missingInformation: z.array(z.string().max(500)).max(40),
}).strict();

export type Draft = z.infer<typeof draftSchema>;
export type Source = { id: string; kind: 'text' | 'caption' | 'transcript' | 'web' | 'photo'; text: string; label: string };
export type Photo = { name: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string };
export type Material = { sources: Source[]; photos: Photo[]; warnings: string[]; url?: string; credits: number | null; creditsAreEstimate: boolean };
export type Validation = { warnings: string[]; blocking: string[] };

const photoSchema = z.object({
  name: z.string().min(1).max(200),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  data: z.string().min(4).max(12_000_000),
}).strict();

export const inputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('url'), url: z.string().url().max(2048), recipeIndex: z.number().int().nonnegative().optional() }).strict(),
  z.object({ kind: z.literal('text'), text: z.string().trim().min(10).max(24000) }).strict(),
  z.object({ kind: z.literal('photos'), photos: z.array(photoSchema).min(1).max(4) }).strict(),
]);
export type ImportInput = z.infer<typeof inputSchema>;

const normalized = (text: string) => text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

export function validateDraft(draft: Draft, sources: Source[], allowUserEdits = false): Validation {
  const warnings: string[] = [];
  const blocking: string[] = [];
  if (!['recipe', 'partial_recipe'].includes(draft.classification)) blocking.push('Il contenuto non è ancora una ricetta salvabile.');
  if (!draft.title || !draft.ingredients.length || !draft.steps.length) blocking.push('Servono titolo, ingredienti e almeno un passaggio.');
  const ids = new Set(draft.ingredients.map(i => i.id));
  if (ids.size !== draft.ingredients.length) blocking.push('Identificativi ingredienti duplicati.');
  if (new Set(draft.steps.map(s => s.id)).size !== draft.steps.length) blocking.push('Identificativi passaggi duplicati.');
  for (const step of draft.steps) {
    if (step.ingredientIds.some(id => !ids.has(id))) blocking.push(`${step.id}: riferimento a un ingrediente inesistente.`);
  }
  const checkEvidence = (e: z.infer<typeof evidenceSchema>, label: string) => {
    if (allowUserEdits && e.sourceId === 'user') return;
    const source = sources.find(s => s.id === e.sourceId);
    if (!source) { blocking.push(`${label}: fonte inesistente.`); return; }
    if (source.kind === 'photo') {
      warnings.push(`${label}: confrontare la lettura con la foto originale.`);
    } else if (!normalized(source.text).includes(normalized(e.quote))) {
      warnings.push(`${label}: citazione non riscontrata nel testo acquisito.`);
    }
  };
  for (const ingredient of draft.ingredients) {
    checkEvidence(ingredient.evidence, ingredient.name);
    if (ingredient.quantity !== null && ingredient.evidence.sourceId !== 'user' && !numbersIn(ingredient.evidence.quote).some(n => Math.abs(n - ingredient.quantity!) < 0.000001)) {
      warnings.push(`${ingredient.name}: quantità numerica non riscontrata nella citazione; verificare prima di confermare.`);
    }
    if (ingredient.quantity === null) warnings.push(`${ingredient.name}: quantità assente o qualitativa, controllare «${ingredient.originalText}».`);
    if (!draft.steps.some(s => s.ingredientIds.includes(ingredient.id))) warnings.push(`${ingredient.name}: nessun passaggio collegato.`);
  }
  for (const step of draft.steps) checkEvidence(step.evidence, step.id);
  if (draft.servings !== null && !draft.servingsEvidence) warnings.push('Porzioni senza riferimento alla fonte.');
  if (draft.servingsEvidence) checkEvidence(draft.servingsEvidence, 'Porzioni');
  warnings.push(...draft.missingInformation);
  return { warnings: [...new Set(warnings)], blocking: [...new Set(blocking)] };
}

function numbersIn(text: string): number[] {
  const expanded = text.replaceAll('½', ' 1/2').replaceAll('¼', ' 1/4').replaceAll('¾', ' 3/4').replaceAll('⅓', ' 1/3').replaceAll('⅔', ' 2/3');
  const tokens = expanded.match(/\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?/g) ?? [];
  return tokens.map(token => { const parts = token.replace(',', '.').split('/').map(Number); return parts.length === 2 ? parts[0]! / parts[1]! : parts[0]!; });
}

export function validatePhotos(photos: Photo[]): void {
  let total = 0;
  for (const photo of photos) {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(photo.data) || photo.data.length % 4 !== 0) throw new Error('Immagine base64 non valida.');
    const bytes = Buffer.from(photo.data, 'base64');
    total += bytes.length;
    const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!(photo.mimeType === 'image/png' ? png : photo.mimeType === 'image/jpeg' ? jpeg : webp)) throw new Error('Formato immagine incoerente. Usare JPEG, PNG o WebP.');
    if (bytes.length > 8_000_000) throw new Error('Ogni foto deve essere inferiore a 8 MB.');
  }
  if (total > 12_000_000) throw new Error('Le foto insieme devono essere inferiori a 12 MB.');
}
