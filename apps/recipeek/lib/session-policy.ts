import type {AuthConfig} from './auth-config.ts';

export const accountRequiredCookie='recipeek_account_required';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// This value is only a logout deny-list hint, never an authentication proof.
// Identity is still verified with Auth.getUser before any protected operation.
export function tokenSessionId(accessToken:string|undefined){try{const part=accessToken?.split('.')[1];if(!part||part.length>16000)return null;const value=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/'))).session_id;return typeof value==='string'&&uuid.test(value)?value:null;}catch{return null;}}
export function isSessionMarker(value:string|undefined):value is string{return Boolean(value&&uuid.test(value));}
export function authCookieNames(config:AuthConfig,names:Iterable<string>,includeVerifier=true){
  const base=`sb-${new URL(config.url).hostname.split('.')[0]}-auth-token`;
  return [...new Set([base,...(includeVerifier?[`${base}-code-verifier`]:[]),...[...names].filter(name=>name===base||name.startsWith(base+'.')||(includeVerifier&&name===base+'-code-verifier'))])];
}
