import {recipeFromExtraction,type Extraction} from './ai-import-model.ts';
import type {RecipeInput} from './model.ts';
import {canonicalUnit} from './units.ts';

const name=(s:string)=>s.normalize('NFKC').toLocaleLowerCase('it').replace(/\s+/g,' ').trim();
// Fill gaps, preserve manual changes/deletions, and never replace an existing
// procedure by guessing that two independently generated step IDs are equivalent.
export function integrateExtraction(before:Extraction|undefined,next:Extraction,current?:RecipeInput,url=''){
  const draft=structuredClone(next),baseline=before?recipeFromExtraction(before,url):null;
  const recipe:RecipeInput=structuredClone(current??baseline??recipeFromExtraction(next,url));
  if(!current&&!before)return {draft,recipe};
  const used=new Set([...recipe.ingredients.map(i=>i.id),...(before?.ingredients.map(i=>i.id)??[])]),mapping=new Map<string,string>();
  let n=1;
  for(const i of draft.ingredients){
    const old=before?.ingredients.find(old=>name(old.name)===name(i.name));
    while(used.has(`i${n}`))n++;
    const id=old?.id??`i${n++}`;used.add(id);mapping.set(i.id,id);i.id=id;
    const existing=recipe.ingredients.find(v=>v.id===id);
    if(existing){
      const original=baseline?.ingredients.find(v=>v.id===id);
      if(existing.quantity===null&&original?.quantity===null&&existing.quantityKind!=='to_taste'&&existing.unit===original.unit&&existing.name===original.name&&(!existing.unit||canonicalUnit(existing.unit)===canonicalUnit(i.unit))){existing.quantity=i.quantity;if(!existing.unit)existing.unit=i.unit;if(i.quantity!==null)existing.quantityKind=undefined;}
    }else if(!old&&!recipe.ingredients.some(v=>name(v.name)===name(i.name)))recipe.ingredients.push(recipeFromExtraction({...draft,ingredients:[i],steps:[]}).ingredients[0]);
  }
  const stepIds=new Set([...recipe.steps.map(s=>s.id),...(before?.steps.map(s=>s.id)??[])]),stepMapping=new Map<string,string>();let k=1;
  for(const s of draft.steps){while(stepIds.has(`s${k}`))k++;const old=before?.steps.find(v=>name(v.text)===name(s.text));const id=old?.id??`s${k++}`;stepIds.add(id);stepMapping.set(s.id,id);s.id=id;s.ingredientIds=s.ingredientIds.map(id=>mapping.get(id)??id);}
  if(!recipe.steps.length&&!before?.steps.length)recipe.steps=recipeFromExtraction(draft).steps.filter(s=>s.ingredients.every(i=>recipe.ingredients.some(v=>v.id===i.ingredientId)));
  for(const s of draft.suggestions)s.target=s.field==='quantity'?(mapping.get(s.target)??s.target):s.field==='text'?(stepMapping.get(s.target)??s.target):s.target;
  draft.suggestions=draft.suggestions.filter(s=>s.field==='quantity'?recipe.ingredients.some(i=>i.id===s.target):s.field==='text'?recipe.steps.some(step=>step.id===s.target):true);
  if(!recipe.title.trim()&&(!current||!baseline?.title.trim()))recipe.title=draft.title;
  if(!recipe.description.trim()&&(!current||!baseline?.description.trim()))recipe.description=draft.description;
  if((!current&&before?.servings===null)||recipe.servings===0)recipe.servings=draft.servings??0;
  for(const field of ['prepMinutes','cookMinutes'] as const)if(recipe[field]===0&&(!before||before[field]===null))recipe[field]=draft[field]??0;
  return {draft,recipe};
}
