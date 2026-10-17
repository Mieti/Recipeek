import {archiveEntries,inspectArchive,photoPaths,recipeSource} from './archive.ts';
import {parseBackup,backupByteLimit} from './backup.ts';
import type {Recipe,RecipeInput} from './model.ts';
import type {ImportSource} from './repository.ts';

type ImportResult={recipe:Recipe|null;duplicate:boolean};
type RestoreApi={check:(sources:ImportSource[])=>Promise<boolean[]>;photo:(data:Uint8Array,type:string)=>Promise<string>;recipe:(recipe:RecipeInput,source:ImportSource)=>Promise<ImportResult>};
// Validate the entire part before any write; a retry uses stable source IDs and
// content-addressed photos. Interrupted restores never overwrite existing data.
export async function restoreBackup(file:Blob,isZip:boolean,api:RestoreApi,onProgress:(text:string)=>void,onRecipe:(recipe:Recipe)=>void){
  let items:{recipe:RecipeInput;source:ImportSource}[];
  if(isZip){onProgress('Controllo integrità del backup…');items=await inspectArchive(file);}
  else {
    if(file.size>backupByteLimit)throw new Error('Il JSON supera 5 MB: importa le singole parti esportate.');
    const raw=JSON.parse(await file.text()),parsed=parseBackup(raw);items=[];
    for(let i=0;i<parsed.length;i++)items.push({recipe:parsed[i],source:await recipeSource(raw.recipes[i])});
  }
  const existing=await api.check(items.map(item=>item.source)),missing=items.filter((_,i)=>!existing[i]),needed=new Set(missing.flatMap(item=>photoPaths(item.recipe)));
  const images=new Map<string,string>();let imported=0,skipped=items.length-missing.length;
  try {
    if(isZip&&missing.length){for await(const entry of archiveEntries(file)){if(!entry.name.startsWith('media/'))continue;
      const original=`/api/media/${entry.name.slice(6).replace(/\.(jpg|png|webp)$/,'')}`;if(!needed.has(original))continue;
      const type=entry.name.endsWith('.jpg')?'image/jpeg':entry.name.endsWith('.png')?'image/png':'image/webp';
      onProgress(`Ripristino foto ${images.size+1} di ${needed.size}…`);images.set(original,await api.photo(entry.data,type));
      await new Promise(resolve=>setTimeout(resolve,250));
    }}
    for(const item of missing){
      const replace=(path:string)=>{if(!path.startsWith('/api/media/'))return path;const image=images.get(path);if(!image)throw new Error('Una foto non è stata ripristinata.');return image;};
      const recipe={...item.recipe,visibility:'private' as const,image:replace(item.recipe.image),steps:item.recipe.steps.map(step=>({...step,image:replace(step.image)}))};
      const result=await api.recipe(recipe,item.source);if(result.duplicate)skipped++;else if(result.recipe){imported++;onRecipe(result.recipe);}
      onProgress(`Ripristinate ${imported} ricette; ${skipped} già presenti.`);await new Promise(resolve=>setTimeout(resolve,250));
    }
  }catch(error){throw new Error(`Ripristino interrotto: ${imported} ricette aggiunte, ${images.size} foto caricate. Puoi riprovare lo stesso file senza duplicare quanto già completato. ${(error as Error).message}`);}
  return {imported,skipped};
}
