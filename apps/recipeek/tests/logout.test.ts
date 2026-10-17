import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleLogout} from '../lib/logout.ts';
import {accountContext,finishAccountSession,withAccount} from '../lib/auth-context.ts';
import {accountRequiredCookie,authCookieNames,tokenSessionId} from '../lib/session-policy.ts';
const id='11111111-1111-4111-8111-111111111111',sessionId='33333333-3333-4333-8333-333333333333',otherSession='44444444-4444-4444-8444-444444444444';
const env={RECIPEEK_AUTH_MODE:'sites',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
const user={id,email:'alice@example.test',email_confirmed_at:'2026-10-17',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-10-17'};
const token=(sid=sessionId,exp=Math.floor(Date.now()/1000)+3600)=>`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,session_id:sid,exp})).toString('base64url')}.signature`;
const sessionCookie=(sid=sessionId,exp=Math.floor(Date.now()/1000)+3600)=>`sb-project-auth-token=base64-${Buffer.from(JSON.stringify({access_token:token(sid,exp),refresh_token:'refresh-test',expires_at:exp,user})).toString('base64url')}`;
const request=(scope='local',origin:string|null='https://recipeek.test',method='POST')=>new Request('https://recipeek.test/auth/logout',{method,headers:{...(origin?{origin}:{}),'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify({scope})}:{})});

test('logout solo POST e stessa origine; richieste improprie non revocano sessioni',async()=>{
  let calls=0,cleared=0;const deps={client:{auth:{signOut:async()=>{calls++;return {error:null};}}},authenticated:true,onSignedOut:()=>{cleared++;}};
  for(const [req,status] of [[request('local',null),403],[request('local','https://evil.test'),403],[request('local',null,'GET'),405],[request('invalid'),400]] as const){assert.equal((await handleLogout(req,deps)).status,status);}
  assert.equal(calls,0);assert.equal(cleared,0);
  const response=await handleLogout(request(),deps);assert.equal(response.status,200);assert.equal((await response.json() as {signedOut:boolean}).signedOut,true);assert.equal(calls,1);assert.equal(cleared,1);
});

test('logout globale segnala la revoca fallita ma completa sempre l’uscita locale',async()=>{
  let scope='',cleared=0;
  const success=await handleLogout(request('global'),{client:{auth:{signOut:async options=>{scope=options.scope;return {error:null};}}},authenticated:true,onSignedOut:()=>{cleared++;}});
  assert.equal(scope,'global');assert.equal((await success.json() as {globalRevoked:boolean}).globalRevoked,true);
  const failed=await handleLogout(request('global'),{client:{auth:{signOut:async()=>{throw new Error('Auth unavailable');}}},authenticated:true,onSignedOut:()=>{cleared++;}});
  assert.deepEqual(await failed.json(),{signedOut:true,globalRevoked:false,notice:'global-logout-failed',redirectTo:'/account'});assert.equal(cleared,2);
});

test('logout scarta token appena rinnovati anche quando Auth non riesce a revocarli',async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async input=>{const url=String(input instanceof Request?input.url:input);if(url.includes('/token'))return Response.json({access_token:token(),refresh_token:'fresh-refresh',expires_in:3600,token_type:'bearer',user});if(url.endsWith('/user'))return Response.json(user);if(url.includes('/logout'))return Response.json({message:'Unavailable'},{status:503});throw new Error('Unexpected endpoint');};
  try{
    const req=new Request(request(),{headers:{...Object.fromEntries(request().headers),cookie:sessionCookie(sessionId,1)}});
    const response=await withAccount(req,env,async updated=>handleLogout(updated,{client:accountContext()!.client,authenticated:true,onSignedOut:()=>finishAccountSession(sessionId)}));
    const cookies=response.headers.getSetCookie(),auth=cookies.filter(c=>c.startsWith('sb-project-auth-token'));
    assert.ok(auth.length);assert.ok(auth.every(c=>/Max-Age=0/i.test(c)),JSON.stringify(auth.map(c=>({name:c.split('=')[0],maxAge:c.match(/Max-Age=\d+/i)?.[0]}))));assert.ok(cookies.some(c=>c.startsWith(accountRequiredCookie+'='+sessionId)&&/HttpOnly/i.test(c)&&/Secure/i.test(c)));
    assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal((await response.json() as {signedOut:boolean}).signedOut,true);
  }finally{globalThis.fetch=previous;}
});

test('uscita blocca il ripiego Sites e una risposta tardiva, ma permette un nuovo login',async()=>{
  const previous=globalThis.fetch;globalThis.fetch=async()=>Response.json(user);
  try{
    await withAccount(new Request('https://recipeek.test/api/me',{headers:{cookie:accountRequiredCookie+'='+sessionId}}),env,async()=>{assert.equal(accountContext()?.requiresAccount,true);assert.equal(accountContext()?.user,null);return new Response();});
    const blocked=await withAccount(new Request('https://recipeek.test/api/me',{headers:{cookie:sessionCookie()+'; '+accountRequiredCookie+'='+sessionId}}),env,async req=>{assert.equal(accountContext()?.user,null);assert.doesNotMatch(req.headers.get('cookie')??'',/sb-project-auth-token=/);return new Response();});
    assert.ok(blocked.headers.getSetCookie().some(c=>c.startsWith('sb-project-auth-token=')&&/Max-Age=0/i.test(c)));
    await withAccount(new Request('https://recipeek.test/api/me',{headers:{cookie:sessionCookie(otherSession)+'; '+accountRequiredCookie+'='+sessionId}}),env,async()=>{assert.equal(accountContext()?.user?.id,id);return new Response();});
    assert.deepEqual(authCookieNames({url:env.SUPABASE_URL,key:env.SUPABASE_PUBLISHABLE_KEY},['sb-project-auth-token.0','sb-other-auth-token']),['sb-project-auth-token','sb-project-auth-token-code-verifier','sb-project-auth-token.0']);
    assert.equal(tokenSessionId('invalid'),null);
  }finally{globalThis.fetch=previous;}
});
