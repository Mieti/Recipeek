export type AuthEnvironment={RECIPEEK_AUTH_MODE?:string;SUPABASE_URL?:string;SUPABASE_PUBLISHABLE_KEY?:string;RECIPEEK_LEGACY_AUTH_ID?:string;RECIPEEK_LEGACY_PROFILE_ID?:string};
export type LegacyAccount={authId:string;profileId:string};
// Operator-supplied migration binding. These IDs never come from browser data.
export function legacyAccount(env:AuthEnvironment):LegacyAccount|null{
  const authId=env.RECIPEEK_LEGACY_AUTH_ID,profileId=env.RECIPEEK_LEGACY_PROFILE_ID;
  if(!authId&&!profileId)return null;
  if(!authId||!profileId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authId)||!/^[a-zA-Z0-9_-]{1,200}$/.test(profileId))throw new Error('Associazione del ricettario precedente non valida');
  return {authId,profileId};
}
export type AuthConfig={url:string;key:string};
export const socialProviders=[{id:'google',name:'Google'},{id:'apple',name:'Apple'},{id:'azure',name:'Microsoft'}] as const;
export function authConfig(env:AuthEnvironment):AuthConfig|null{
  if(!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)return null;
  const url=new URL(env.SUPABASE_URL);
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Configurazione Auth non valida');
  if(!env.SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_'))throw new Error('Usa la chiave publishable di Supabase, mai service_role o secret');
  return {url:url.origin,key:env.SUPABASE_PUBLISHABLE_KEY};
}
export function authMode(env:AuthEnvironment){
  if(env.RECIPEEK_AUTH_MODE&&env.RECIPEEK_AUTH_MODE!=='sites'&&env.RECIPEEK_AUTH_MODE!=='supabase')throw new Error('Modalità Auth non valida');
  return env.RECIPEEK_AUTH_MODE==='supabase'?'supabase':'sites';
}
export function safeAuthReturn(value:string|null){return value==='/account'||value==='/account?reset=1'?value:'/';}
export function confirmedIdentity(user:{id:string;email?:string;email_confirmed_at?:string|null}|null){return user&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)&&user.email&&user.email_confirmed_at?{id:user.id,email:user.email}:null;}
