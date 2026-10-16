// Optional integration smoke against the portable preview. Never run against a hosted Site.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const origin='http://127.0.0.1:5173';
assert.equal((await fetch(`${origin}/api/recipes`)).status,401);
const signIn=await fetch(`${origin}/signin-with-chatgpt?return_to=/`,{redirect:'manual'});
const cookie=signIn.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
assert.ok(cookie,'portable mock sign-in must provide a development cookie');
const request=async(path,method='GET',value,extra={})=>fetch(`${origin}/api/${path}`,{method,headers:{cookie,...(value?{'content-type':'application/json'}:{}),...extra},body:value?JSON.stringify(value):undefined});
assert.equal((await request('recipes','POST',{recipe:{}},{origin:'https://unrelated.example'})).status,403);
assert.equal((await request('recipes','POST',{recipe:{}})).status,400);
const recipe={title:'Verifica API · temporanea',description:'Creata da un test locale',category:'Antipasti',method:'Senza cottura',servings:2,prepMinutes:5,cookMinutes:0,image:'',sourceUrl:'',sourceAuthor:'Test',notes:'',collection:'Test',favorite:false,visibility:'private',pan:null,ingredients:[{id:'i1',name:'Pomodoro',quantity:2,unit:'pezzi'}],steps:[{id:'s1',text:'Taglia il pomodoro e servi.',ingredients:[{ingredientId:'i1',quantity:2}],image:'',videoUrl:'',timerMinutes:0}]};
const createdResponse=await request('recipes','POST',{recipe});assert.equal(createdResponse.status,201);const created=await createdResponse.json();
try{
  const invalidUpload=await fetch(`${origin}/api/media`,{method:'POST',headers:{cookie,'content-type':'image/jpeg'},body:'not-an-image'});assert.equal(invalidUpload.status,400);
  const upload=await fetch(`${origin}/api/media`,{method:'POST',headers:{cookie,'content-type':'image/jpeg'},body:await readFile(new URL('../public/images/salad.jpg',import.meta.url))});assert.equal(upload.status,201);const media=await upload.json();
  const imageResponse=await fetch(`${origin}${media.url}`,{headers:{cookie}});assert.equal(imageResponse.status,200);assert.match(imageResponse.headers.get('content-type'),/image\/jpeg/);assert.ok((await imageResponse.arrayBuffer()).byteLength>1000);
  const updatedResponse=await request(`recipes/${created.id}`,'PATCH',{recipe:{...recipe,image:media.url,title:'Verifica API · aggiornata'},updatedAt:created.updatedAt});assert.equal(updatedResponse.status,200);const updated=await updatedResponse.json();assert.equal(updated.image,media.url);
  assert.equal((await request(`recipes/${created.id}`,'PATCH',{recipe,updatedAt:created.updatedAt})).status,409);
  const stored=await(await request(`recipes/${created.id}`)).json();assert.equal(stored.title,'Verifica API · aggiornata');
  const ingredients=await(await request('ingredients')).json();assert.ok(ingredients.some(i=>i.name==='Pomodoro'));
  console.log('PASS: autenticazione, CSRF, validazione, CRUD persistente, conflitto revisione, upload/lettura foto, anagrafica ingredienti');
}finally{const deleted=await request(`recipes/${created.id}`,'DELETE');assert.equal(deleted.status,200);assert.equal((await request(`recipes/${created.id}`)).status,404);}
