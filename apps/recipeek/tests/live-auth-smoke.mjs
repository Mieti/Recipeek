import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
const require=createRequire(new URL('../package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');
const {createServerClient}=require('@supabase/ssr');
const {examples}=await import('../lib/examples.ts');
const {inspectArchive}=await import('../lib/archive.ts');
const {restoreBackup}=await import('../lib/restore-backup.ts');
const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);const config=JSON.parse(Buffer.concat(chunks).toString());
assert.equal(config.url,'https://ybrxvbxjmxnxgbupxblj.supabase.co','Use only the Recipeek Auth project');
const admin=createClient(config.url,config.admin,{auth:{persistSession:false,autoRefreshToken:false}});
const origin='http://127.0.0.1:5173',createdUsers=[],createdRecipes=[];
const prefix=`recipeek-smoke-${Date.now()}`;
const sessions=[];
async function request(who,path,method='GET',value,type='application/json'){const jar=sessions[who]?.jar??new Map();const response=await fetch(`${origin}/api/${path}`,{method,headers:{cookie:[...jar].map(([n,v])=>`${n}=${encodeURIComponent(v)}`).join('; '),origin,...(value?{'content-type':type}:{})},body:value?(type==='application/json'?JSON.stringify(value):value):undefined});for(const line of response.headers.getSetCookie()){const pair=line.split(';')[0],at=pair.indexOf('='),name=pair.slice(0,at);if(/max-age=0/i.test(line))jar.delete(name);else jar.set(name,decodeURIComponent(pair.slice(at+1)));}return response;}
async function json(who,path,method='GET',value){const r=await request(who,path,method,value);assert.ok(r.ok,`${path} ${r.status}: ${await r.clone().text()}`);return r.json();}
try{
 const landing=await fetch(origin+'/',{redirect:'manual'});assert.equal(landing.status,200);const landingHtml=await landing.text();assert.ok(landingHtml.includes('Entra nella tua cucina'));assert.ok(!landingHtml.includes('signin-with-chatgpt'));
 const rejectedGateway=await fetch(origin+'/api/recipes',{headers:{cookie:'__sites_local_auth=1','oai-authenticated-user-id':'forged'}});assert.equal(rejectedGateway.status,401,'Autonomous mode must reject a gateway-only identity');
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
 const photos=[];
 for(const [extension,type] of [['jpeg','image/jpeg'],['png','image/png'],['webp','image/webp']]){
  const original=readFileSync(new URL(`./fixtures/photo.${extension}`,import.meta.url));
  const upload=await request(0,'media','POST',original,type);assert.equal(upload.status,201);const photo=await upload.json();photos.push(photo.url);
  const bytes=Buffer.from(await (await request(0,photo.url.slice(5))).arrayBuffer());assert.ok(bytes.length<original.length);assert.ok(!bytes.includes(Buffer.from('Private Artist')));
  assert.equal((await request(1,photo.url.slice(5))).status,404);
 }
 const originalRecipe=createdRecipes[0][1];
 const r=await json(0,`recipes/${originalRecipe.id}`,'PATCH',{recipe:{...originalRecipe,image:photos[0],steps:originalRecipe.steps.map((s,i)=>({...s,image:photos[1+i%2]}))},updatedAt:originalRecipe.updatedAt});createdRecipes[0][1]=r;
 assert.equal((await request(1,`recipes/${r.id}`)).status,404);
 assert.equal((await request(1,`recipes/${r.id}`,'PATCH',{recipe:r,updatedAt:r.updatedAt})).status,404);
 assert.equal((await json(1,`recipes/${r.id}`,'DELETE')).removed,false);
 const shared=await json(0,`recipes/${r.id}`,'PATCH',{recipe:{...r,visibility:'shared'},updatedAt:r.updatedAt});
 assert.equal((await request(1,`recipes/${r.id}`)).status,200);
 for(const url of photos)assert.equal((await request(1,url.slice(5))).status,200);
 assert.ok((await json(1,'recipes?scope=community')).some(v=>v.id===r.id));
 assert.equal((await request(1,`backup?ids=${r.id}`)).status,404);
 await json(0,'me','PATCH',{name:'TEST Alice',bio:'Test temporaneo',discoverable:true});
 await json(1,`follow/${a.id}`,'POST');assert.ok((await json(1,'people')).some(p=>p.id===a.id&&p.following));
 const updated=await json(0,`recipes/${r.id}`,'PATCH',{recipe:{...shared,visibility:'private'},updatedAt:shared.updatedAt});
 assert.equal((await request(1,`recipes/${r.id}`)).status,404);
 for(const url of photos)assert.equal((await request(1,url.slice(5))).status,404);
 assert.equal((await request(0,`recipes/${r.id}`,'PATCH',{recipe:updated,updatedAt:r.updatedAt})).status,409);
 const backup=await request(0,`backup?ids=${createdRecipes.map(([,r])=>r.id).join(',')}`);assert.equal(backup.status,200);const archive=await backup.blob();assert.equal((await inspectArchive(archive)).length,5);
 const restoreApi={check:sources=>json(1,'imports/check','POST',sources),photo:async(bytes,type)=>{const response=await request(1,'import-media','POST',bytes,type);assert.equal(response.status,201);return (await response.json()).url;},recipe:(recipe,source)=>json(1,'imports','POST',{recipe,source})};
 const copies=[];const restored=await restoreBackup(archive,true,restoreApi,()=>{},copy=>{copies.push(copy);createdRecipes.push([1,copy]);});assert.deepEqual(restored,{imported:5,skipped:0});
 const copy=copies.find(v=>v.title===r.title);assert.ok(copy);assert.equal(copy.ownerId,b.id);assert.equal(copy.visibility,'private');assert.notEqual(copy.image,r.image);assert.equal((await request(1,copy.image.slice(5))).status,200);assert.equal((await request(0,copy.image.slice(5))).status,404);
 for(const step of copy.steps)if(step.image)assert.equal((await request(1,step.image.slice(5))).status,200);
 assert.deepEqual(await restoreBackup(archive,true,restoreApi,()=>{},()=>assert.fail('Duplicate restore must not create recipes')),{imported:0,skipped:5});
 await json(0,`recipes/${r.id}`,'DELETE');assert.equal((await request(1,`trash/${r.id}`,'POST')).status,404);
 assert.equal((await json(0,`trash/${r.id}`,'POST')).visibility,'private');
 await json(1,`follow/${a.id}`,'DELETE');await json(0,'me','PATCH',{name:'TEST Alice',bio:'',discoverable:false});
 const invalid=await sessions[1].client.auth.signInWithPassword({email:`${prefix}-1@example.invalid`,password:'invalid-password'});assert.ok(invalid.error);
 console.log('PASS: due account Supabase reali temporanei, login password, 5 ricette, foto JPEG/PNG/WebP senza metadati, privacy e revoca anche nelle foto degli step, community, follow, conflitti, backup ZIP ripristinato nell’altro account due volte senza duplicati, cestino sul Worker locale.');
}finally{
 for(const [who,r] of createdRecipes){try{await request(who,`recipes/${r.id}`,'DELETE');await request(who,`trash/${r.id}`,'DELETE');}catch{}}
 for(const session of sessions)try{await session.client.auth.signOut();}catch{}
 const cleanupErrors=[];for(const id of createdUsers){const {error}=await admin.auth.admin.deleteUser(id);if(error)cleanupErrors.push(error);}
 if(cleanupErrors.length)throw new AggregateError(cleanupErrors,'Account temporanei non rimossi');
 console.log('Account Auth temporanei rimossi; nessuna ricetta di prova scritta sul sito ospitato.');
}
