import type {Database} from './repository.ts';
import type {ImportEnv} from './ai-import-provider.ts';
import {importBudgetLimits} from './ai-import-budget.ts';

export function isImportAdmin(env:ImportEnv,owner:string){return !!owner&&!!env.RECIPEEK_IMPORT_ADMIN_PROFILES?.split(',').map(v=>v.trim()).filter(Boolean).includes(owner);}
export async function importMetrics(db:Database,env:ImportEnv){
  const month=new Date().toISOString().slice(0,7),limits=importBudgetLimits(env);
  const [states,outcomes,budget,tokens,latency,queue]=await Promise.all([
    db.prepare('SELECT status,count(*) AS count FROM ai_imports WHERE created_at>=? GROUP BY status').bind(month).all<{status:string;count:number}>(),
    db.prepare("SELECT coalesce(json_extract(document,'$.draft.classification'),json_extract(document,'$.resultClassification'),'unknown') AS classification,count(*) AS count FROM ai_imports WHERE created_at>=? GROUP BY classification").bind(month).all<{classification:string;count:number}>(),
    db.prepare('SELECT provider,sum(CASE WHEN known=1 THEN charge ELSE 0 END) AS known,sum(CASE WHEN known=0 THEN charge ELSE 0 END) AS reserved,count(*) AS calls,sum(CASE WHEN known=0 THEN 1 ELSE 0 END) AS uncertain FROM ai_import_budget WHERE month=? GROUP BY provider').bind(month).all<{provider:string;known:number;reserved:number;calls:number;uncertain:number}>(),
    db.prepare("SELECT coalesce(sum(json_extract(u.value,'$.input')),0) AS input,coalesce(sum(json_extract(u.value,'$.output')),0) AS output,coalesce(sum(json_extract(u.value,'$.thought')),0) AS thought FROM ai_imports a,json_each(a.document,'$.usage') u WHERE a.created_at>=?").bind(month).first<{input:number;output:number;thought:number}>(),
    db.prepare("SELECT count(*) AS measured,avg((julianday(json_extract(document,'$.completedAt'))-julianday(created_at))*86400) AS seconds FROM ai_imports WHERE created_at>=? AND json_extract(document,'$.completedAt') IS NOT NULL").bind(month).first<{measured:number;seconds:number|null}>(),
    db.prepare("SELECT last_tick FROM ai_queue_state WHERE id='imports'").first<{last_tick:number}>(),
  ]);
  return {month,states:states.results,outcomes:outcomes.results,budget:(['gemini','supadata'] as const).map(provider=>{const row=budget.results.find(b=>b.provider===provider),scale=provider==='gemini'?1_000_000:1;const known=(row?.known??0)/scale,reserved=(row?.reserved??0)/scale;return {provider,known,reserved,limit:limits[provider],remaining:Math.max(0,limits[provider]-known-reserved),calls:row?.calls??0,uncertain:row?.uncertain??0};}),tokens,latency,lastTick:queue?.last_tick??null,video:env.RECIPEEK_IMPORT_VIDEO==='true',estimated:true};
}
export type ImportMetrics=Awaited<ReturnType<typeof importMetrics>>;
