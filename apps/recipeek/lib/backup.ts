import { z } from 'zod';
import { recipeSchema, type Recipe, type RecipeInput } from './model.ts';
export const backupByteLimit=5_000_000;
export type BackupPart={filename:string;content:string;count:number};
export function prepareBackupParts(recipes:Recipe[]):BackupPart[] {
  const groups:Recipe[][]=[];let group:Recipe[]=[];const date=new Date().toISOString();
  const encode=(list:Recipe[])=>JSON.stringify({format:'recipeek',version:1,exportedAt:date,recipes:list});
  for(const recipe of recipes){if(group.length&&(group.length===100||new TextEncoder().encode(encode([...group,recipe])).byteLength>backupByteLimit)){groups.push(group);group=[];}group.push(recipe);if(new TextEncoder().encode(encode(group)).byteLength>backupByteLimit)throw new Error('Una ricetta è troppo grande per il backup.');}
  if(group.length||!groups.length)groups.push(group);
  return groups.map((list,index)=>({filename:groups.length===1?'recipeek-ricette.json':`recipeek-ricette-${index+1}-di-${groups.length}.json`,content:encode(list),count:list.length}));
}
export function parseBackup(raw:unknown):RecipeInput[] {
  const envelope=z.object({format:z.literal('recipeek'),version:z.literal(1),recipes:z.array(z.unknown()).max(100)}).parse(raw);
  return envelope.recipes.map(item=>{
    const value=z.object({image:z.string(),steps:z.array(z.object({image:z.string()}).passthrough())}).passthrough().parse(item);
    const image=(path:string)=>path.startsWith('/api/media/')?'':path;
    return recipeSchema.parse({...value,image:image(value.image),visibility:'private',steps:value.steps.map(step=>({...step,image:image(step.image)}))});
  });
}
