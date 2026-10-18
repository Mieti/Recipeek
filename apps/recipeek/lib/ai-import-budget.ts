import type {Database} from './repository.ts';
import type {ImportEnv,Usage} from './ai-import-provider.ts';
import {HttpError} from './http.ts';

function configured(raw:string|undefined,fallback:number,max:number){
  if(raw===undefined||raw==='')return fallback;
  if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(raw))throw new HttpError(503,'Configurazione del budget importazioni non valida.');
  const value=Number(raw);if(value>max)throw new HttpError(503,'Configurazione del budget importazioni non valida.');return value;
}
export function aiAllowed(env:ImportEnv,owner:string){const ids=env.RECIPEEK_AI_ALLOWED_PROFILES?.split(',').map(s=>s.trim()).filter(Boolean);return !ids?.length||ids.includes(owner);}
export async function reserveImportBudget(db:Database,id:string,job:string,owner:string,provider:'gemini'|'supadata',stage:string,env:ImportEnv,photos=true){
  const month=new Date().toISOString().slice(0,7),created=new Date().toISOString();
  // Unknown outcomes keep a conservative reservation. This is separate from the provider invoice.
  const amount=provider==='gemini'?(photos?2_000_000:500_000):stage==='videoStart'?15:1;
  const limit=provider==='gemini'?Math.floor(configured(env.RECIPEEK_AI_MONTHLY_BUDGET_USD,5,1000)*1_000_000):Math.floor(configured(env.RECIPEEK_SUPADATA_MONTHLY_CREDITS,100,100000));
  const result=await db.prepare('INSERT INTO ai_import_budget (id,job_id,owner_id,provider,month,charge,known,created_at) SELECT ?,?,?,?,?,?,0,? WHERE coalesce((SELECT sum(charge) FROM ai_import_budget WHERE provider=? AND month=?),0)+?<=?').bind(id,job,owner,provider,month,amount,created,provider,month,amount,limit).run();
  if(!result.meta.changes)throw new HttpError(429,provider==='gemini'?'Budget mensile AI raggiunto o impegnato in analisi dall’esito sconosciuto. La fonte è conservata.':'Quota mensile di acquisizione raggiunta o impegnata. La fonte è conservata.');
}
export async function settleImportBudget(db:Database,id:string,provider:'gemini'|'supadata',sent:boolean,usage:Usage|undefined,credits:string|null){
  let charge:number|undefined;
  if(!sent||usage?.outcome==='rejected')charge=0;
  else if(provider==='gemini'&&usage&&usage.input!==null&&usage.output!==null&&usage.thought!==null){
    // Interactions reports output and thought separately; both are billable output.
    const multiplier=new Date().toISOString().slice(0,10)>='2027-01-01'?2:1;
    charge=Math.ceil(multiplier*(usage.input*.75+(usage.output+usage.thought)*3.75));
  }else if(provider==='supadata'&&credits!==null&&credits.trim()!==''&&Number.isFinite(Number(credits))&&Number(credits)>=0)charge=Math.ceil(Number(credits));
  if(charge!==undefined)await db.prepare('UPDATE ai_import_budget SET charge=?,known=1 WHERE id=?').bind(charge,id).run();
}
