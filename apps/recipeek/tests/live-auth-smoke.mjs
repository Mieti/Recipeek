import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
const require=createRequire(new URL('../package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');
const {createServerClient}=require('@supabase/ssr');
const {examples}=await import('../lib/examples.ts');
const {inspectArchive}=await import('../lib/archive.ts');
const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);const config=JSON.parse(Buffer.concat(chunks).toString());
assert.equal(config.url,'https://ybrxvbxjmxnxgbupxblj.supabase.co','Use only the Recipeek Auth project');
const admin=createClient(config.url,config.admin,{auth:{persistSession:false,autoRefreshToken:false}});
const origin='http://127.0.0.1:5173',createdUsers=[],createdRecipes=[];
const prefix=`recipeek-smoke-${Date.now()}`;
const sessions=[];
async function request(who,path,method='GET',value){const jar=sessions[who]?.jar??new Map();const response=await fetch(`${origin}/api/${path}`,{method,headers:{cookie:[...jar].map(([n,v])=>`${n}=${encodeURIComponent(v)}`).join('; '),origin,...(value?{'content-type':'application/json'}:{})},body:value?JSON.stringify(value):undefined});for(const line of response.headers.getSetCookie()){const pair=line.split(';')[0],at=pair.indexOf('=');jar.set(pair.slice(0,at),decodeURIComponent(pair.slice(at+1)));}return response;}
async function json(who,path,method='GET',value){const r=await request(who,path,method,value);assert.ok(r.ok,`${path} ${r.status}: ${await r.clone().text()}`);return r.json();}
try{
 for(let i=0;i<2;i++){
  const email=`${prefix}-${i}@example.invalid`,password=randomBytes(32).toString('base64url');
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error)throw error;createdUsers.push(data.user.id);
  const jar=new Map();const client=createServerClient(config.url,config.key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:(cookies)=>cookies.forEach(c=>jar.set(c.name,c.value))}});
  assert.ok((await client.auth.signInWithPassword({email,password})).data.user);
  sessions.push({client,jar});
 }
 const a=await json(0,'me'),b=await json(1,'me');assert.notEqual(a.id,b.id);assert.ok(a.id.startsWith('sb_'));
 assert.equal((await request(2,'recipes')).status,401);
 for(let i=0;i<5;i++){const r=await json(0,'recipes','POST',{recipe:{...examples[i],title:`TEST ${prefix} ${examples[i].title}`,image:'',visibility:'private'}});createdRecipes.push([0,r]);}
 const r=createdRecipes[0][1];
 assert.equal((await request(1,`recipes/${r.id}`)).status,404);
 assert.equal((await request(1,`recipes/${r.id}`,'PATCH',{recipe:r,updatedAt:r.updatedAt})).status,404);
 assert.equal((await json(1,`recipes/${r.id}`,'DELETE')).removed,false);
 const shared=await json(0,`recipes/${r.id}`,'PATCH',{recipe:{...r,visibility:'shared'},updatedAt:r.updatedAt});
 assert.equal((await request(1,`recipes/${r.id}`)).status,200);
 assert.ok((await json(1,'recipes?scope=community')).some(v=>v.id===r.id));
 assert.equal((await request(1,`backup?ids=${r.id}`)).status,404);
 await json(0,'me','PATCH',{name:'TEST Alice',bio:'Test temporaneo',discoverable:true});
 await json(1,`follow/${a.id}`,'POST');assert.ok((await json(1,'people')).some(p=>p.id===a.id&&p.following));
 const updated=await json(0,`recipes/${r.id}`,'PATCH',{recipe:{...shared,visibility:'private'},updatedAt:shared.updatedAt});
 assert.equal((await request(1,`recipes/${r.id}`)).status,404);
 assert.equal((await request(0,`recipes/${r.id}`,'PATCH',{recipe:updated,updatedAt:r.updatedAt})).status,409);
 const backup=await request(0,`backup?ids=${createdRecipes.map(([,r])=>r.id).join(',')}`);assert.equal(backup.status,200);assert.equal((await inspectArchive(await backup.blob())).length,5);
 await json(0,`recipes/${r.id}`,'DELETE');assert.equal((await request(1,`trash/${r.id}`,'POST')).status,404);
 assert.equal((await json(0,`trash/${r.id}`,'POST')).visibility,'private');
 await json(1,`follow/${a.id}`,'DELETE');await json(0,'me','PATCH',{name:'TEST Alice',bio:'',discoverable:false});
 const invalid=await sessions[1].client.auth.signInWithPassword({email:`${prefix}-1@example.invalid`,password:'invalid-password'});assert.ok(invalid.error);
 console.log('PASS: due account Supabase reali temporanei, login password, verifica server, 5 ricette, privacy, community, follow, conflitti, backup e cestino sul Worker locale.');
}finally{
 for(const [who,r] of createdRecipes){try{await request(who,`recipes/${r.id}`,'DELETE');await request(who,`trash/${r.id}`,'DELETE');}catch{}}
 for(const session of sessions)try{await session.client.auth.signOut();}catch{}
 const cleanupErrors=[];for(const id of createdUsers){const {error}=await admin.auth.admin.deleteUser(id);if(error)cleanupErrors.push(error);}
 if(cleanupErrors.length)throw new AggregateError(cleanupErrors,'Account temporanei non rimossi');
 console.log('Account Auth temporanei rimossi; nessuna ricetta di prova scritta sul sito ospitato.');
}
