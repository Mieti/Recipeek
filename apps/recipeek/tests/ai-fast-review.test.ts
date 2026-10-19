import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './database.ts';
import {handleAiImport,processImportJob,advanceImport,type ImportJob} from '../lib/ai-import-service.ts';
import {runImportQueue} from '../lib/ai-import-queue.ts';
import {decisionsForSave,evidenceStatus,recipeFromExtraction,type Extraction} from '../lib/ai-import-model.ts';
const text='Pasta: 200 g pasta. Cuoci la pasta. Per 2 persone.';
const e=(quote:string)=>({sourceId:'caption-1',quote});
const draft:Extraction={classification:'recipe',title:'Pasta',description:'',servings:2,servingsEvidence:e('Per 2 persone'),prepMinutes:null,cookMinutes:null,prepEvidence:null,cookEvidence:null,ingredients:[{id:'i1',name:'pasta',quantity:200,unit:'g',originalText:'200 g pasta',evidence:e('200 g pasta')}],steps:[{id:'s1',text:'Cuoci la pasta.',ingredientIds:['i1'],evidence:e('Cuoci la pasta.')}],missing:[],conflicts:[],needsVisual:false,suggestions:[]};
const env={GEMINI_API_KEY:'test-only',SUPADATA_API_KEY:'test-only'};
const req=(body:unknown)=>new Request('https://recipeek.test/api/ai-imports',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const model=()=>Response.json({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(draft)}]}],usage:{total_input_tokens:300,total_output_tokens:300,total_thought_tokens:0}});

test('one queue tick acquires a complete caption and extracts it without waiting another minute',async()=>{
  const {db,sqlite}=fixture();try{
    const job=await (await handleAiImport(req({kind:'url',url:'https://instagram.com/reel/fast'}),undefined,db,'alice',env)).json() as ImportJob;
    let calls=0;
    const fetcher=(async(url:unknown)=>{calls++;return String(url).includes('supadata')?Response.json({description:text},{headers:{'x-billable-requests':'1'}}):model();}) as typeof fetch;
    const result=await runImportQueue(db,env,undefined,fetcher);
    assert.equal(result.processed,1);assert.equal(calls,2);
    assert.equal(sqlite.prepare('SELECT status FROM ai_imports WHERE id=?').get(job.id)?.status,'ready');
  }finally{sqlite.close();}
});

test('foreground continuation is owner-only, compact, respects cooldown and races safely with the queue',async()=>{
  const {db,sqlite}=fixture();try{
    const job=await (await handleAiImport(req({kind:'url',url:'https://instagram.com/reel/fast'}),undefined,db,'alice',env)).json() as ImportJob;
    let calls=0;const fetcher=(async(url:unknown)=>{calls++;return String(url).includes('supadata')?Response.json({description:text},{headers:{'x-billable-requests':'1'}}):model();}) as typeof fetch;
    await assert.rejects(handleAiImport(req({action:'continue'}),job.id,db,'bob',env,undefined,fetcher),/non trovata/);assert.equal(calls,0);
    sqlite.prepare('UPDATE ai_imports SET next_run_at=? WHERE id=?').run(Date.now()+60000,job.id);
    const waiting=await (await handleAiImport(req({action:'continue'}),job.id,db,'alice',env,undefined,fetcher)).json() as any;
    assert.equal(calls,0);assert.equal(waiting.sources,undefined);assert.equal(waiting.input,undefined);
    sqlite.prepare('UPDATE ai_imports SET next_run_at=0 WHERE id=?').run(job.id);
    await Promise.all([handleAiImport(req({action:'continue'}),job.id,db,'alice',env,undefined,fetcher),runImportQueue(db,env,undefined,fetcher)]);
    const done=await (await handleAiImport(req({action:'continue'}),job.id,db,'alice',env,undefined,fetcher)).json() as any;
    assert.equal(done.ready,true);assert.equal(calls,2);assert.equal(done.draft,undefined);
    const view=await (await handleAiImport(new Request('https://recipeek.test/api/ai-imports/x'),job.id,db,'alice',env)).json() as any;
    const recipe={...view.recipe,notes:'Solo le mie note'};
    await handleAiImport(req({action:'save',revision:view.reviewRevision,recipe,decisions:[],reviewed:true,servingsConfirmed:true}),job.id,db,'alice',env);
    const saved=JSON.parse(String(sqlite.prepare('SELECT document FROM ai_imports WHERE id=?').get(job.id)?.document));
    assert.equal(saved.review.recipe.notes,'Solo le mie note');assert.equal(saved.sources.length,1);
  }finally{sqlite.close();}
});

test('missing or duplicate native transcript still analyzes the caption once, without looping',async()=>{
  const {db,sqlite}=fixture();try{
    for(const mode of ['empty','duplicate','404']){
      const base=await (await handleAiImport(req({kind:'url',url:`https://instagram.com/reel/${mode}`}),undefined,db,'alice',env)).json() as ImportJob;
      const j={...base,status:'transcript',sources:[{id:'caption-1',kind:'caption' as const,text,label:'Descrizione'}]};
      sqlite.prepare('UPDATE ai_imports SET status=?,document=? WHERE id=?').run('transcript',JSON.stringify(j),j.id);
      sqlite.prepare('DELETE FROM ai_provider_state').run();
      let calls=0;const fetcher=(async()=>{calls++;return mode==='404'?new Response('{}',{status:404}):Response.json({content:mode==='duplicate'?text:''});}) as typeof fetch;
      const result=await processImportJob(db,j.id,'alice',env,undefined,fetcher);
      assert.equal(result.job.status,'analyzeTranscript');assert.equal(result.job.transcriptAttempted,true);
      await advanceImport(result.job,env,db,undefined,'alice',(async()=>model()) as typeof fetch);
      assert.equal(result.job.status,'ready');assert.equal(calls,1);
    }
  }finally{sqlite.close();}
});

test('confirmation excludes unapplied suggestions and records manual changes to applied suggestions',()=>{
  const proposals:Extraction['suggestions']=[{id:'p1',field:'quantity',target:'i1',value:'250',reason:'Test'},{id:'p2',field:'cookMinutes',target:'recipe',value:'10',reason:'Test'}];
  const recipe=recipeFromExtraction(draft);recipe.ingredients[0].quantity=300;
  const decisions=decisionsForSave(recipe,proposals,[{id:'p1',status:'accepted',value:'250'}]);
  assert.deepEqual(decisions,[{id:'p1',status:'edited',value:'300'},{id:'p2',status:'rejected',value:'10'}]);
  recipe.ingredients=[];assert.equal(decisionsForSave(recipe,proposals,decisions)[0].status,'rejected');
  assert.equal(evidenceStatus(e('200 g pasta'),[{id:'caption-1',kind:'caption',text,label:'Descrizione'}]),'matched');
  assert.equal(evidenceStatus(e('900 g pasta'),[{id:'caption-1',kind:'caption',text,label:'Descrizione'}]),'unmatched');
  assert.equal(evidenceStatus(e('200 g pasta'),[{id:'caption-1',kind:'photo',text:'',label:'Foto'}]),'visual');
});
