// Optional integration smoke against the portable preview. Never run against a hosted Site.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const origin='http://127.0.0.1:5173';
async function bufferedFetch(url,options){const response=await fetch(url,options);return new Response(await response.arrayBuffer(),response);}
assert.equal((await bufferedFetch(`${origin}/api/recipes`)).status,401);
const signIn=await fetch(`${origin}/signin-with-chatgpt?return_to=/`,{redirect:'manual'});
const cookie=signIn.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
assert.ok(cookie,'portable mock sign-in must provide a development cookie');
const request=async(path,method='GET',value,extra={})=>bufferedFetch(`${origin}/api/${path}`,{method,headers:{cookie,...(value?{'content-type':'application/json'}:{}),...extra},body:value?JSON.stringify(value):undefined});
assert.equal((await request('recipes','POST',{recipe:{}},{origin:'https://unrelated.example'})).status,403);
assert.equal((await request('recipes','POST',{recipe:{}})).status,400);
assert.equal((await request('me','DELETE')).status,405);
assert.equal((await request('recipes/unknown/extra','DELETE')).status,404);
assert.equal((await request('recipes/unknown','POST',{recipe:{}})).status,405);
assert.equal((await request('recipes','POST',{}, {origin:'http://127.0.0.1:5173'})).status,400);
const oversized = await bufferedFetch(`${origin}/api/recipes`,{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({text:'x'.repeat(210_000)})});assert.equal(oversized.status,413);
const recipe={title:'Verifica API · temporanea',description:'Creata da un test locale',category:'Antipasti',method:'Senza cottura',servings:2,prepMinutes:5,cookMinutes:0,image:'',sourceUrl:'',sourceAuthor:'Test',notes:'',collection:'Test',favorite:false,visibility:'private',pan:null,ingredients:[{id:'i1',name:'Pomodoro',quantity:2,unit:'pezzi'}],steps:[{id:'s1',text:'Taglia il pomodoro e servi.',ingredients:[{ingredientId:'i1',quantity:2}],image:'',videoUrl:'',timerMinutes:0}]};
const createdResponse=await request('recipes','POST',{recipe});assert.equal(createdResponse.status,201);const created=await createdResponse.json();
try{
  assert.equal((await request('storage','POST',undefined,{origin:'https://unrelated.example'})).status,403);
  const before=await(await request('storage')).json();assert.equal(before.maxBytes,250_000_000);assert.equal(before.maxFiles,500);
  for(const [file,type] of [['jpeg','image/jpeg'],['png','image/png'],['webp','image/webp']]){
    const original=await readFile(new URL(`./fixtures/photo.${file}`,import.meta.url));
    const upload=await bufferedFetch(`${origin}/api/media`,{method:'POST',headers:{cookie,'content-type':type},body:original});assert.equal(upload.status,201);const media=await upload.json();
    const read=await bufferedFetch(`${origin}${media.url}`,{headers:{cookie}});assert.equal(read.status,200);
    const bytes=Buffer.from(await read.arrayBuffer());assert.equal(bytes.includes(Buffer.from('Private Artist')),false);assert.ok(bytes.length<original.length);
  }
  const after=await(await request('storage')).json();assert.equal(after.files,before.files+3);
  const cleaned=await request('storage','POST');assert.equal(cleaned.status,200);assert.equal((await cleaned.json()).removed,0);
  const invalidUpload=await bufferedFetch(`${origin}/api/media`,{method:'POST',headers:{cookie,'content-type':'image/jpeg'},body:'not-an-image'});assert.equal(invalidUpload.status,400);
  const upload=await fetch(`${origin}/api/media`,{method:'POST',headers:{cookie,'content-type':'image/jpeg'},body:await readFile(new URL('../public/images/salad.jpg',import.meta.url))});assert.equal(upload.status,201);const media=await upload.json();
  const imageResponse=await fetch(`${origin}${media.url}`,{headers:{cookie}});assert.equal(imageResponse.status,200);assert.match(imageResponse.headers.get('content-type'),/image\/jpeg/);assert.ok((await imageResponse.arrayBuffer()).byteLength>1000);
  const updatedResponse=await request(`recipes/${created.id}`,'PATCH',{recipe:{...recipe,image:media.url,title:'Verifica API · aggiornata'},updatedAt:created.updatedAt});assert.equal(updatedResponse.status,200);const updated=await updatedResponse.json();assert.equal(updated.image,media.url);
  assert.equal((await request(`recipes/${created.id}`,'PATCH',{recipe,updatedAt:created.updatedAt})).status,409);
  const stored=await(await request(`recipes/${created.id}`)).json();assert.equal(stored.title,'Verifica API · aggiornata');
  const ingredients=await(await request('ingredients')).json();assert.ok(ingredients.some(i=>i.name==='Pomodoro'));
  console.log('PASS: autenticazione, CSRF, metodi/percorsi, limite body, CRUD, conflitto, JPEG/PNG/WebP senza metadati personali, conteggio storage e protezione foto recenti, anagrafica ingredienti');
}finally{const deleted=await request(`recipes/${created.id}`,'DELETE');assert.equal(deleted.status,200);assert.equal((await request(`recipes/${created.id}`)).status,404);}
