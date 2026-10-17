import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './database.ts';
import { recipeSchema, scalingFactor, formatQuantity, filterRecipes } from '../lib/model.ts';
import { saveRecipe, readRecipe, listRecipes, removeRecipe, purgeRecipe, readableUpload, type Database } from '../lib/repository.ts';
import { examples } from '../lib/examples.ts';


test('le ricette private sono isolate e quelle condivise sono leggibili senza permesso di modifica',async()=>{const {db,sqlite}=fixture();try{const privateRecipe=await saveRecipe(db,'alice',examples[0]);assert.equal(await readRecipe(db,privateRecipe.id,'bob'),null);assert.equal((await listRecipes(db,'bob')).length,0);assert.equal((await listRecipes(db,'bob','community')).length,0);await assert.rejects(()=>saveRecipe(db,'bob',examples[0],privateRecipe.id,privateRecipe.updatedAt),/FORBIDDEN/);assert.equal(await removeRecipe(db,privateRecipe.id,'bob'),false);const shared=await saveRecipe(db,'alice',{...examples[0],visibility:'shared'},privateRecipe.id,privateRecipe.updatedAt);assert.equal((await readRecipe(db,shared.id,'bob'))?.title,shared.title);assert.equal((await listRecipes(db,'bob','community')).length,1);}finally{sqlite.close();}});
test('modificare una ricetta aggiorna anche l’anagrafica e un documento obsoleto non sovrascrive i dati',async()=>{const {db,sqlite}=fixture();try{const original=await saveRecipe(db,'alice',examples[0]);const changed=await saveRecipe(db,'alice',{...original,title:'Pasta nuova',ingredients:[{...original.ingredients[0],name:'Pasta integrale'}],steps:[{...original.steps[0],ingredients:[{ingredientId:'i1',quantity:50}]}]},original.id,original.updatedAt);await assert.rejects(()=>saveRecipe(db,'alice',original,original.id,original.updatedAt),/CONFLICT/);assert.equal((await readRecipe(db,changed.id,'alice'))?.title,'Pasta nuova');assert.equal((sqlite.prepare('SELECT count(*) AS n FROM recipe_ingredients WHERE recipe_id=?').get(original.id) as {n:number}).n,1);assert.equal(await removeRecipe(db,original.id,'alice'),true);assert.equal(await readRecipe(db,original.id,'alice'),null);assert.equal(await purgeRecipe(db,original.id,'alice'),true);assert.equal((sqlite.prepare('SELECT count(*) AS n FROM recipe_ingredients').get() as {n:number}).n,0);}finally{sqlite.close();}});
test('il confronto della revisione impedisce aggiornamenti concorrenti e conserva l’indice ingredienti',async()=>{const {db,sqlite}=fixture();try{const original=await saveRecipe(db,'alice',examples[0]);const realBatch=db.batch.bind(db);let raced=false;const racing={...db,batch:async(statements:Parameters<Database['batch']>[0])=>{if(!raced){raced=true;await saveRecipe(db,'alice',{...original,title:'Vince altra finestra'},original.id,original.updatedAt);}return realBatch(statements);}} as Database;await assert.rejects(()=>saveRecipe(racing,'alice',{...original,title:'Documento vecchio'},original.id,original.updatedAt),/CONFLICT/);assert.equal((await readRecipe(db,original.id,'alice'))?.title,'Vince altra finestra');assert.equal((sqlite.prepare('SELECT count(*) AS n FROM recipe_ingredients').get() as {n:number}).n,original.ingredients.length);}finally{sqlite.close();}});
test('il ricalcolo distingue porzioni, area tonda e rettangolare; q.b. resta qualitativo',()=>{assert.equal(scalingFactor(examples[0],4),2);const round=examples[5];assert.equal(scalingFactor(round,99,{shape:'round',width:26,length:26}),1.69);const rectangle=examples[3];assert.equal(scalingFactor(rectangle,4,{shape:'rectangle',width:30,length:40}),2);assert.equal(formatQuantity(null,2),'q.b.');assert.equal(formatQuantity(0.75,2),'1,5');});
test('ricette non valide, immagini arbitrarie e collegamenti ingredienti inesistenti vengono respinti',()=>{assert.equal(recipeSchema.safeParse({...examples[0],servings:0}).success,false);assert.equal(recipeSchema.safeParse({...examples[0],image:'https://example.com/photo.svg'}).success,false);assert.equal(recipeSchema.safeParse({...examples[0],steps:[{...examples[0].steps[0],ingredients:[{ingredientId:'missing',quantity:null}]}]}).success,false);assert.equal(recipeSchema.safeParse({...examples[0],sourceUrl:'javascript:alert(1)'}).success,false);});
test('ricerca con ingredienti, accenti e filtri combinati',async()=>{const {db,sqlite}=fixture();try{const r=await saveRecipe(db,'alice',examples[0]);assert.equal(filterRecipes([r],'pomodorini pasta','','',30,true,'').length,0);assert.equal(filterRecipes([r],'pomodorini spaghetti','Primi','Fornelli',30,true,'Da provare').length,1);assert.equal(filterRecipes([r],'spaghetti','','',15,false,'').length,0);}finally{sqlite.close();}});

