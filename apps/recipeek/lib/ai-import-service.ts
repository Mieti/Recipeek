import {z} from 'zod';
import {type Database,importRecipe,readableUpload,findImported} from './repository.ts';
import {digest} from './identity.ts';
import {HttpError,readJsonBody} from './http.ts';
import {recipeSchema} from './model.ts';
import {sanitizePhoto} from './photo.ts';
import {transcriptFirst,recipeTextWindow} from './ai-import-text.ts';
import {aiAllowed,reserveImportBudget,settleImportBudget} from './ai-import-budget.ts';
import {importInputSchema,importReviewSchema,publicImportUrl,socialUrl,extractedSchema,needsMore,validateExtraction,recipeFromExtraction,type ImportInput,type ImportSource,type Extraction} from './ai-import-model.ts';
import {extractRecipe,supadata,importPrompt,extractionJsonSchema,ProviderError,ProviderWait,type ImportEnv,type Usage} from './ai-import-provider.ts';

export type ImportJob={id:string;status:string;input:ImportInput;sources:ImportSource[];draft?:Extraction;warnings:string[];usage:Usage[];credits:number|null;duration?:number;videoJob?:string;transcriptJob?:string;polls:number;error?:string;createdAt:string;recipeId?:string;review?:unknown;videoAttempted?:boolean;reviewRevision?:string};
type Row={id:string;owner_id:string;status:string;document:string;created_at:string;updated_at:string;lease:string|null;lease_until:number;next_run_at:number;attempts:number;input_key:string|null;generation:number};
const output=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
async function row(db:Database,id:string,owner:string){const r=await db.prepare('SELECT * FROM ai_imports WHERE id=? AND owner_id=?').bind(id,owner).first<Row>();if(!r)throw new HttpError(404,'Importazione non trovata.');return r;}
function decode(r:Row):ImportJob{return {...JSON.parse(r.document),id:r.id,status:r.status};}
function view(j:ImportJob){return {...j,videoJob:undefined,transcriptJob:undefined,validation:j.draft?validateExtraction(j.draft,j.sources):null,recipe:j.draft?recipeFromExtraction(j.draft,j.input.url):null};}
function credit(j:ImportJob,c:string|null){if(c===null||!Number.isFinite(Number(c)))j.credits=null;else if(j.credits!==null)j.credits+=Number(c);}
export const cleanImportText=(v:string)=>v.replace(/\r\n?/g,'\n').replace(/[\t ]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
const boundedText=(v:unknown)=>typeof v==='string'?cleanImportText(v).slice(0,24000):'';
async function photosFor(j:ImportJob,db:Database,bucket:R2Bucket|undefined,owner:string,prepare=true){
  if(j.input.kind!=='photos')return [];
  if(!bucket)throw new HttpError(503,'Archivio foto non disponibile.');
  const photos=[];let size=0;
  for(const [index,path] of j.input.photos!.entries()){
    const id=path.split('/').at(-1)!,upload=await readableUpload(db,id,owner);
    if(!upload||upload.owner_id!==owner)throw new HttpError(400,'Una foto non appartiene al tuo account.');
    const pinned=await db.prepare("UPDATE uploads SET last_used_at=? WHERE id=? AND owner_id=? AND state='ready'").bind(new Date().toISOString(),id,owner).run();
    if(!pinned.meta.changes)throw new HttpError(409,'Una foto è stata rimossa. Caricala di nuovo.');
    if(!prepare){const stored=await db.prepare('SELECT byte_size FROM uploads WHERE id=? AND owner_id=?').bind(id,owner).first<{byte_size:number}>();size+=stored?.byte_size??6_000_000;if(size>12_000_000)throw new HttpError(413,'Le foto superano 12 MB.');continue;}
    const data=await bucket.get(id);if(!data)throw new HttpError(400,'Foto non disponibile. Caricala di nuovo.');
    size+=data.size;if(size>12_000_000)throw new HttpError(413,'Le foto superano 12 MB.');
    const clean=sanitizePhoto(new Uint8Array(await data.arrayBuffer()),upload.content_type);
    photos.push({id:`photo-${index+1}`,mimeType:upload.content_type,data:Buffer.from(clean.data).toString('base64')});
  }return photos;
}
function videoAllowed(j:ImportJob,env:ImportEnv){return env.RECIPEEK_IMPORT_VIDEO==='true'&&j.input.url&&socialUrl(j.input.url)&&typeof j.duration==='number'&&j.duration>0&&j.duration<=180&&!j.videoAttempted;}
export async function advanceImport(j:ImportJob,env:ImportEnv,db:Database,bucket:R2Bucket|undefined,owner:string,fetcher:typeof fetch=fetch):Promise<ImportJob>{
  if(j.status==='acquire'){
    const social=socialUrl(j.input.url!);
    const r=await supadata(env,social?'metadata':'web/scrape',{url:j.input.url!,...(social?{}:{noLinks:'true'})},undefined,fetcher);credit(j,r.credits);
    const text=social?[r.data.title,r.data.description].filter(v=>typeof v==='string').join('\n'):typeof r.data.content==='string'?r.data.content:'';
    if(text.length>24000)j.warnings.push('Testo troncato a 24.000 caratteri: verificare eventuali informazioni mancanti.');
    j.sources=[{id:social?'caption-1':'web-1',kind:social?'caption':'web',text:boundedText(social?text:recipeTextWindow(text)),label:social?'Titolo e descrizione':'Testo della pagina'}];
    j.duration=typeof r.data.media?.duration==='number'?r.data.media.duration:undefined;
    j.status=social&&transcriptFirst(text)?'transcript':text.trim()?'analyze':'ready';
    if(!text.trim()&&!social)j.warnings.push('Nessun testo leggibile. Prova con una foto o testo incollato.');
  }else if(j.status==='analyze'||j.status==='analyzeTranscript'){
    const phase=j.status;
    const result=await extractRecipe(env,j.sources,await photosFor(j,db,bucket,owner),fetcher,usage=>j.usage.push(usage));j.draft=result.draft;j.reviewRevision=crypto.randomUUID();
    const more=needsMore(j.draft,j.sources)&&j.draft.classification!=='not_recipe';
    if(more&&phase==='analyze'&&j.input.url&&socialUrl(j.input.url))j.status='transcript';
    else if(more&&videoAllowed(j,env))j.status='videoStart';
    else j.status='ready';
  }else if(j.status==='transcript'||j.status==='transcriptPoll'){
    const r=await supadata(env,j.status==='transcriptPoll'?`transcript/${encodeURIComponent(j.transcriptJob!)}`:'transcript',j.status==='transcript'?{url:j.input.url!,text:'false',mode:'native'}:{},undefined,fetcher);credit(j,r.credits);
    if(r.status===202){j.transcriptJob=z.string().min(1).max(200).parse(r.data.jobId);j.status='transcriptPoll';}
    else if(['queued','active','processing'].includes(r.data.status)){j.polls++;if(j.polls>=40)throw new HttpError(504,'Trascrizione ancora in lavorazione. Nessun nuovo job avviato.');}
    else{
      const content=r.data.content??r.data.result?.content;
      const text=typeof content==='string'?content:Array.isArray(content)?content.map((c:{text?:string;offset?:number})=>`${c.offset===undefined?'':`[${c.offset/1000}s] `}${c.text??''}`).join('\n'):'';
      if(text.trim()){
        const plain=cleanImportText(text.replace(/\[\d+(?:\.\d+)?s\] /g,''));
        const repeated=j.sources.some(s=>cleanImportText(s.text).toLocaleLowerCase('it').includes(plain.toLocaleLowerCase('it')));
        if(repeated){j.warnings.push('La trascrizione ripete il testo già analizzato: nessuna seconda chiamata AI.');j.status=videoAllowed(j,env)?'videoStart':'ready';}
        else{j.sources.push({id:'transcript-1',kind:'transcript',text:boundedText(text),label:'Trascrizione disponibile'});if(text.length>24000)j.warnings.push('Trascrizione troncata: controllare la fonte.');j.status='analyzeTranscript';}
      }
      else{j.warnings.push('Trascrizione esistente non disponibile. Nessun audio generato automaticamente.');j.status=videoAllowed(j,env)?'videoStart':'ready';}
    }
  }else if(j.status==='videoStart'){
    if(!videoAllowed(j,env))throw new HttpError(400,'Analisi video disponibile solo se attivata e per video di durata nota entro 3 minuti.');
    j.videoAttempted=true;
    const r=await supadata(env,'extract',{}, {url:j.input.url,prompt:importPrompt+' Usa sourceId video-1 per tutte le osservazioni; inserisci timestamp nel quote. Non dichiarare osservazioni visive come citazioni testuali verificate.',schema:extractionJsonSchema},fetcher);credit(j,r.credits);
    j.videoJob=z.string().min(1).max(200).parse(r.data.jobId);j.status='videoPoll';j.polls=0;
  }else if(j.status==='videoPoll'){
    const r=await supadata(env,`extract/${encodeURIComponent(j.videoJob!)}`,{},undefined,fetcher);credit(j,r.credits);j.polls++;
    if(r.data.status==='completed'){
      const draft=extractedSchema.parse(r.data.data);
      // Keep earlier textual evidence visible even if the visual extractor disagrees.
      if(j.draft)j.warnings.push('Bozza aggiornata dal video: confronta le dosi con la descrizione nelle fonti.');
      j.draft=draft;j.sources.push({id:'video-1',kind:'video',text:'',label:'Analisi video tramite Supadata (osservazioni da verificare)'});j.reviewRevision=crypto.randomUUID();j.status='ready';
    }else if(r.data.status==='failed'||j.polls>=60)throw new HttpError(502,'Analisi video non completata. Non viene avviato un altro job automaticamente.');
  }
  return j;
}

async function createImport(input:ImportInput,inputKey:string,generation:number,db:Database,owner:string,bucket?:R2Bucket){
  const key=generation===0?inputKey:`ai-${await digest(JSON.stringify([inputKey,generation]))}`;
  const duplicate=await db.prepare('SELECT * FROM ai_imports WHERE id=? AND owner_id=?').bind(key,owner).first<Row>();if(duplicate)return output(view(decode(duplicate)));
  const now=new Date().toISOString(),j:ImportJob={id:key,status:input.kind==='url'?'acquire':'analyze',input,sources:input.kind==='text'?[{id:'text-1',kind:'text',text:input.text!,label:'Testo inserito'}]:input.kind==='photos'?input.photos!.map((_,i)=>({id:`photo-${i+1}`,kind:'photo',text:'',label:`Pagina ${i+1}`})):[],warnings:[],usage:[],credits:0,polls:0,createdAt:now};
  await photosFor(j,db,bucket,owner,false);
  const day=now.slice(0,10);
  const inserted=await db.prepare('INSERT OR IGNORE INTO ai_imports (id,owner_id,status,document,created_at,updated_at,input_key,generation) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM ai_imports WHERE owner_id=? AND created_at>=?)<10 AND (SELECT count(*) FROM ai_imports WHERE created_at>=?)<100').bind(key,owner,j.status,JSON.stringify(j),now,now,inputKey,generation,owner,day,day).run();
  if(!inserted.meta.changes){const other=await db.prepare('SELECT * FROM ai_imports WHERE id=? AND owner_id=?').bind(key,owner).first<Row>();if(other)return output(view(decode(other)));throw new HttpError(429,'Limite beta raggiunto: 10 importazioni al giorno per account, 100 complessive.');}
  return output(view(j),201);
}

export async function handleAiImport(req:Request,id:string|undefined,db:Database,owner:string,env:ImportEnv,bucket?:R2Bucket,fetcher:typeof fetch=fetch){
  if(id==='config'&&req.method==='GET'){const state=await db.prepare("SELECT last_tick FROM ai_queue_state WHERE id='imports'").first<{last_tick:number}>();return output({enabled:!!env.GEMINI_API_KEY&&aiAllowed(env,owner),urls:!!env.SUPADATA_API_KEY,video:env.RECIPEEK_IMPORT_VIDEO==='true',queue:!!env.RECIPEEK_IMPORT_QUEUE_TOKEN,lastTick:state?.last_tick??null});}
  if(!id&&req.method==='GET'){const rows=await db.prepare("SELECT id,status,created_at,json_extract(document,'$.draft.title') AS title,json_extract(document,'$.input.url') AS url FROM ai_imports WHERE owner_id=? AND status<>'discarded' ORDER BY created_at DESC LIMIT 50").bind(owner).all<{id:string;status:string;created_at:string;title:string|null;url:string|null}>();return output(rows.results.map(r=>({id:r.id,status:r.status,createdAt:r.created_at,draft:{title:r.title},input:{url:r.url}})));}
  if(!id&&req.method==='POST'){
    if(!aiAllowed(env,owner))throw new HttpError(403,'Importazione AI riservata agli account abilitati per la beta.');
    if(!env.GEMINI_API_KEY)throw new HttpError(503,'Importazione AI in preparazione: servizio non ancora configurato.');
    const input=importInputSchema.parse(await readJsonBody(req));
    if(input.kind==='url'){try{input.url=publicImportUrl(input.url).href;}catch{throw new HttpError(400,'Inserisci un URL HTTPS pubblico senza credenziali o indirizzi IP.');}if(!env.SUPADATA_API_KEY)throw new HttpError(503,'Import da URL non ancora configurato. Usa testo o foto.');}
    if(input.kind==='text'){input.text=cleanImportText(input.text);if(input.text.length<10)throw new HttpError(400,'Inserisci almeno dieci caratteri di testo utile.');}
    const hash=await digest(JSON.stringify([owner,input]));const key=`ai-${hash}`;
    const existing=await db.prepare('SELECT * FROM ai_imports WHERE input_key=? AND owner_id=? ORDER BY generation DESC LIMIT 1').bind(key,owner).first<Row>();
    if(existing&&existing.status!=='discarded')return output(view(decode(existing)));
    return createImport(input,key,existing?existing.generation+1:0,db,owner,bucket);
  }
  if(!id)throw new HttpError(405,'Metodo non consentito.');
  const r=await row(db,id,owner),j=decode(r);
  if(req.method==='GET'){
    const heartbeat=await db.prepare("SELECT last_tick FROM ai_queue_state WHERE id='imports'").first<{last_tick:number}>();
    return output(new URL(req.url).searchParams.get('progress')==='1'?{id:j.id,status:j.status,error:j.error,nextRunAt:r.next_run_at,lastTick:heartbeat?.last_tick??null,ready:['ready','saved','failed','discarded'].includes(j.status)}:view(j));
  }
  const action=z.object({action:z.enum(['advance','deepen','save','review','discard','retry','removeSources']),revision:z.string().optional(),recipe:importReviewSchema.optional(),decisions:z.array(z.object({id:z.string(),status:z.enum(['accepted','edited','rejected']),value:z.string().max(2000)})).max(15).optional(),reviewed:z.literal(true).optional(),servingsConfirmed:z.literal(true).optional(),confirmCost:z.literal(true).optional()}).parse(await readJsonBody(req));
  if(action.action==='retry'){
    if(!aiAllowed(env,owner))throw new HttpError(403,'Importazione AI riservata agli account abilitati per la beta.');
    if(j.status!=='failed'||!action.confirmCost||r.lease_until>Date.now())throw new HttpError(409,'Conferma il possibile costo del nuovo tentativo. Puoi riprovare solo un’importazione fallita.');
    if(!env.GEMINI_API_KEY||(j.input.kind==='url'&&!env.SUPADATA_API_KEY))throw new HttpError(503,'Configura il servizio prima di riprovare.');
    return createImport(j.input,r.input_key??r.id,r.generation+1,db,owner,bucket);
  }
  if(action.action==='removeSources'){
    if(j.status!=='saved'||action.revision!==j.reviewRevision||j.input.kind!=='photos')throw new HttpError(409,'Le foto della fonte possono essere rimosse dopo il salvataggio della ricetta.');
    const now=new Date().toISOString();
    for(const path of j.input.photos??[])await db.prepare('UPDATE uploads SET last_used_at=? WHERE id=? AND owner_id=?').bind(now,path.split('/').at(-1)!,owner).run();
    j.input={kind:'text',text:'Foto della fonte rimosse dall’utente'};j.sources=j.sources.filter(s=>s.kind!=='photo');j.warnings.push('Foto della fonte rimosse; le foto della ricetta sono conservate.');j.reviewRevision=crypto.randomUUID();
    const removed=await db.prepare("UPDATE ai_imports SET document=?,updated_at=? WHERE id=? AND owner_id=? AND status='saved' AND json_extract(document,'$.reviewRevision')=?").bind(JSON.stringify(j),now,id,owner,action.revision).run();
    if(!removed.meta.changes)throw new HttpError(409,'L’importazione è cambiata. Riaprila.');return output(view(j));
  }
  if(action.action==='review'){
    if(j.status!=='ready'||action.revision!==j.reviewRevision||!action.recipe)throw new HttpError(409,'La bozza è cambiata: riaprila.');
    j.review={recipe:action.recipe,decisions:action.decisions??[]};j.reviewRevision=crypto.randomUUID();
    const updated=await db.prepare("UPDATE ai_imports SET document=?,updated_at=? WHERE id=? AND owner_id=? AND status='ready' AND updated_at=? AND json_extract(document,'$.reviewRevision')=? AND lease_until<=?").bind(JSON.stringify(j),new Date().toISOString(),id,owner,r.updated_at,action.revision,Date.now()).run();if(!updated.meta.changes)throw new HttpError(409,'La bozza è cambiata in un’altra finestra. Riaprila.');return output(view(j));
  }
  if(action.action==='save'){
    if(j.status==='saved')return output(view(j));
    if(action.recipe)action.recipe=recipeSchema.parse(action.recipe);
    if(j.status!=='ready'||!j.draft||action.revision!==j.reviewRevision)throw new HttpError(409,'La bozza è cambiata. Riaprila prima di salvare.');
    if(!action.reviewed||!action.servingsConfirmed||!action.recipe)throw new HttpError(400,'Conferma revisione e porzioni prima di salvare.');
    if(!['recipe','partial_recipe'].includes(j.draft.classification))throw new HttpError(400,'Fonte non riconosciuta come ricetta.');
    const decisions=action.decisions??[];
    if(new Set(decisions.map(d=>d.id)).size!==decisions.length||decisions.length!==j.draft.suggestions.length||j.draft.suggestions.some(s=>!decisions.some(d=>d.id===s.id)))throw new HttpError(400,'Accetta o scarta ciascun suggerimento.');
    for(const s of j.draft.suggestions){const d=decisions.find(d=>d.id===s.id)!;if(d.status==='rejected')continue;
      const actual=s.field==='quantity'?action.recipe.ingredients.find(i=>i.id===s.target)?.quantity:s.field==='text'?action.recipe.steps.find(i=>i.id===s.target)?.text:action.recipe[s.field];
      const expected=s.field==='text'?d.value:Number(d.value.replace(',','.'));
      if(actual!==expected)throw new HttpError(400,'Un campo suggerito è stato modificato: aggiorna la proposta e applicala prima di salvare.');
      if(d.status==='accepted'&&d.value!==s.value)throw new HttpError(400,'La proposta modificata deve essere indicata come modifica utente.');
    }
    // The canonical recipe records an immutable import history, not a claim that later edits remain source-backed.
    const history=['Importazione AI: revisione confermata dall’utente.',`Materiale analizzato: ${j.sources.map(s=>s.label).join(', ')}.`,...j.draft.suggestions.map(s=>{const d=decisions.find(d=>d.id===s.id)!;return `Suggerimento ${s.target}/${s.field}: ${d.status==='rejected'?'scartato':d.status==='edited'?'modificato dall’utente':'accettato'}${d.status==='rejected'?'':` (${d.value.slice(0,200)}${d.value.length>200?'…':''})`}.`;})].join('\n');
    if((action.recipe.notes+'\n\n'+history).length>10000)throw new HttpError(400,'Accorcia le note per lasciare spazio alla provenienza dell’importazione.');
    const recipe=recipeSchema.parse({...action.recipe,visibility:'private',notes:(action.recipe.notes+'\n\n'+history).trim()});
    // AI import cannot attach another user's media or arbitrary URLs via the review payload.
    for(const path of [recipe.image,...recipe.steps.map(s=>s.image)].filter(p=>p.startsWith('/api/media/'))){const u=await readableUpload(db,path.split('/').at(-1)!,owner);if(!u||u.owner_id!==owner)throw new HttpError(400,'Foto non appartenente al tuo account.');}
    const locked=await db.prepare("UPDATE ai_imports SET status='saving',lease_until=? WHERE id=? AND owner_id=? AND status='ready' AND updated_at=? AND json_extract(document,'$.reviewRevision')=? AND lease_until<=?").bind(Date.now()+45000,id,owner,r.updated_at,action.revision,Date.now()).run();if(!locked.meta.changes)throw new HttpError(409,'Operazione già in corso o bozza cambiata. Riaprila.');
    try{
      const saved=await importRecipe(db,owner,recipe,{key:j.id});
      j.recipeId=saved.recipe?.id??await findImported(db,owner,{key:j.id})??undefined;j.status='saved';j.review={recipe,decisions};
      await db.prepare("UPDATE ai_imports SET status='saved',document=?,updated_at=?,lease_until=0 WHERE id=? AND owner_id=? AND status='saving'").bind(JSON.stringify(j),new Date().toISOString(),id,owner).run();return output(view(j));
    }catch(e){await db.prepare("UPDATE ai_imports SET status='ready',lease_until=0 WHERE id=? AND owner_id=? AND status='saving'").bind(id,owner).run();throw e;}
  }
  if(action.action==='discard'){
    if(j.status==='saved')throw new HttpError(409,'La ricetta è già salvata. Puoi rimuovere le foto della fonte o usare il cestino del ricettario.');
    if(r.lease_until>Date.now())throw new HttpError(409,'Attendi il termine dell’operazione in corso.');
    j.status='discarded';j.sources=[];j.draft=undefined;j.review=undefined;j.input={kind:'text',text:'Importazione scartata'};
    const discarded=await db.prepare("UPDATE ai_imports SET status='discarded',document=?,updated_at=? WHERE id=? AND owner_id=? AND updated_at=? AND lease_until<=?").bind(JSON.stringify(j),new Date().toISOString(),id,owner,r.updated_at,Date.now()).run();if(!discarded.meta.changes)throw new HttpError(409,'L’importazione è cambiata. Riaprila.');return output(view(j));
  }
  if(action.action==='deepen'){
    if(!aiAllowed(env,owner))throw new HttpError(403,'Importazione AI riservata agli account abilitati per la beta.');
    if(j.status!=='ready'||action.revision!==j.reviewRevision||!videoAllowed(j,env))throw new HttpError(409,'Approfondimento non disponibile o bozza cambiata.');
    j.status='videoStart';delete j.error;
    const changed=await db.prepare("UPDATE ai_imports SET status='videoStart',document=?,next_run_at=0,attempts=0,updated_at=? WHERE id=? AND owner_id=? AND status='ready' AND updated_at=? AND lease_until<=?").bind(JSON.stringify(j),new Date().toISOString(),id,owner,r.updated_at,Date.now()).run();
    if(!changed.meta.changes)throw new HttpError(409,'La bozza è cambiata. Riaprila.');
  }
  // Legacy clients may ask to advance; only the server queue performs work.
  return output(view(j),202);
}

export async function processImportJob(db:Database,id:string,owner:string,env:ImportEnv,bucket?:R2Bucket,fetcher:typeof fetch=fetch){
  const r=await row(db,id,owner),j=decode(r),now=Date.now();
  if(['ready','saved','failed','discarded'].includes(j.status)||r.lease_until>now||r.next_run_at>now)return {job:j,processed:false};
  if(j.status==='saving'){
    const found=await findImported(db,owner,{key:j.id});j.status=found?'saved':'ready';j.recipeId=found??undefined;
    await db.prepare("UPDATE ai_imports SET status=?,document=?,lease_until=0 WHERE id=? AND owner_id=? AND status='saving' AND lease_until<=?").bind(j.status,JSON.stringify(j),id,owner,now).run();return {job:j,processed:true};
  }
  const safePoll=['videoPoll','transcriptPoll'].includes(j.status);
  if(r.lease&&!safePoll){
    if(['analyze','analyzeTranscript'].includes(j.status))j.usage.push({model:'gemini-3.8-flash',input:null,output:null,thought:null,outcome:'unknown'});else j.credits=null;
    j.status=j.draft?'ready':'failed';j.error='Operazione interrotta con esito incerto: non ripetiamo automaticamente la generazione a pagamento.';
  }
  const lease=crypto.randomUUID();
  // This single write serializes claims across all Worker instances, not just one batch.
  const acquired=await db.prepare("UPDATE ai_imports SET lease=?,lease_until=? WHERE id=? AND owner_id=? AND updated_at=? AND lease_until<=? AND next_run_at<=? AND (SELECT count(*) FROM ai_imports WHERE lease IS NOT NULL AND lease_until>?)<2 AND (?<>'photos' OR (SELECT count(*) FROM ai_imports WHERE lease IS NOT NULL AND lease_until>? AND json_extract(document,'$.input.kind')='photos')<1)").bind(lease,now+45000,id,owner,r.updated_at,now,now,now,j.input.kind,now).run();
  if(!acquired.meta.changes)return {job:decode(await row(db,id,owner)),processed:false};
  let attempts=0,next=0;
  try{
    if(!j.error){
      const provider=['analyze','analyzeTranscript'].includes(j.status)?'gemini':'supadata';
      const state=await db.prepare('SELECT next_at FROM ai_provider_state WHERE id=?').bind(provider).first<{next_at:number}>();
      if(state&&state.next_at>Date.now())throw new ProviderWait(state.next_at);
      if(provider==='supadata'){
        const at=Date.now();
        const slot=await db.prepare('INSERT INTO ai_provider_state (id,next_at) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET next_at=excluded.next_at WHERE next_at<=?').bind(provider,at+1200,at).run();
        if(!slot.meta.changes)throw new ProviderWait(at+1200);
      }
      if(!aiAllowed(env,owner))throw new HttpError(403,'Importazione AI riservata agli account abilitati per la beta.');
      await reserveImportBudget(db,lease,j.id,owner,provider,j.status,env,j.input.kind==='photos');
      let sent=false,credits:string|null=null;const before=j.usage.length;
      const tracked=(async(...args:Parameters<typeof fetch>)=>{sent=true;const response=await fetcher(...args);credits=response.headers.get('x-billable-requests');return response;}) as typeof fetch;
      try{await advanceImport(j,env,db,bucket,owner,tracked);}
      finally{await settleImportBudget(db,lease,provider,sent,j.usage.length>before?j.usage.at(-1):undefined,credits);}
    }
    next=Date.now()+(j.status.endsWith('Poll')?5000:0);
  }catch(e){
    if(e instanceof ProviderError&&['acquire','transcript','transcriptPoll','videoStart','videoPoll'].includes(j.status))credit(j,e.credits);
    if(e instanceof ProviderWait){next=e.nextAt;attempts=r.attempts;}
    else if(e instanceof ProviderError&&e.providerStatus===429&&(r.attempts??0)<3){
      attempts=(r.attempts??0)+1;next=Math.max(e.retryAt,Date.now()+Math.min(300000,10000*2**attempts));
      const provider=['analyze','analyzeTranscript'].includes(j.status)?'gemini':'supadata';
      await db.prepare('INSERT INTO ai_provider_state (id,next_at) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET next_at=max(next_at,excluded.next_at)').bind(provider,next).run();
    }
    else if(safePoll&&!(e instanceof HttpError&&[403,429].includes(e.status))&&(r.attempts??0)<2){attempts=(r.attempts??0)+1;next=Date.now()+60000*attempts;}
    else{j.status=j.draft?'ready':'failed';j.error=e instanceof HttpError?e.message:'Importazione interrotta o risposta non valida. Nessun nuovo tentativo automatico.';}
  }
  await db.prepare('UPDATE ai_imports SET status=?,document=?,updated_at=?,lease=NULL,lease_until=0,next_run_at=?,attempts=? WHERE id=? AND owner_id=? AND lease=?').bind(j.status,JSON.stringify(j),new Date().toISOString(),next,attempts,id,owner,lease).run();
  return {job:j,processed:true};
}
