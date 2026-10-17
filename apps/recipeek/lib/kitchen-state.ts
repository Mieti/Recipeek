import { z } from 'zod';
import { recipeSchema } from './model.ts';

type StorageLike = Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const memory = new Map<string,string>();
function browserStorage(): StorageLike | null { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }
export function readKitchenState(key:string, storage:StorageLike|null=browserStorage()) { if(memory.has(key))return memory.get(key)!;try { return storage?.getItem(key) ?? null; } catch { return null; } }
export function writeKitchenState(key:string,value:string,storage:StorageLike|null=browserStorage()) { memory.set(key,value); try { storage?.setItem(key,value); } catch {} }
export function removeKitchenState(key:string,storage:StorageLike|null=browserStorage()) { memory.delete(key); try { storage?.removeItem(key); } catch {} }
export function clearKitchenState(userId:string) {
  const ownKey=(key:string)=>key===`recipeek:cooking:${userId}`||key.startsWith(`recipeek:timer:${userId}:`)||key.startsWith(`recipeek:draft:${userId}:`);
  for(const key of memory.keys())if(ownKey(key))memory.delete(key);
  try { const storage=window.localStorage; for(const key of Object.keys(storage))if(ownKey(key))storage.removeItem(key); } catch {}
}
const sessionSchema=z.object({recipe:recipeSchema.and(z.object({id:z.string().min(1),ownerId:z.string().min(1),authorName:z.string(),createdAt:z.string(),updatedAt:z.string()})),servings:z.number().int().min(1).max(100),factor:z.number().finite().positive(),step:z.number().int().min(0)}).refine(s=>s.step<s.recipe.steps.length);
export function parseCookingSession(raw:string|null) { try { return raw ? sessionSchema.parse(JSON.parse(raw)) : null; } catch { return null; } }
export type TimerState={end:number|null;remaining:number;expired:boolean};
export function parseTimerState(raw:string|null,durationSeconds:number,now=Date.now()):TimerState {
  try { const data=z.object({end:z.number().finite().positive().nullable().optional(),remaining:z.number().int().min(0).max(86400).optional(),expired:z.boolean().optional()}).parse(JSON.parse(raw||'null')); if(data.end)return {end:data.end>now?data.end:null,remaining:0,expired:data.end<=now}; return {end:null,remaining:data.remaining??(data.expired?0:durationSeconds),expired:Boolean(data.expired)}; }
  catch { return {end:null,remaining:durationSeconds,expired:false}; }
}
export function timerSeconds(state:TimerState,now=Date.now()) { return state.end ? Math.max(0,Math.ceil((state.end-now)/1000)) : state.remaining; }
