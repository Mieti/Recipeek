import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './database.ts';
import {authConfig,authMode,confirmedIdentity,safeAuthReturn} from '../lib/auth-config.ts';
import {linkLegacyProfile,mappedProfile,resolveProfile} from '../lib/account-identity.ts';
import {withAccount,accountContext} from '../lib/auth-context.ts';
import {examples} from '../lib/examples.ts';
import {saveRecipe,readRecipe} from '../lib/repository.ts';
const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
const environment={RECIPEEK_AUTH_MODE:'supabase',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
const user={id:alice,email:'alice@example.test',email_confirmed_at:'2026-10-17T00:00:00Z',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-10-17T00:00:00Z'};
function cookie(session:Record<string,unknown>){return `sb-project-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;}
function token(sub:string,exp=Math.floor(Date.now()/1000)+3600){return `${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub,exp})).toString('base64url')}.signature`;}

test('Auth rifiuta URL impropri, chiavi privilegiate, modalità ignote e redirect esterni',()=>{
  assert.equal(authMode({}),'sites');assert.equal(authConfig({}),null);
  for(const key of ['service_role','sb_secret_test'])assert.throws(()=>authConfig({...environment,SUPABASE_PUBLISHABLE_KEY:key}));
  for(const url of ['http://project.supabase.co','https://name:password@project.supabase.co','https://project.supabase.co/path'])assert.throws(()=>authConfig({...environment,SUPABASE_URL:url}));
  assert.throws(()=>authMode({RECIPEEK_AUTH_MODE:'typo'}));
  for(const path of ['//evil.test','https://evil.test','/account?next=//evil.test','/auth/callback'])assert.equal(safeAuthReturn(path),'/');
  assert.equal(safeAuthReturn('/account?reset=1'),'/account?reset=1');
  assert.equal(confirmedIdentity({...user,email_confirmed_at:null}),null);
});

test('collegare due identità verificate conserva ricette e proprietario senza fondere ricettari distinti',async()=>{
  const {db,sqlite}=fixture();try{
    const recipe=await saveRecipe(db,'alice',examples[0]);
    assert.equal(await linkLegacyProfile(db,alice,'alice'),'alice');
    assert.equal(await resolveProfile(db,alice),'alice');assert.equal((await readRecipe(db,recipe.id,'alice'))?.title,recipe.title);
    await assert.rejects(()=>linkLegacyProfile(db,bob,'alice'),/già associato/);
    assert.equal(await mappedProfile(db,bob),null);
    const second=await resolveProfile(db,bob);assert.equal(second,`sb_${bob}`);
    assert.equal(await readRecipe(db,recipe.id,second),null);
    await assert.rejects(()=>linkLegacyProfile(db,bob,'bob'),/ricettario distinto/);
    assert.equal(await resolveProfile(db,bob),second);
  }finally{sqlite.close();}
});

test('cookie e header contraffatti non sono identità; il server Auth deve verificare l’utente',async()=>{
  const original=globalThis.fetch;let checks=0;
  globalThis.fetch=async()=>{checks++;return Response.json({message:'Invalid JWT'},{status:401});};
  try{
    await withAccount(new Request('https://recipeek.test/api/me',{headers:{cookie:cookie({access_token:token(alice),refresh_token:'fake-refresh',expires_at:Date.now()/1000+3600,user}), 'oai-authenticated-user-id':'alice'}}),environment,async()=>{
      assert.equal(accountContext()?.mode,'supabase');assert.equal(accountContext()?.user,null);return new Response('no identity');
    });
    assert.ok(checks>0);
    await withAccount(new Request('https://recipeek.test/api/me',{headers:{'oai-authenticated-user-id':'alice'}}),environment,async()=>{assert.equal(accountContext()?.user,null);return new Response();});
  }finally{globalThis.fetch=original;}
});

test('il refresh aggiorna cookie di richiesta e risposta senza condividere identità tra richieste',async()=>{
  const original=globalThis.fetch;const newToken=token(alice);let refreshes=0;
  globalThis.fetch=async(input)=>{const url=String(input instanceof Request?input.url:input);
    if(url.includes('/token')){refreshes++;return Response.json({access_token:newToken,refresh_token:'new-refresh',expires_in:3600,token_type:'bearer',user});}
    if(url.endsWith('/user'))return Response.json(user);
    throw new Error('Unexpected Auth endpoint');
  };
  try{
    const response=await withAccount(new Request('https://recipeek.test/api/me',{headers:{cookie:cookie({access_token:token(alice,1),refresh_token:'old-refresh',expires_at:1,user})}}),environment,async(request)=>{
      assert.equal(accountContext()?.user?.id,alice);assert.doesNotMatch(request.headers.get('cookie')??'',/old-refresh/);return Response.json({ok:true});
    });
    assert.ok(refreshes>0);assert.ok(response.headers.getSetCookie().some(value=>value.includes('sb-project-auth-token')));
    assert.match(response.headers.get('set-cookie')??'',/Secure/i);assert.match(response.headers.get('set-cookie')??'',/SameSite=Lax/i);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.equal(accountContext(),undefined);
    await withAccount(new Request('https://recipeek.test/api/me'),environment,async()=>{assert.equal(accountContext()?.user,null);return new Response();});
  }finally{globalThis.fetch=original;}
});

test('configurazione assente e guasto Auth non ripiegano su un’identità ChatGPT in modalità autonoma',async()=>{
  await withAccount(new Request('https://recipeek.test/'),{RECIPEEK_AUTH_MODE:'supabase'},async()=>{assert.equal(accountContext()?.failed,true);assert.equal(accountContext()?.mode,'supabase');return new Response();});
  const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({message:'Unavailable'},{status:503});
  try{await withAccount(new Request('https://recipeek.test/api/me',{headers:{cookie:cookie({access_token:token(alice),refresh_token:'r',expires_at:Date.now()/1000+3600,user})}}),environment,async()=>{assert.equal(accountContext()?.failed,true);assert.equal(accountContext()?.user,null);return new Response();});}finally{globalThis.fetch=original;}
});
