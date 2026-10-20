'use client';
import {useEffect,useState,useRef} from 'react';
import {ArrowLeft,Sparkles,Upload,Link,FileText,Check,ChevronRight} from 'lucide-react';
import {type RecipeInput,recipeSchema} from '../../lib/model';
import {applySuggestion,decisionsForSave,evidenceStatus,importReviewSchema,type SuggestionDecision} from '../../lib/ai-import-model';
import type {ImportJob} from '../../lib/ai-import-service';
import {preparePhoto} from '../../lib/prepare-photo';
import DraftEditor from './draft-editor';
import {useKeyboardViewport} from '../use-keyboard-viewport';
import '../recipe-flows.css';
type Job=ImportJob&{nextRunAt?:number;nextPollAt?:number;lastTick?:number|null;recipe:RecipeInput|null;validation:{warnings:string[];blocking:string[]}|null};
const terminal=(s:string)=>['ready','saved','failed','discarded'].includes(s);
const labels:Record<string,string>={saving:'Completo il salvataggio',acquire:'Leggo la descrizione',analyze:'Analizzo il testo o le foto',transcript:'Cerco la trascrizione disponibile',transcriptPoll:'Attendo la trascrizione',analyzeTranscript:'Confronto descrizione e trascrizione',analyzeSupplement:'Confronto il materiale aggiuntivo',videoStart:'Avvio l’approfondimento video',videoPoll:'Analizzo il video',ready:'Bozza da rivedere',saved:'Salvata nel ricettario',failed:'Importazione interrotta',discarded:'Scartata'};
async function call<T>(path='',body?:unknown):Promise<T>{const r=await fetch(`/api/ai-imports${path}`,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const d=await r.json() as T&{error?:string};if(!r.ok){const error=new Error(d.error??'Operazione non riuscita.') as Error&{status:number};error.status=r.status;throw error;}return d;}

export default function ImportPanel(){
  useKeyboardViewport();
  const [config,setConfig]=useState<{enabled:boolean;urls:boolean;video:boolean;queue:boolean;admin:boolean;lastTick:number|null}|null>(null),[jobs,setJobs]=useState<Job[]>([]),[job,setJob]=useState<Job|null>(null),[kind,setKind]=useState('url'),[text,setText]=useState(''),[url,setUrl]=useState(''),[files,setFiles]=useState<File[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[dirty,setDirty]=useState(false),[retryConfirmed,setRetryConfirmed]=useState(false);
  function leave(){return !dirty||window.confirm('Ci sono modifiche non ancora salvate. Vuoi uscire dalla bozza?');}
  function useAlternative(nextKind:'text'|'photos'){if(!leave())return;setJob(null);setKind(nextKind);setError('');void call<Job[]>().then(setJobs).catch(e=>setError(e.message));}
  useEffect(()=>{void Promise.all([call<typeof config>('/config'),call<Job[]>()]).then(([c,j])=>{setConfig(c);setJobs(j);}).catch(e=>setError(e.message));},[]);
  useEffect(()=>{
    if(!job||terminal(job.status))return;
    let stopped=false;
    const t=setTimeout(()=>{void call<{status:string;error?:string;ready:boolean;nextRunAt:number;lastTick?:number|null}>(`/${job.id}?progress=1`,document.visibilityState==='hidden'?undefined:{action:'continue'}).then(async progress=>{
      const current=progress.ready?await call<Job>(`/${job.id}`):{...job,...progress};
      if(!stopped)setJob({...current,nextRunAt:progress.nextRunAt,nextPollAt:progress.status===job.status&&!progress.ready?Date.now()+1500:0});
    }).catch(e=>{if(!stopped)setError(e.message);});},document.visibilityState==='hidden'?30000:Math.min(10000,Math.max(300,Math.max(job.nextRunAt??0,job.nextPollAt??0)-Date.now())));
    return()=>{stopped=true;clearTimeout(t);};
  },[job]);
  useEffect(()=>setRetryConfirmed(false),[job?.id]);
  async function start(){setBusy(true);setError('');try{let photos:string[]=[];if(kind==='photos'){
    if(!files.length||files.length>4)throw new Error('Scegli da una a quattro foto, nell’ordine delle pagine.');
    for(const file of files){const blob=await preparePhoto(file),r=await fetch('/api/media',{method:'POST',headers:{'content-type':blob.type},body:blob}),data=await r.json() as {url:string;error?:string};if(!r.ok)throw new Error(data.error);photos.push(data.url);}
  }setJob(await call<Job>('',kind==='url'?{kind,url}:kind==='text'?{kind,text}:{kind,photos}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <main className="recipe-flow-import import-page"><header className="import-header"><a href="/" className="brand" onClick={e=>{if(!leave())e.preventDefault();}}>recipeek<span>✳</span></a><a href="/" className="button" onClick={e=>{if(!leave())e.preventDefault();}}><ArrowLeft size={16}/>Ricette</a></header>{!job&&<section className="import-intro"><h1>Importa una ricetta</h1></section>}
    {config?.admin&&<a className="text-button" href="/import/monitor">Consumi e stato importazioni →</a>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    {!job?<><section className="import-card"><div className="import-tabs" role="group" aria-label="Tipo di fonte">{[['url','Link',Link],['text','Testo',FileText],['photos','Foto',Upload]].map(([value,label,Icon])=><button type="button" key={String(value)} className={kind===value?'active':''} aria-pressed={kind===value} onClick={()=>setKind(String(value))}>{typeof Icon!=='string'&&<Icon size={18}/>} {String(label)}</button>)}</div>
      {config&&!config.enabled&&<p role="status" className="import-notice">L’importazione AI è in preparazione. Il servizio deve essere configurato prima di analizzare nuove fonti.</p>}
      {kind==='url'?<label>URL della ricetta<input type="url" placeholder="https://…" value={url} onChange={e=>setUrl(e.target.value)}/><small>Instagram, TikTok, YouTube o siti di ricette. I contenuti privati potrebbero non essere accessibili.</small></label>:kind==='text'?<label>Testo della ricetta<textarea rows={9} maxLength={24000} placeholder="Incolla ingredienti o procedimento…" value={text} onChange={e=>setText(e.target.value)}/></label>:<label className="import-upload">Pagine della ricetta<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>setFiles(Array.from(e.target.files??[]))}/><small>Fino a 4 foto JPEG, PNG o WebP · max 6 MB ciascuna, 12 MB totali. L’ordine scelto è quello di lettura.</small>{files.map((f,i)=><span key={i}>{i+1}. {f.name}</span>)}</label>}
      {kind==='photos'&&<CameraPhoto onAdd={file=>setFiles(current=>[...current,file])}/>}
      <p className="muted">Bozza privata · fonte analizzata con AI.</p>
      <button className="button primary" disabled={busy||!config?.enabled||(kind==='url'&&!config?.urls)} onClick={()=>void start()}><Sparkles size={18}/>{busy?'Preparo la fonte…':'Importa ricetta'}</button>
    </section><section className="import-history"><h2>Le tue importazioni</h2>{jobs.filter(j=>j.status!=='discarded').map(j=><button key={j.id} onClick={()=>{setError('');void call<Job>(`/${j.id}`).then(setJob).catch(e=>setError(e.message));}}><span><strong>{j.draft?.title||j.input.url||'Ricetta da importare'}</strong><small>{labels[j.status]}</small></span><ChevronRight size={18}/></button>)}{!jobs.length&&<p className="muted">Le bozze compariranno qui e potrai riprenderle anche da un altro dispositivo.</p>}</section></>:<>
      <button className="text-button" onClick={()=>{if(!leave())return;setJob(null);void call<Job[]>().then(setJobs).catch(e=>setError(e.message));}}>← Tutte le importazioni</button>
      {!terminal(job.status)&&<section className="import-card import-activity" role="status"><span className="spinner"/><h2>{labels[job.status]}</h2>{(job.nextRunAt??0)>Date.now()&&<p>Riprenderà automaticamente.</p>}{(!config?.queue||Date.now()-(job.lastTick??config.lastTick??0)>180000)&&<p className="import-notice">Elaborazione in ritardo. La fonte è conservata: evita un nuovo import.</p>}{error&&<button className="button" onClick={()=>{setError('');setJob({...job});}}>Aggiorna stato</button>}</section>}
      {job.error&&<p className="import-notice" role="alert">{job.error}</p>}
      {job.status==='ready'&&job.draft&&(['recipe','partial_recipe'].includes(job.draft.classification)?<Review key={`${job.id}:${job.integrationVersion??0}`} job={job} onUpdate={setJob} onDirty={setDirty} video={!!config?.video}/>:<section className="import-card"><h2>{job.draft.classification==='not_recipe'?'Questo contenuto non contiene una ricetta.':'Il materiale non basta per una bozza.'}</h2><p>{job.draft.classification==='not_recipe'?'Importa una fonte con ingredienti e procedimento.':'Aggiungi testo completo o una foto leggibile.'}</p><ImportSources job={job}/><div className="button-row"><button className="button" onClick={()=>useAlternative('text')}>Aggiungi testo</button><button className="button" onClick={()=>useAlternative('photos')}>Aggiungi foto</button></div></section>)}
      {job.status==='ready'&&(!job.draft||job.draft.classification==='insufficient_content')&&<Supplement job={job} run={async body=>setJob(await call<Job>(`/${job.id}`,{...body,revision:job.reviewRevision}))}/>}
      {job.status==='failed'&&<section className="import-card"><h2>Riprovare questa fonte?</h2><p>Il tentativo precedente è conservato. La nuova analisi può avere un costo.</p><label className="check-label"><input type="checkbox" checked={retryConfirmed} onChange={e=>setRetryConfirmed(e.target.checked)}/>Confermo il possibile costo del nuovo tentativo.</label><button className="button primary" disabled={busy||!retryConfirmed||!config?.enabled} onClick={()=>{setBusy(true);setError('');void call<Job>(`/${job.id}`,{action:'retry',confirmCost:true}).then(setJob).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>Riprova la fonte</button></section>}
      {job.status==='ready'&&!job.draft&&<section className="import-card"><h2>Non abbiamo abbastanza materiale.</h2><p>Aggiungi una nuova importazione con testo o foto più leggibili.</p>{job.warnings.map((w,i)=><p key={i}>{w}</p>)}</section>}
      {(job.status==='failed'||job.status==='ready'&&!job.draft)&&<div className="button-row"><button className="button" onClick={()=>useAlternative('text')}>Aggiungi testo</button><button className="button" onClick={()=>useAlternative('photos')}>Aggiungi foto</button></div>}
      {job.status==='saved'&&<section className="import-card"><Check/><h2>Salvata.</h2><p>La ricetta privata è disponibile in Ricette.</p><a href="/" className="button primary">Apri Ricette</a>{(job.input.kind==='photos'||job.sources.some(s=>s.photoPath))&&<button className="text-button" onClick={()=>{setBusy(true);void call<Job>(`/${job.id}`,{action:'removeSources',revision:job.reviewRevision}).then(setJob).catch(e=>setError(e.message)).finally(()=>setBusy(false));}} disabled={busy}>Rimuovi le foto della fonte · conserva la ricetta</button>}</section>}
      {job.status!=='saved'&&job.status!=='discarded'&&<button className="text-button" onClick={()=>{if(leave())void call<Job>(`/${job.id}`,{action:'discard'}).then(setJob).catch(e=>setError(e.message));}}>Scarta questa importazione</button>}
    </>}
  </main>;
}

function ImportSources({job}:{job:Job}){
  const evidence=job.draft?[...job.draft.ingredients.map(i=>i.evidence),...job.draft.steps.map(s=>s.evidence),job.draft.servingsEvidence,job.draft.prepEvidence,job.draft.cookEvidence].filter((e):e is {sourceId:string;quote:string}=>!!e):[];
  const counts=evidence.reduce((n,e)=>{n[evidenceStatus(e,job.sources)]++;return n;},{matched:0,unmatched:0,visual:0});
  return <details className="import-sources"><summary>Fonti e controlli</summary>
    {job.input.url&&<a href={job.input.url} target="_blank" rel="noreferrer">Apri il contenuto originale ↗</a>}
    <p className="field-help">{job.sources.map(s=>s.label).join(' · ')}. {job.sources.every(s=>!['photo','video'].includes(s.kind))?'Il video e le immagini non sono stati analizzati.':''}</p>
    {evidence.length>0&&<p className="field-help">{counts.matched} citazioni riscontrate nel testo{counts.unmatched>0?'; '+counts.unmatched+' non riscontrate':''}{counts.visual>0?'; '+counts.visual+' letture visive da verificare':''}. Il riscontro testuale non certifica l’interpretazione di dosi e istruzioni.</p>}
    {evidence.length>0&&<details><summary>Citazioni utilizzate</summary><ul>{evidence.map((e,i)=><li key={i}><q>{e.quote}</q> <small>— {evidenceStatus(e,job.sources)==='matched'?'presente nel testo':evidenceStatus(e,job.sources)==='visual'?'lettura visiva':'non riscontrata'}</small></li>)}</ul></details>}
    {job.sources.map(s=><details key={s.id}><summary>{s.label}</summary>{s.kind==='photo'?<img className="import-source-photo" src={s.photoPath??job.input.photos?.[Number(s.id.split('-')[1])-1]} alt={s.label}/>:<pre>{s.text||'Osservazioni video da verificare nel contenuto originale.'}</pre>}</details>)}
    {[...job.warnings,...job.validation?.blocking??[],...job.validation?.warnings??[]].length>0&&<details><summary>Dettaglio dei controlli</summary><ul>{[...new Set([...job.warnings,...job.validation?.blocking??[],...job.validation?.warnings??[]])].map((w,i)=><li key={i}>{w}</li>)}</ul></details>}
  </details>;
}

function CameraPhoto({onAdd}:{onAdd:(file:File)=>void}){return <label>Scatta una foto<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>{const file=e.target.files?.[0];if(file)onAdd(file);e.target.value='';}}/><small>Per immagini HEIC, esporta prima in JPEG.</small></label>;}
function Supplement({job,run}:{job:Job;run:(body:Record<string,unknown>)=>Promise<void>}){
  const [kind,setKind]=useState('text'),[text,setText]=useState(''),[files,setFiles]=useState<File[]>([]),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(action:string){setBusy(true);setError('');try{
    let input:unknown;
    if(action==='supplement'){
      if(kind==='text'){if(text.trim().length<10)throw new Error('Inserisci almeno dieci caratteri utili.');input={kind,text};}
      else{if(!files.length||files.length>4)throw new Error('Scegli da una a quattro foto.');const photos:string[]=[];for(const file of files){const blob=await preparePhoto(file),r=await fetch('/api/media',{method:'POST',headers:{'content-type':blob.type},body:blob}),data=await r.json() as {url:string;error?:string};if(!r.ok)throw new Error(data.error??'Caricamento non riuscito.');photos.push(data.url);}input={kind,photos};}
    }
    await run({action,input,confirmCost:action==='supplement'?confirmed:undefined});
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section className="import-supplement"><h3>Completa con altro materiale</h3>{job.candidate?<>
    <p>Confronta il risultato prima di integrarlo. Le correzioni e i passaggi già presenti restano invariati.</p>
    <details><summary>Confronta la nuova analisi</summary><h4>{job.candidate.title}</h4><ul>{job.candidate.ingredients.map(i=><li key={i.id}>{i.quantity??'Dose non specificata'} {i.unit} {i.name}</li>)}</ul><ol>{job.candidate.steps.map(s=><li key={s.id}>{s.text}</li>)}</ol>{[...job.candidate.missing,...job.candidate.conflicts].map((w,i)=><p key={i}>{w}</p>)}</details>
    <div className="button-row"><button className="button primary" disabled={busy} onClick={()=>void submit('acceptCandidate')}>Integra i campi mancanti</button><button className="button" disabled={busy} onClick={()=>void submit('rejectCandidate')}>Conserva solo la bozza precedente</button></div>
  </>:<details><summary>Aggiungi materiale alla bozza</summary><p>Usa solo testo o foto della stessa ricetta. L’analisi consuma budget e resta separata finché non integri il risultato. Massimo 3 integrazioni e 4 foto totali.</p><label>Materiale<select value={kind} onChange={e=>setKind(e.target.value)}><option value="text">Testo</option><option value="photos">Foto</option></select></label>{kind==='text'?<label>Informazioni mancanti<textarea rows={5} maxLength={24000} value={text} onChange={e=>setText(e.target.value)}/></label>:<label>Foto aggiuntive<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>setFiles(Array.from(e.target.files??[]))}/><small>JPEG, PNG o WebP. Per HEIC esporta prima in JPEG.</small></label>}<label className="check-label"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Confermo che è la stessa ricetta e autorizzo la nuova analisi.</label><button className="button" disabled={busy||!confirmed||(job.supplementTimes?.length??0)>=3} onClick={()=>void submit('supplement')}>{busy?'Preparo l’integrazione…':'Analizza il materiale aggiuntivo'}</button></details>}{error&&<p className="form-error" role="alert">{error}</p>}</section>;
}

function Review({job,onUpdate,onDirty,video}:{job:Job;onUpdate:(j:Job)=>void;onDirty:(dirty:boolean)=>void;video:boolean}){
  const prior=job.review as {recipe?:RecipeInput;decisions?:SuggestionDecision[]}|undefined;
  const [recipe,setRecipe]=useState<RecipeInput>(prior?.recipe??job.recipe!),[decisions,setDecisions]=useState<SuggestionDecision[]>(prior?.decisions??[]),[servings,setServings]=useState(prior?.recipe?(prior.recipe.servings>0?String(prior.recipe.servings):''):job.draft!.servings===null?'':String(job.draft!.servings)),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const draft=job.draft!;
  const revision=useRef(job.reviewRevision),writes=useRef<Promise<unknown>>(Promise.resolve()),conflict=useRef(false),finalizing=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const value={recipe:{...recipe,servings:servings===''?0:Number(servings)},decisions};
  const complete=recipeSchema.safeParse(value.recipe).success;
  const snapshot=JSON.stringify(value),persisted=useRef(snapshot),latest=useRef(snapshot);
  latest.current=snapshot;
  const [saveState,setSaveState]=useState('');
  const dirty=snapshot!==persisted.current;
  useEffect(()=>{onDirty(dirty);},[dirty,onDirty]);
  useEffect(()=>()=>onDirty(false),[onDirty]);
  useEffect(()=>{const guard=(event:BeforeUnloadEvent)=>{if(latest.current!==persisted.current){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[]);
  function persist(action:'save'|'review',encoded=latest.current){
    const operation=writes.current.catch(()=>{}).then(async()=>{
      if(conflict.current)throw new Error('La bozza è cambiata in un’altra finestra. Conserva le tue modifiche e riapri la pagina.');
      if(action==='review'&&encoded===persisted.current)return;
      const current=JSON.parse(encoded) as {recipe:RecipeInput;decisions:SuggestionDecision[]};
      const parsed=(action==='save'?recipeSchema:importReviewSchema).parse(current.recipe);
      setSaveState('Salvataggio in corso…');
      try{
        const result=await call<Job>(`/${job.id}`,{action,revision:revision.current,recipe:parsed,decisions:action==='save'?decisionsForSave(parsed,draft.suggestions,current.decisions):current.decisions,reviewed:action==='save'?true:undefined,servingsConfirmed:action==='save'?true:undefined});
        revision.current=result.reviewRevision;persisted.current=encoded;setSaveState('Bozza salvata');
        if(action==='save')onUpdate(result);
      }catch(error){if((error as Error&{status?:number}).status===409)conflict.current=true;setSaveState('Salvataggio non riuscito');throw error;}
    });
    writes.current=operation;return operation;
  }
  useEffect(()=>{
    if(!dirty||conflict.current||finalizing.current)return;
    timer.current=setTimeout(()=>{void persist('review',snapshot).catch(e=>setError(e.message));},900);
    return()=>{if(timer.current)clearTimeout(timer.current);};
  },[snapshot]);
  function choose(s:typeof draft.suggestions[number],status:SuggestionDecision['status'],value=s.value){try{if(status!=='rejected')setRecipe(applySuggestion(recipe,s,value));else if(decisions.some(d=>d.id===s.id&&d.status!=='rejected')){const baseline=job.recipe!;const restored=structuredClone(recipe);if(s.field==='quantity'){const i=restored.ingredients.find(i=>i.id===s.target);if(i)i.quantity=baseline.ingredients.find(i=>i.id===s.target)?.quantity??null;}else if(s.field==='text'){const step=restored.steps.find(i=>i.id===s.target);if(step)step.text=baseline.steps.find(i=>i.id===s.target)?.text??step.text;}else{restored[s.field]=baseline[s.field];if(s.field==='servings')setServings(draft.servings===null?'':String(draft.servings));}setRecipe(restored);}if(s.field==='servings'&&status!=='rejected')setServings(value);setDecisions(old=>[...old.filter(d=>d.id!==s.id),{id:s.id,status,value}]);}catch(e){setError((e as Error).message);}}
  async function save(action:'save'|'review'){setBusy(true);setError('');if(timer.current)clearTimeout(timer.current);finalizing.current=action==='save';try{await persist(action);if(action==='review')setMessage('Bozza salvata. Puoi riprenderla da un altro dispositivo.');}catch(e){setError((e as Error).message);}finally{setBusy(false);finalizing.current=false;}}
  const showServingsInput=draft.servings===null&&!(prior?.recipe?.servings&&prior.recipe.servings>0);
  const missingDoses=recipe.ingredients.filter(i=>i.quantity===null&&i.quantityKind!=='to_taste');
  const unresolvedEvidence=[...draft.ingredients.map(i=>i.evidence),...draft.steps.map(s=>s.evidence)].filter(e=>evidenceStatus(e,job.sources)==='unmatched').length;
  const doseChecks=job.validation?.warnings.filter(w=>w.includes('associazione')||w.includes('unità da verificare')||w.includes('valore numerico da verificare')).length??0;
  const proposed=(target:string)=>draft.suggestions.some(s=>s.target===target&&decisions.some(d=>d.id===s.id&&d.status!=='rejected'));
  const supplement=<Supplement job={job} run={async body=>{if(timer.current)clearTimeout(timer.current);finalizing.current=true;setBusy(true);try{await persist('review');const result=await call<Job>(`/${job.id}`,{...body,revision:revision.current});revision.current=result.reviewRevision;onUpdate(result);}finally{finalizing.current=false;setBusy(false);}}}/>;
  return <section className="import-card import-review"><fieldset className="import-review-body" disabled={busy}>
    <div className="recipe-preview-heading"><p className="eyebrow">Revisione</p><h2>{recipe.title||'Ricetta da completare'}</h2>{recipe.description&&<p>{recipe.description}</p>}<div className="recipe-preview-meta">{servings&&<span>{servings} porzioni{proposed('recipe')?' · AI':''}</span>}{recipe.prepMinutes+recipe.cookMinutes>0&&<span>{recipe.prepMinutes+recipe.cookMinutes} min</span>}</div></div>
    {(missingDoses.length>0||showServingsInput||!servings||!recipe.ingredients.length||!recipe.steps.length||draft.conflicts.length>0||unresolvedEvidence>0||doseChecks>0)&&<div className="import-checks" role="status"><strong>Un ultimo controllo</strong>
      {missingDoses.length>0&&<p>Dosi non indicate per {missingDoses.slice(0,3).map(i=>i.name).join(', ')}{missingDoses.length>3?' e altri '+(missingDoses.length-3)+' ingredienti':''}. Puoi salvarle così e completarle in seguito.</p>}
       {!recipe.steps.length&&<p>Manca il procedimento: aggiungi testo o foto per completarlo.</p>}{!recipe.ingredients.length&&<p>Mancano gli ingredienti: aggiungili o integra la fonte.</p>}
      {draft.conflicts.map((c,i)=><p key={i}>{c}</p>)}{unresolvedEvidence>0&&<p>Alcune istruzioni o ingredienti non hanno un riscontro testuale. Controllali nella fonte prima di confermare.</p>}{doseChecks>0&&<p>Alcune dosi o tempi richiedono un confronto con la fonte. Trovi i dettagli nei controlli dell’analisi.</p>}
       {showServingsInput&&<label>Per quante persone?<input aria-label="Porzioni della ricetta" type="number" min="1" max="100" placeholder="Es. 2" value={servings} onChange={e=>setServings(e.target.value)}/><small>La fonte non le indica; servono per ricalcolare le dosi.</small></label>}
    </div>}
    {!editing&&<div className="recipe-preview-content"><section><h3>Ingredienti</h3><ul className="recipe-preview-ingredients">{recipe.ingredients.map(i=><li key={i.id}><span>{i.name}{proposed(i.id)&&<small className="ai-inline">Proposta AI</small>}</span><strong>{i.quantity!==null?i.quantity+' '+i.unit:i.quantityKind==='to_taste'?'q.b.':'Dose non indicata'}</strong></li>)}</ul></section><section><h3>Preparazione</h3><ol className="recipe-preview-steps">{recipe.steps.map((s,index)=><li key={s.id}><span>{index+1}</span><p>{s.text}{proposed(s.id)&&<small className="ai-inline">Proposta AI</small>}</p></li>)}</ol></section>{recipe.notes&&<section><h3>Le tue note</h3><p>{recipe.notes}</p></section>}</div>}
    <details className="recipe-edit" open={editing} onToggle={e=>setEditing(e.currentTarget.open)}><summary>Modifica ricetta</summary>
    <DraftEditor recipe={recipe} setRecipe={setRecipe} servings={servings} setServings={setServings}/></details>
    {draft.suggestions.length>0&&<details className="import-suggestions"><summary>Suggerimenti AI facoltativi ({draft.suggestions.length})</summary><p>Proposte separate dalla fonte. Applica solo quelle che vuoi usare; le altre saranno escluse.</p>{draft.suggestions.map(s=><Suggestion key={s.id} suggestion={s} label={(s.field==="quantity"?recipe.ingredients.find(i=>i.id===s.target)?.name:s.field==="text"?`Passaggio ${recipe.steps.findIndex(i=>i.id===s.target)+1}`:{servings:"Porzioni",prepMinutes:"Tempo di preparazione",cookMinutes:"Tempo di cottura"}[s.field])??"Campo della ricetta"} decision={decisions.find(d=>d.id===s.id)} choose={(status,value)=>choose(s,status,value)}/>)}</details>}

    {job.candidate&&supplement}
    {error&&<p className="form-error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    {!complete&&<p className="field-help">Per salvare servono titolo, porzioni, ingredienti e almeno un passaggio. La bozza incompleta resta disponibile qui.</p>}
    <div className="recipe-confirm"><button className="button primary" disabled={busy||!!job.candidate||!complete||!servings||!['recipe','partial_recipe'].includes(draft.classification)} onClick={()=>void save('save')}><Check size={18}/>{busy?'Salvo…':draft.suggestions.length?'Conferma e salva · escludi i suggerimenti non applicati':'Conferma e salva'}</button><small role="status">{dirty?(saveState==='Salvataggio in corso…'?saveState:'Salvo le modifiche…'):saveState||'Puoi modificarla anche dopo il salvataggio.'}</small></div>
    {!job.candidate&&<details className="import-extra"><summary>Mancano informazioni? Aggiungi testo o foto</summary>{supplement}</details>}
    {video&&job.input.url&&!job.videoAttempted&&typeof job.duration==='number'&&job.duration>0&&job.duration<=180&&<details><summary>Approfondisci il video</summary><button className="button" disabled={busy} onClick={()=>{setBusy(true);if(timer.current)clearTimeout(timer.current);void persist('review').then(()=>call<Job>(`/${job.id}`,{action:'deepen',revision:revision.current})).then(onUpdate).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>Analizza il video · sostituisce la bozza</button></details>}
    <ImportSources job={job}/>
  </fieldset></section>;
}

function Suggestion({suggestion:s,label,decision,choose}:{label:string;suggestion:NonNullable<Job['draft']>['suggestions'][number];decision?:SuggestionDecision;choose:(s:SuggestionDecision['status'],v:string)=>void}){const [value,setValue]=useState(decision?.value??s.value);return <div className="import-suggestion"><strong>{label}</strong><p>{s.reason}</p><label>Proposta<input value={value} onChange={e=>setValue(e.target.value)}/></label>{decision?<p>Scelta: {decision.status==='rejected'?'scartata':decision.status==='edited'?'modificata e applicata':'accettata'}</p>:<p>Da decidere</p>}<div className="button-row"><button className="button" onClick={()=>choose(value===s.value?'accepted':'edited',value)}>Applica proposta</button><button className="text-button" onClick={()=>choose('rejected',value)}>Scarta</button></div></div>;}
