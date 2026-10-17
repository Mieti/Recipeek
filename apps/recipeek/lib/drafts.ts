import {z} from 'zod';
import {recipeSchema,type Recipe,type RecipeInput} from './model.ts';
const base=recipeSchema.innerType(),number=z.number().finite();
const form=base.extend({title:z.string().max(140),sourceUrl:z.string().max(1500),servings:number,prepMinutes:number,cookMinutes:number,
  pan:z.object({shape:z.enum(['round','rectangle']),width:number,length:number}).nullable(),
  ingredients:z.array(base.shape.ingredients.element.extend({name:z.string().max(150),quantity:number.nullable()})).max(100),
  steps:z.array(base.shape.steps.element.extend({text:z.string().max(5000),videoUrl:z.string().max(1500),timerMinutes:number,ingredients:z.array(z.object({ingredientId:z.string().max(80),quantity:number.nullable()})).max(100)})).max(100),
}).and(z.object({id:z.string().max(80),ownerId:z.string(),authorName:z.string(),createdAt:z.string(),updatedAt:z.string()}).partial());
const schema=z.object({key:z.string().max(80),modifiedAt:z.string().datetime(),section:z.number().int().min(0).max(2),value:form});
export type Draft={key:string;modifiedAt:string;section:number;value:RecipeInput|Recipe};
type DraftStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
function browserStorage(){try{return window.localStorage;}catch{return null;}}
const prefix=(user:string)=>`recipeek:draft:${user}:`;
export function parseDraft(raw:string|null):Draft|null {try{return raw?schema.parse(JSON.parse(raw)) as Draft:null;}catch{return null;}}
export function readDrafts(user:string,storage:DraftStorage|null=browserStorage()):Draft[]{
  if(!storage)return [];const result:Draft[]=[];
  try{for(const key of Object.keys(storage)){if(key.startsWith(prefix(user))){const draft=parseDraft(storage.getItem(key));if(draft&&key===prefix(user)+draft.key&&(!('ownerId'in draft.value)||draft.value.ownerId===user))result.push(draft);}}}catch{}
  return result.sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt));
}
export function writeDraft(user:string,draft:Draft,storage:DraftStorage|null=browserStorage()) {
  try{const encoded=JSON.stringify(schema.parse(draft));if(!storage||new TextEncoder().encode(encoded).length>300_000)return false;storage.setItem(prefix(user)+draft.key,encoded);return true;}catch{return false;}
}
export function discardDraft(user:string,key:string,storage:DraftStorage|null=browserStorage()){try{storage?.removeItem(prefix(user)+key);}catch{}}