test('un aggiornamento non ricrea una ricetta eliminata, anche se la cancellazione precede il batch',async()=>{
  const {db,sqlite}=fixture();try{
    const recipe=await saveRecipe(db,'alice',examples[0]);await removeRecipe(db,recipe.id,'alice');
    await assert.rejects(()=>saveRecipe(db,'alice',recipe,recipe.id,recipe.updatedAt),/NOT_FOUND/);
    assert.equal(await readRecipe(db,recipe.id,'alice'),null);
    const second=await saveRecipe(db,'alice',examples[0]);const realBatch=db.batch.bind(db);let deleted=false;
    const racing={...db,batch:async(statements:Parameters<Database['batch']>[0])=>{if(!deleted){deleted=true;await removeRecipe(db,second.id,'alice');}return realBatch(statements);}} as Database;
    await assert.rejects(()=>saveRecipe(racing,'alice',second,second.id,second.updatedAt),/CONFLICT/);
    assert.equal(await readRecipe(db,second.id,'alice'),null);
  }finally{sqlite.close();}
});
test('le foto private restano isolate e la revoca di condivisione si applica anche a foto negli step',async()=>{
  const {db,sqlite}=fixture();try{
    sqlite.exec("INSERT INTO uploads (id,owner_id,name,content_type,created_at) VALUES ('photo','alice','Foto','image/jpeg','2026')");
    assert.ok(await readableUpload(db,'photo','alice'));assert.equal(await readableUpload(db,'photo','bob'),null);
    const shared=await saveRecipe(db,'alice',{...examples[0],visibility:'shared',steps:[{...examples[0].steps[0],image:'/api/media/photo'}]});
    assert.ok(await readableUpload(db,'photo','bob'));
    await saveRecipe(db,'alice',{...shared,visibility:'private'},shared.id,shared.updatedAt);
    assert.equal(await readableUpload(db,'photo','bob'),null);
  }finally{sqlite.close();}
});
test('cento ingredienti vengono indicizzati con un batch limitato di query',async()=>{
  const {db,sqlite}=fixture();try{
    let batchSize=0;const measured={...db,batch:async(s:Parameters<Database['batch']>[0])=>{batchSize=s.length;return db.batch(s);}} as Database;
    const ingredients=Array.from({length:100},(_,i)=>({id:`i${i}`,name:`Ingrediente ${i}`,quantity:1,unit:'g'}));
    await saveRecipe(measured,'alice',{...examples[0],ingredients,steps:[{...examples[0].steps[0],ingredients:[]}]});
    assert.ok(batchSize<=4);assert.equal((sqlite.prepare('SELECT count(*) AS n FROM recipe_ingredients').get() as {n:number}).n,100);
  }finally{sqlite.close();}
});
test('il limite di ricette è applicato al salvataggio, senza dati invisibili oltre il limite dell’elenco',async()=>{
  const {db,sqlite}=fixture();try{
    const original=await saveRecipe(db,'alice',examples[0]);
    sqlite.prepare("WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<999) INSERT INTO recipes SELECT 'copy-'||x,owner_id,title,category,method,visibility,favorite,collection,document,created_at,updated_at,NULL FROM recipes,n WHERE id=?").run(original.id);
    await assert.rejects(()=>saveRecipe(db,'alice',examples[1]),/LIMIT_REACHED/);
    assert.equal((await listRecipes(db,'alice')).length,1000);
    assert.equal((sqlite.prepare('SELECT count(*) AS n FROM recipe_ingredients').get() as {n:number}).n,original.ingredients.length);
  }finally{sqlite.close();}
});
