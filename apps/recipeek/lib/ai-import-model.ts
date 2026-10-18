import {z} from 'zod';
import {recipeSchema, type RecipeInput} from './model.ts';
import {canonicalUnit} from './units.ts';

export const sourceSchema=z.object({id:z.string().max(80),kind:z.enum(['text','caption','transcript','web','photo','video']),text:z.string().max(24000),label:z.string().max(200)});
export type ImportSource=z.infer<typeof sourceSchema>;
const evidence=z.object({sourceId:z.string().max(80),quote:z.string().max(1000)}).strict();
export const extractedSchema=z.object({
  classification:z.enum(['recipe','partial_recipe','not_recipe','insufficient_content']),
  title:z.string().max(140),description:z.string().max(3000),
  servings:z.number().int().min(1).max(100).nullable(),prepMinutes:z.number().int().min(0).max(1440).nullable(),cookMinutes:z.number().int().min(0).max(1440).nullable(),
  servingsEvidence:evidence.nullable(),prepEvidence:evidence.nullable(),cookEvidence:evidence.nullable(),
  ingredients:z.array(z.object({id:z.string().regex(/^i\d+$/),name:z.string().min(1).max(150),quantity:z.number().positive().max(100000).nullable(),unit:z.string().max(40),originalText:z.string().max(1000),evidence}).strict()).max(80),
  steps:z.array(z.object({id:z.string().regex(/^s\d+$/),text:z.string().min(1).max(5000),ingredientIds:z.array(z.string().max(80)).max(80),evidence}).strict()).max(60),
  missing:z.array(z.string().max(500)).max(30),conflicts:z.array(z.string().max(500)).max(20),needsVisual:z.boolean(),
  suggestions:z.array(z.object({id:z.string().regex(/^p\d+$/),target:z.string().max(80),field:z.enum(['quantity','text','servings','prepMinutes','cookMinutes']),value:z.string().max(2000),reason:z.string().max(500)}).strict()).max(15),
}).strict();
export type Extraction=z.infer<typeof extractedSchema>;
export type ImportInput={kind:'text'|'url'|'photos';text?:string;url?:string;photos?:string[]};
export const importInputSchema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('text'),text:z.string().trim().min(10).max(24000)}).strict(),
  z.object({kind:z.literal('url'),url:z.string().max(2000)}).strict(),
  z.object({kind:z.literal('photos'),photos:z.array(z.string().regex(/^\/api\/media\/[a-zA-Z0-9-]+$/)).min(1).max(4)}).strict(),
]);
export function publicImportUrl(raw:string){
  const u=new URL(raw),h=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||!h.includes('.')||/^[\d.]+$/.test(h)||h.includes(':')||/(^|\.)(localhost|local|internal|test|invalid|example)$/.test(h))throw new Error('Usa un URL HTTPS pubblico, senza credenziali o indirizzi IP.');
  for(const key of [...u.searchParams.keys()])if(key.startsWith('utm_')||['igsh','igshid','fbclid'].includes(key))u.searchParams.delete(key);
  u.hash='';return u;
}
export function socialUrl(url:string){const h=new URL(url).hostname;return ['instagram.com','tiktok.com','youtube.com','youtu.be'].some(d=>h===d||h.endsWith('.'+d));}
const norm=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
export function evidenceNumbers(text:string){
  const fractions:Record<string,string>={'½':'1/2','¼':'1/4','¾':'3/4','⅓':'1/3','⅔':'2/3','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8'};
  const expanded=text.replace(/(\d)([½¼¾⅓⅔⅛⅜⅝⅞])/g,'$1 $2').replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/g,c=>fractions[c]).normalize('NFKC').replaceAll('⁄','/');
  return (expanded.match(/\d+\s+\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?/g)??[]).map(t=>{
    const mixed=t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);if(mixed)return Number(mixed[1])+Number(mixed[2])/Number(mixed[3]);
    const n=t.replace(',','.').split('/').map(Number);return n.length===2?n[0]/n[1]:n[0];
  });
}
export function validateExtraction(d:Extraction,sources:ImportSource[]){
  const warnings:string[]=[...d.missing,...d.conflicts],blocking:string[]=[];
  if(!['recipe','partial_recipe'].includes(d.classification))blocking.push('La fonte non contiene una ricetta sufficientemente riconoscibile.');
  if(d.title.trim().length<2||!d.ingredients.length||!d.steps.length)blocking.push('Servono un titolo, ingredienti e procedimento.');
  const ids=new Set(d.ingredients.map(i=>i.id));
  if(ids.size!==d.ingredients.length||new Set(d.steps.map(s=>s.id)).size!==d.steps.length||new Set(d.suggestions.map(s=>s.id)).size!==d.suggestions.length)blocking.push('Identificativi duplicati nella risposta.');
  const check=(e:z.infer<typeof evidence>|null,label:string)=>{
    const source=e&&sources.find(s=>s.id===e.sourceId);
    if(!source||!e?.quote){warnings.push(`${label}: evidenza assente.`);return;}
    if(['photo','video'].includes(source.kind)){warnings.push(`${label}: lettura visiva da verificare nella fonte.`);return;}
    if(!norm(source.text).includes(norm(e.quote)))warnings.push(`${label}: citazione non riscontrata nella fonte.`);
  };
  for(const i of d.ingredients){check(i.evidence,i.name);if(i.quantity===null&&!/q\.?\s*b\.?|quanto basta|a piacere/i.test(i.originalText))warnings.push(`${i.name}: quantità non specificata.`);
    if(i.quantity!==null){
      const numbers=evidenceNumbers(i.evidence.quote);
      if(!numbers.some(n=>Math.abs(n-i.quantity!)<0.000001)||!norm(i.evidence.quote).includes(norm(i.name))||numbers.length>1)warnings.push(`${i.name}: verificare l’associazione tra ingrediente, dose e unità nella citazione.`);
      const units=(norm(i.evidence.quote).match(/\p{L}+/gu)??[]).map(canonicalUnit);
      if(i.unit&&!units.includes(canonicalUnit(i.unit)))warnings.push(`${i.name}: unità da verificare rispetto alla fonte.`);
    }
  }
  for(const s of d.steps){check(s.evidence,`Passaggio ${s.id}`);if(s.ingredientIds.some(id=>!ids.has(id)))blocking.push('Un passaggio cita un ingrediente inesistente.');}
  for(const [v,e,label] of [[d.servings,d.servingsEvidence,'Porzioni'],[d.prepMinutes,d.prepEvidence,'Preparazione'],[d.cookMinutes,d.cookEvidence,'Cottura']] as const)if(v!==null)check(e,label);
  if(d.servings===null)warnings.push('Numero di porzioni da specificare prima del ricalcolo.');
  if(d.prepMinutes===null)warnings.push('Tempo di preparazione non specificato.');
  if(d.cookMinutes===null)warnings.push('Tempo di cottura non specificato.');
  if(sources.some(s=>/(dosi|ingredienti|quantit[aà]).{0,35}(video|schermo|immagine)|vedi.{0,20}(video|foto)|seconda (foto|immagine)/i.test(s.text)))warnings.push('Il testo rimanda a informazioni visive.');
  return {warnings:[...new Set(warnings)],blocking:[...new Set(blocking)]};
}
export function needsMore(d:Extraction,sources:ImportSource[]){const v=validateExtraction(d,sources);return d.classification==='partial_recipe'||d.classification==='insufficient_content'||d.needsVisual||d.conflicts.length>0||d.missing.length>0||v.warnings.some(w=>!/^(Numero di porzioni|Tempo di preparazione|Tempo di cottura)/.test(w)&&!w.includes('associazione')&&!w.includes('unità da verificare'))||v.blocking.length>0;}
export function recipeFromExtraction(d:Extraction,url=''):RecipeInput{
  return {title:d.title,description:d.description,category:'Altro',method:'Altro',servings:d.servings??1,prepMinutes:d.prepMinutes??0,cookMinutes:d.cookMinutes??0,image:'',sourceUrl:url,sourceAuthor:'',notes:'',collection:'',favorite:false,visibility:'private',pan:null,
    ingredients:d.ingredients.map(i=>({id:i.id,name:i.name,quantity:i.quantity,quantityKind:i.quantity===null?(/q\.?\s*b\.?|quanto basta|a piacere/i.test(i.originalText)?"to_taste" as const:"unspecified" as const):undefined,unit:i.unit})),steps:d.steps.map(s=>({id:s.id,text:s.text,image:'',videoUrl:'',timerMinutes:0,ingredients:s.ingredientIds.map(ingredientId=>({ingredientId,quantity:null}))}))};
}
export type SuggestionDecision={id:string;status:'accepted'|'edited'|'rejected';value:string};
export function applySuggestion(recipe:RecipeInput,s:Extraction['suggestions'][number],value:string):RecipeInput{
  const r=structuredClone(recipe);
  const shape=recipeSchema.innerType().shape;
  if(s.field==='quantity'){const i=r.ingredients.find(i=>i.id===s.target);if(!i)throw new Error('Ingrediente non trovato.');i.quantity=shape.ingredients.element.shape.quantity.parse(Number(value.replace(',','.')));}
  else if(s.field==='text'){const step=r.steps.find(i=>i.id===s.target);if(!step)throw new Error('Passaggio non trovato.');step.text=shape.steps.element.shape.text.parse(value);}
  else r[s.field]=shape[s.field].parse(Number(value.replace(',','.')));
  return r;
}
