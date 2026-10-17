import {AsyncLocalStorage} from 'node:async_hooks';
import {createServerClient,parseCookieHeader,serializeCookieHeader} from '@supabase/ssr';
import type {SupabaseClient,User} from '@supabase/supabase-js';
import {authConfig,authMode,confirmedIdentity,type AuthEnvironment} from './auth-config.ts';
import {resolveAccountProfile,type LegacyIdentity} from './account-identity.ts';
import type {Database} from './repository.ts';
import {accountRequiredCookie,authCookieNames,isSessionMarker,tokenSessionId} from './session-policy.ts';

type AuthState={client:SupabaseClient|null;user:User|null;mode:'sites'|'supabase';config:ReturnType<typeof authConfig>;failed:boolean;attempted:boolean;requiresAccount:boolean;signedOut:boolean;logoutSession?:string;profileId?:string};
const context=new AsyncLocalStorage<AuthState>();
export function accountContext(){return context.getStore();}
export function finishAccountSession(sessionId:string|null){const state=accountContext();if(state){state.signedOut=true;state.user=null;state.logoutSession=sessionId??'1';}}
export async function externalProfile(db:Database,legacy:LegacyIdentity|null=null){const state=accountContext();if(!state||!confirmedIdentity(state.user))return null;if(state.profileId)return state.profileId;const name=state.user?.user_metadata?.full_name;const id=await resolveAccountProfile(db,state.user,legacy,typeof name==='string'?name:'Cuoco di casa');if(id)state.profileId=id;return id;}

// Run before framework rendering, so refreshed cookies reach both the request
// seen by Server Components and the browser, including redirects and API errors.
export async function withAccount(request:Request,env:AuthEnvironment,render:(request:Request)=>Promise<Response>){
  const mode=authMode(env),config=authConfig(env),jar=new Map(parseCookieHeader(request.headers.get('cookie')??'').filter((c):c is {name:string;value:string}=>typeof c.value==='string').map(c=>[c.name,c.value]));
  const outgoing=new Map<string,string>();
  const client=config?createServerClient(config.url,config.key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll(cookies){for(const cookie of cookies){jar.set(cookie.name,cookie.value);outgoing.set(cookie.name,serializeCookieHeader(cookie.name,cookie.value,{...cookie.options,secure:new URL(request.url).protocol==='https:',sameSite:'lax',path:'/'}));}}}}):null;
  const marker=jar.get(accountRequiredCookie);
  const state:AuthState={client,user:null,mode,config,failed:mode==='supabase'&&!client,attempted:Boolean(client&&[...jar.keys()].some(name=>name.startsWith('sb-'))),requiresAccount:Boolean(config&&marker),signedOut:false};
  if(client&&state.attempted){try{const {data,error}=await client.auth.getUser();state.user=data.user;state.failed=Boolean(error&&error.status!==400&&error.status!==401&&error.status!==403&&error.status!==422);}catch{state.failed=true;}}
  const cookieOptions={secure:new URL(request.url).protocol==='https:',sameSite:'lax' as const,path:'/'};
  if(config&&client&&state.user&&isSessionMarker(marker)){
    // A late response from an in-flight refresh cannot revive the session that
    // this browser has just closed. A new login creates a different session ID.
    try{const {data,error}=await client.auth.getSession();
      if(error){state.user=null;state.failed=true;}
      else if(tokenSessionId(data.session?.access_token)===marker){state.user=null;for(const name of authCookieNames(config,jar.keys(),false)){jar.delete(name);outgoing.set(name,serializeCookieHeader(name,'',{...cookieOptions,maxAge:0}));}}
    }catch{state.user=null;state.failed=true;}
  }
  if(config&&confirmedIdentity(state.user)){
    state.requiresAccount=true;
    outgoing.set(accountRequiredCookie,serializeCookieHeader(accountRequiredCookie,isSessionMarker(marker)?marker:'1',{...cookieOptions,httpOnly:true,maxAge:31536000}));
  }
  const headers=new Headers(request.headers);if(outgoing.size)headers.set('cookie',[...jar].map(([name,value])=>`${name}=${encodeURIComponent(value)}`).join('; '));
  const response=await context.run(state,()=>render(outgoing.size?new Request(request,{headers}):request));
  if(state.signedOut&&config){
    // Suppress any tokens refreshed earlier in this same request, including
    // when upstream revocation failed. Explicit logout always clears them.
    outgoing.clear();
    for(const name of authCookieNames(config,jar.keys()))outgoing.set(name,serializeCookieHeader(name,'',{...cookieOptions,maxAge:0}));
    outgoing.set(accountRequiredCookie,serializeCookieHeader(accountRequiredCookie,state.logoutSession??'1',{...cookieOptions,httpOnly:true,maxAge:31536000}));
  }
  if(!outgoing.size)return response;
  const result=new Response(response.body,response);for(const value of outgoing.values())result.headers.append('set-cookie',value);result.headers.set('cache-control','private, no-store');return result;
}
