import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture} from './database.ts';
import {handleApi} from '../lib/api-handler.ts';
import {examples} from '../lib/examples.ts';
import {inspectArchive} from '../lib/archive.ts';
import {filterRecipes,scalingFactor,type Recipe} from '../lib/model.ts';

test('due utenti e cinque ricette: API, follow, privacy, foto, conflitti, cestino e backup',async()=>{
  const {db,sqlite}=fixture();
  const files=new Map<string,Uint8Array>();
  const bucket={put:async(id:string,data:Uint8Array)=>{files.set(id,new Uint8Array(data));},delete:async(id:string)=>{files.delete(id);},get:async(id:string)=>{
    const bytes=files.get(id);return bytes?{size:bytes.length,body:new Blob([new Uint8Array(bytes)]).stream()}:null;
  }} as unknown as R2Bucket;
  const request=(userId:string|null,path:string,method='GET',value?:unknown)=>handleApi(new Request(`https://recipeek.test/api/${path}`,{method,headers:{origin:'https://recipeek.test',...(value?{'content-type':'application/json'}:{})},body:value?JSON.stringify(value):undefined}),{user:userId?{userId}:null,db,bucket});
  const data=async(user:string,path:string,method='GET',value?:unknown)=>{const response=await request(user,path,method,value);assert.ok(response.ok,`${method} ${path}: ${response.status} ${await response.clone().text()}`);return response.json() as Promise<any>;};
  try{
    assert.equal((await request(null,'recipes')).status,401);
    const fake=new Request('https://recipeek.test/api/recipes',{headers:{'oai-authenticated-user-id':'alice'}});
    assert.equal((await handleApi(fake,{user:null,db,bucket})).status,401);
    await data('alice','me','PATCH',{name:'Alice in cucina',bio:'Profilo pubblico',discoverable:true});
    await data('bob','me','PATCH',{name:'Bob',bio:'Privato',discoverable:false});
    assert.equal((await data('alice','people')).length,0);
    assert.equal((await data('bob','people'))[0].id,'alice');
    assert.equal((await request('bob','follow/bob','POST')).status,400);
    await data('bob','follow/alice','POST');await data('bob','follow/alice','POST');
    assert.equal((await data('bob','people'))[0].following,1);
    assert.equal((await request('alice','follow/bob','POST')).status,404);
    const upload=await handleApi(new Request('https://recipeek.test/api/media',{method:'POST',headers:{origin:'https://recipeek.test','content-type':'image/jpeg'},body:readFileSync(new URL('./fixtures/photo.jpeg',import.meta.url))}),{user:{userId:'alice'},db,bucket});
    assert.equal(upload.status,201);const {url}=await upload.json() as {url:string};
    const recipes:Recipe[]=[];
    for(let i=0;i<5;i++)recipes.push(await data('alice','recipes','POST',{recipe:{...examples[i],image:i===0?url:'',ownerId:'bob',visibility:'private'}}));
    assert.equal((await data('alice','recipes')).length,5);assert.equal((await data('bob','recipes')).length,0);
    for(const r of recipes){assert.equal(r.ownerId,'alice');assert.equal((await request('bob',`recipes/${r.id}`)).status,404);}
    assert.equal((await request('bob',url.slice(5))).status,404);
    const target=recipes[0];
    assert.equal((await request('bob',`recipes/${target.id}`,'PATCH',{recipe:target,updatedAt:target.updatedAt})).status,404);
    assert.equal((await data('bob',`recipes/${target.id}`,'DELETE')).removed,false);
    assert.equal((await request('bob',`backup?ids=${target.id}`)).status,404);
    assert.equal((await request('bob','recipes','POST',{recipe:{...examples[0],image:url}})).status,400);
    const shared:Recipe=await data('alice',`recipes/${target.id}`,'PATCH',{recipe:{...target,visibility:'shared'},updatedAt:target.updatedAt});
    assert.equal((await data('bob','recipes?scope=community')).length,1);
    assert.equal((await request('bob',url.slice(5))).status,200);
    assert.equal((await request('bob',`backup?ids=${shared.id}`)).status,404);
    const privateAgain=await data('alice',`recipes/${shared.id}`,'PATCH',{recipe:{...shared,visibility:'private'},updatedAt:shared.updatedAt});
    assert.equal((await request('bob',url.slice(5))).status,404);
    assert.equal((await data('bob','recipes?scope=community')).length,0);
    assert.equal((await request('alice',`recipes/${shared.id}`,'PATCH',{recipe:{...shared,title:'Versione obsoleta'},updatedAt:shared.updatedAt})).status,409);
    const full=await request('alice',`backup?ids=${recipes.map(r=>r.id).join(',')}`);
    assert.equal(full.status,200);const archive=await inspectArchive(await full.blob());assert.equal(archive.length,5);
    const source={key:`alice/${target.id}`,sourceId:target.id,sourceOwner:'alice'};
    const copy=await data('bob','imports','POST',{source,recipe:{...privateAgain,image:'',steps:privateAgain.steps.map((s:Recipe['steps'][number])=>({...s,image:''}))}});
    assert.equal(copy.duplicate,false);assert.equal(copy.recipe.ownerId,'bob');assert.equal(copy.recipe.visibility,'private');
    assert.equal((await data('bob','imports','POST',{source,recipe:examples[0]})).duplicate,true);
    assert.equal((await data('bob','recipes')).length,1);
    assert.equal((await request('alice',`recipes/${copy.recipe.id}`)).status,404);
    await data('alice',`recipes/${target.id}`,'DELETE');
    assert.equal((await data('alice','trash')).length,1);assert.equal((await data('bob','trash')).length,0);
    assert.equal((await request('bob',`trash/${target.id}`,'POST')).status,404);
    assert.equal((await data('bob',`trash/${target.id}`,'DELETE')).removed,false);
    const restored=await data('alice',`trash/${target.id}`,'POST');assert.equal(restored.visibility,'private');
    assert.equal((await request('bob',`recipes/${target.id}`)).status,404);
    assert.ok(filterRecipes(recipes,'','Primi','',0,false,'').length>0);
    for(const r of recipes)assert.equal(scalingFactor(r,r.servings*2),2);
    await data('bob','follow/alice','DELETE');assert.equal((await data('bob','people'))[0].following,0);
    await data('alice','me','PATCH',{name:'Alice in cucina',bio:'Nascosto',discoverable:false});assert.equal((await data('bob','people')).length,0);
  }finally{sqlite.close();}
});
