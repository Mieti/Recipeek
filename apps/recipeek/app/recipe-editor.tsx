'use client';

import {useCallback,useEffect,useId,useRef,useState} from 'react';
import {ArrowDown,ArrowUp,Camera,Check,ChevronDown,Lock,Plus,Trash2,X} from 'lucide-react';
import {categories,methods,recipeSchema,type RecipeInput} from '../lib/model';
import {canonicalUnit,isKnownUnit,unitGroups} from '../lib/units';
import {preparePhoto} from '../lib/prepare-photo';
import './recipe-editor-compact.css';

type Props={
  initial:RecipeInput;
  initialSection:number;
  onBusyChange:(busy:boolean)=>void;
  onDraft:(value:RecipeInput,section:number)=>boolean;
  collections:string[];
  onSave:(recipe:RecipeInput)=>Promise<void>;
};

function Photo({src,title}:{src:string;title:string}){
  return src?<img src={src} alt={title} className="recipe-editor-photo" loading="lazy"/>:null;
}

function PhotoUpload({value,onChange,label='Foto della ricetta',onBusyChange}:{value:string;onChange:(url:string)=>void;label?:string;onBusyChange:(active:boolean)=>void}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function upload(file?:File){
    if(!file)return;
    onBusyChange(true);setBusy(true);setError('');
    try{
      const photo=await preparePhoto(file);
      const response=await fetch('/api/media',{method:'POST',headers:{'content-type':photo.type},body:photo});
      const result=await response.json() as {error?:string;url:string};
      if(!response.ok)throw new Error(result.error||'Caricamento foto non riuscito');
      onChange(result.url);
    }catch(e){setError((e as Error).message);}
    finally{setBusy(false);onBusyChange(false);}
  }
  return <div className={`photo-upload${value?' has-image':''}`}>
    {value&&<Photo src={value} title={label}/>}
    <label className={`upload-zone${value?' has-photo':' is-compact'}`}>
      <Camera size={22}/><strong>{busy?'Caricamento…':value?'Cambia foto':label}</strong>
      {!value&&<span>JPEG, PNG o WebP · max 6 MB</span>}
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} aria-label={label} onChange={e=>{void upload(e.target.files?.[0]);e.currentTarget.value='';}}/>
    </label>
    {value&&<button type="button" className="text-button" onClick={()=>onChange('')}>Rimuovi foto</button>}
    {error&&<p className="form-error" role="alert">{error}</p>}
  </div>;
}

function PanFields({pan,onChange}:{pan:NonNullable<RecipeInput['pan']>;onChange:(value:NonNullable<RecipeInput['pan']>)=>void}){
  return <div className="form-grid">
    <label>Forma<select value={pan.shape} onChange={e=>onChange({...pan,shape:e.target.value as 'round'|'rectangle'})}><option value="round">Tonda</option><option value="rectangle">Rettangolare</option></select></label>
    <label>{pan.shape==='round'?'Diametro':'Larghezza'} · cm<input type="number" min={1} max={100} value={pan.width} onChange={e=>onChange({...pan,width:Number(e.target.value)||1})}/></label>
    {pan.shape==='rectangle'&&<label>Lunghezza · cm<input type="number" min={1} max={100} value={pan.length} onChange={e=>onChange({...pan,length:Number(e.target.value)||1})}/></label>}
  </div>;
}

function ingredientDose(ingredient:RecipeInput['ingredients'][number]){
  if(ingredient.quantity!==null)return `${ingredient.quantity}${ingredient.unit?` ${ingredient.unit}`:''}`;
  return ingredient.quantityKind==='unspecified'?'Dose non indicata':'q.b.';
}

function QuantityField({id,value,label,placeholder,onChange}:{id:string;value:number|null;label:string;placeholder:string;onChange:(value:number|null)=>void}){
  const [text,setText]=useState(value===null?'':String(value)),focused=useRef(false);
  useEffect(()=>{if(!focused.current)setText(value===null?'':String(value));},[value]);
  return <input id={id} aria-label={label} type="number" inputMode="decimal" min="0.001" step="any" value={text} placeholder={placeholder} onFocus={()=>{focused.current=true;}} onBlur={()=>{focused.current=false;setText(value===null?'':String(value));}} onChange={e=>{setText(e.target.value);onChange(e.target.value?Number(e.target.value):null);}}/>;
}

export default function RecipeEditor({initial,initialSection,onBusyChange,onDraft,collections,onSave}:Props){
  const sectionNames=['La ricetta','Ingredienti','Procedimento'];
  const baseId=useId().replace(/[^a-zA-Z0-9_-]/g,'');
  const [form,setForm]=useState<RecipeInput>(()=>structuredClone(initial));
  const [section,setSection]=useState(()=>Number.isInteger(initialSection)&&initialSection>=0&&initialSection<3?initialSection:0);
  const [selectedIngredient,setSelectedIngredient]=useState<string|null>(null);
  const [selectedStep,setSelectedStep]=useState<string|null>(null);
  const [error,setError]=useState(''),[saving,setSaving]=useState(false),[uploads,setUploads]=useState(0),[persisted,setPersisted]=useState(true);
  const ingredientInputs=useRef(new Map<string,HTMLInputElement>()),stepInputs=useRef(new Map<string,HTMLTextAreaElement>()),savingRef=useRef(false),uploadsRef=useRef(0);
  const collectionListId=`${baseId}-collections`;

  useEffect(()=>{setPersisted(onDraft(form,section));},[form,section,onDraft]);
  useEffect(()=>{onBusyChange(saving||uploads>0);return()=>onBusyChange(false);},[saving,uploads,onBusyChange]);
  const uploadStatus=useCallback((active:boolean)=>setUploads(count=>{const next=Math.max(0,count+(active?1:-1));uploadsRef.current=next;return next;}),[]);

  const set=<K extends keyof RecipeInput>(key:K,value:RecipeInput[K])=>setForm(current=>({...current,[key]:value}));
  const updateIngredient=(id:string,patch:Partial<RecipeInput['ingredients'][number]>)=>setForm(current=>({...current,ingredients:current.ingredients.map(item=>item.id===id?{...item,...patch}:item)}));
  const updateStep=(id:string,patch:Partial<RecipeInput['steps'][number]>)=>setForm(current=>({...current,steps:current.steps.map(item=>item.id===id?{...item,...patch}:item)}));
  function focusNewIngredient(id:string){requestAnimationFrame(()=>ingredientInputs.current.get(id)?.focus());}
  function focusNewStep(id:string){requestAnimationFrame(()=>stepInputs.current.get(id)?.focus());}
  function removeIngredient(id:string){
    setForm(current=>({...current,ingredients:current.ingredients.filter(item=>item.id!==id),steps:current.steps.map(step=>({...step,ingredients:step.ingredients.filter(use=>use.ingredientId!==id)}))}));
    setSelectedIngredient(null);
  }
  function moveStep(id:string,direction:number){
    setForm(current=>{const steps=[...current.steps],index=steps.findIndex(step=>step.id===id),next=index+direction;if(index<0||next<0||next>=steps.length)return current;[steps[index],steps[next]]=[steps[next],steps[index]];return {...current,steps};});
  }
  async function submit(){
    if(uploadsRef.current||savingRef.current)return;
    setError('');
    const result=recipeSchema.safeParse(form);
    if(!result.success){setError(result.error.issues.map(issue=>issue.message).join('. '));return;}
    savingRef.current=true;setSaving(true);
    try{await onSave(result.data);}catch(e){setError((e as Error).message);}finally{savingRef.current=false;setSaving(false);}
  }

  return <div className="recipe-editor">
    <fieldset disabled={saving||uploads>0}>
      <header className="editor-intro">
        <div><h2>{'id'in initial?'Modifica la ricetta':'Nuova ricetta'}</h2></div>
        <p className="field-help editor-autosave" role="status" aria-live="polite">{persisted?'Bozza salvata automaticamente su questo browser.':'Impossibile salvare la bozza qui. Salva la ricetta prima di chiudere.'}</p>
      </header>

      <div className="editor-sections" aria-label="Sezioni della ricetta">
        {sectionNames.map((name,index)=>{
          const expanded=section===index,buttonId=`${baseId}-section-button-${index}`,panelId=`${baseId}-section-panel-${index}`;
          const count=index===1?form.ingredients.length:index===2?form.steps.length:null;
          return <section className={`editor-section-card${expanded?' is-open':''}`} key={name}>
            <h3><button type="button" className="editor-section-toggle" id={buttonId} aria-expanded={expanded} aria-controls={panelId} onClick={()=>{setSection(index);requestAnimationFrame(()=>requestAnimationFrame(()=>document.getElementById(buttonId)?.scrollIntoView({block:'start'})));}}><span className="editor-section-number">0{index+1}</span><span>{name}</span>{count!==null&&<span className="editor-section-count">{count}</span>}<ChevronDown size={18} aria-hidden="true"/></button></h3>
            <div className="editor-section-panel" id={panelId} role="region" aria-labelledby={buttonId} hidden={!expanded}>
              {index===0&&<div className="editor-core-fields">
                <label>Titolo<input value={form.title} maxLength={140} placeholder="Es. La lasagna della domenica" onChange={e=>set('title',e.target.value)}/></label>
                <label>Descrizione<textarea value={form.description} maxLength={3000} placeholder="Cosa rende speciale questo piatto?" onChange={e=>set('description',e.target.value)}/></label>
                <label>Porzioni<input type="number" inputMode="numeric" min={1} max={100} value={form.servings} onChange={e=>set('servings',Number(e.target.value))}/></label>
                <PhotoUpload onBusyChange={uploadStatus} value={form.image} onChange={value=>set('image',value)}/>
                <details className="editor-advanced"><summary>Altri dettagli</summary><div className="editor-advanced-fields">
                  <div className="form-grid">
                    <label>Categoria<select value={form.category} onChange={e=>set('category',e.target.value as RecipeInput['category'])}>{categories.map(category=><option key={category}>{category}</option>)}</select></label>
                    <label>Metodo di cottura<select value={form.method} onChange={e=>set('method',e.target.value as RecipeInput['method'])}>{methods.map(method=><option key={method}>{method}</option>)}</select></label>
                    <label>Preparazione · minuti<input type="number" inputMode="numeric" min={0} max={1440} value={form.prepMinutes} onChange={e=>set('prepMinutes',Number(e.target.value))}/></label>
                    <label>Cottura · minuti<input type="number" inputMode="numeric" min={0} max={1440} value={form.cookMinutes} onChange={e=>set('cookMinutes',Number(e.target.value))}/></label>
                    <label>Raccolta<input list={collectionListId} value={form.collection} maxLength={80} placeholder="Es. Le mie certezze" onChange={e=>set('collection',e.target.value)}/><datalist id={collectionListId}>{collections.map(collection=><option value={collection} key={collection}/>)}</datalist></label>
                  </div>
                  <label>Appunti di cucina<textarea value={form.notes} maxLength={10000} placeholder="Un dettaglio da ricordare…" onChange={e=>set('notes',e.target.value)}/></label>
                  <label className="check-label editor-favorite"><input type="checkbox" checked={form.favorite} onChange={e=>set('favorite',e.target.checked)}/>Aggiungi alle preferite</label>
                  <details className="editor-advanced"><summary>Fonte, teglia e condivisione</summary><div className="editor-advanced-fields">
                  <label>Link della fonte<input type="url" inputMode="url" value={form.sourceUrl} placeholder="https://…" onChange={e=>set('sourceUrl',e.target.value)}/></label>
                  <label>Autore, libro o riferimento<input value={form.sourceAuthor} maxLength={200} placeholder="Es. Il quaderno di nonna, pagina 24" onChange={e=>set('sourceAuthor',e.target.value)}/></label>
                  <label className="check-label"><input type="checkbox" checked={Boolean(form.pan)} onChange={e=>set('pan',e.target.checked?{shape:'round',width:20,length:20}:null)}/>Questa ricetta usa una teglia</label>
                  {form.pan&&<PanFields pan={form.pan} onChange={value=>set('pan',value)}/ >}
                  <label>Visibilità<select value={form.visibility} onChange={e=>set('visibility',e.target.value as RecipeInput['visibility'])}><option value="private">Privata · solo per me</option><option value="shared">Condivisa</option></select></label>
                  <p className="field-help">Condividi soltanto contenuti che puoi rendere visibili agli altri. Le note personali restano parte della ricetta condivisa.</p>
                  </div></details>
                </div></details>
              </div>}

              {index===1&&<div className="editor-entry-list" aria-label="Ingredienti della ricetta">
                <p className="field-help">Dosi per {form.servings} porzioni.</p>
                {form.ingredients.map((item,itemIndex)=>{
                  const expanded=selectedIngredient===item.id,panel=`${baseId}-ingredient-panel-${itemIndex}`,nameId=`${baseId}-ingredient-name-${itemIndex}`,quantityId=`${baseId}-ingredient-quantity-${itemIndex}`,unitId=`${baseId}-ingredient-unit-${itemIndex}`;
                  return <article className={`editor-entry${expanded?' is-open':''}`} key={item.id}>
                    <button type="button" className="editor-entry-toggle" aria-expanded={expanded} aria-controls={panel} onClick={()=>setSelectedIngredient(expanded?null:item.id)}><span className="editor-entry-number">{String(itemIndex+1).padStart(2,'0')}</span><span className="editor-entry-name">{item.name||'Nuovo ingrediente'}</span><span className="editor-entry-dose">{ingredientDose(item)}</span><ChevronDown size={16} aria-hidden="true"/></button>
                    <div className="editor-entry-fields" id={panel} hidden={!expanded}>
                      <label htmlFor={nameId}>Ingrediente<input ref={node=>{if(node)ingredientInputs.current.set(item.id,node);else ingredientInputs.current.delete(item.id);}} id={nameId} value={item.name} maxLength={150} placeholder="Es. Farina" onChange={e=>updateIngredient(item.id,{name:e.target.value})}/></label>
                      <div className="editor-dose-fields">
                        <label htmlFor={quantityId}>Quantità<QuantityField id={quantityId} label={`Quantità ingrediente ${itemIndex+1}`} value={item.quantity} placeholder={item.quantityKind==='to_taste'?'q.b.':'Es. 200'} onChange={quantity=>updateIngredient(item.id,{quantity,quantityKind:quantity!==null?undefined:item.quantityKind})}/></label>
                        <label htmlFor={unitId}>Unità<select id={unitId} value={canonicalUnit(item.unit)} onChange={e=>updateIngredient(item.id,{unit:e.target.value})}><option value="">Senza unità</option>{item.unit&&!isKnownUnit(item.unit)&&<option value={item.unit}>{item.unit} · esistente</option>}{unitGroups.map(group=><optgroup label={group.label} key={group.label}>{group.units.map(([value,label])=><option key={value} value={value}>{label}</option>)}</optgroup>)}</select></label>
                      </div>
                      <div className="editor-dose-options" role="group" aria-label={`Tipo di dose per ${item.name||`ingrediente ${itemIndex+1}`}`}><button type="button" aria-pressed={item.quantity===null&&item.quantityKind!=='unspecified'} onClick={()=>updateIngredient(item.id,{quantity:null,quantityKind:'to_taste'})}>Quanto basta</button><button type="button" aria-pressed={item.quantity===null&&item.quantityKind==='unspecified'} onClick={()=>updateIngredient(item.id,{quantity:null,quantityKind:'unspecified'})}>Dose non indicata</button></div>
                      <div className="editor-entry-actions"><button type="button" className="editor-remove" onClick={()=>removeIngredient(item.id)}><Trash2 size={16}/>Rimuovi ingrediente</button></div>
                    </div>
                  </article>;
                })}
                <button type="button" className="button dashed editor-add" onClick={()=>{const id=crypto.randomUUID();setForm(current=>({...current,ingredients:[...current.ingredients,{id,name:'',quantity:null,unit:'g'}]}));setSelectedIngredient(id);focusNewIngredient(id);}}><Plus size={17}/>Aggiungi ingrediente</button>
              </div>}

              {index===2&&<div className="editor-entry-list" aria-label="Procedimento della ricetta">
                {form.steps.map((item,itemIndex)=>{
                  const expanded=selectedStep===item.id,panel=`${baseId}-step-panel-${itemIndex}`,textId=`${baseId}-step-text-${itemIndex}`,timerId=`${baseId}-step-timer-${itemIndex}`,videoId=`${baseId}-step-video-${itemIndex}`;
                  return <article className={`editor-entry editor-step${expanded?' is-open':''}`} key={item.id}>
                    <button type="button" className="editor-entry-toggle" aria-expanded={expanded} aria-controls={panel} onClick={()=>setSelectedStep(expanded?null:item.id)}><span className="editor-entry-number">{String(itemIndex+1).padStart(2,'0')}</span><span className="editor-entry-name">{item.text||'Scrivi il passaggio'}</span><span className="editor-entry-meta">{item.ingredients.length?`${item.ingredients.length} collegati`:''}{item.timerMinutes?` · ${item.timerMinutes} min`:''}</span><ChevronDown size={16} aria-hidden="true"/></button>
                    <div className="editor-entry-fields" id={panel} hidden={!expanded}>
                      <label htmlFor={textId}>Passaggio {itemIndex+1}<textarea ref={node=>{if(node)stepInputs.current.set(item.id,node);else stepInputs.current.delete(item.id);}} id={textId} rows={4} maxLength={5000} value={item.text} placeholder="Es. Scalda l’olio in una padella…" onChange={e=>updateStep(item.id,{text:e.target.value})}/></label>
                      <div className="editor-step-order" role="group" aria-label={`Ordine del passaggio ${itemIndex+1}`}><button type="button" disabled={itemIndex===0} aria-label={`Sposta passaggio ${itemIndex+1} prima`} onClick={()=>moveStep(item.id,-1)}><ArrowUp size={16}/>Sposta prima</button><button type="button" disabled={itemIndex===form.steps.length-1} aria-label={`Sposta passaggio ${itemIndex+1} dopo`} onClick={()=>moveStep(item.id,1)}><ArrowDown size={16}/>Sposta dopo</button></div>
                      <fieldset className="editor-step-ingredients"><legend>Ingredienti usati in questo passaggio</legend>
                        {form.ingredients.filter(ingredient=>ingredient.name).map(ingredient=>{
                          const linked=item.ingredients.find(use=>use.ingredientId===ingredient.id),doseId=`${baseId}-step-${itemIndex}-ingredient-${ingredient.id}`;
                          return <div className="editor-step-ingredient" key={ingredient.id}>
                            <label className="check-label"><input type="checkbox" checked={Boolean(linked)} onChange={e=>updateStep(item.id,{ingredients:e.target.checked?[...item.ingredients,{ingredientId:ingredient.id,quantity:null}]:item.ingredients.filter(use=>use.ingredientId!==ingredient.id)})}/>{ingredient.name}</label>
                            {linked&&<label className="editor-portion" htmlFor={doseId}><span>Dose in questo passaggio</span><span className="editor-portion-input"><QuantityField id={doseId} label={`Dose di ${ingredient.name} nel passaggio ${itemIndex+1}`} value={linked.quantity} placeholder="Facoltativa" onChange={quantity=>updateStep(item.id,{ingredients:item.ingredients.map(use=>use.ingredientId===ingredient.id?{...use,quantity}:use)})}/><span>{ingredient.unit}</span></span></label>}
                          </div>;
                        })}
                        {!form.ingredients.some(ingredient=>ingredient.name)&&<p className="field-help">Aggiungi prima gli ingredienti della ricetta.</p>}
                      </fieldset>
                      <div className="form-grid">
                        <label htmlFor={timerId}>Timer · minuti<input id={timerId} type="number" inputMode="numeric" min={0} max={1440} value={item.timerMinutes} onChange={e=>updateStep(item.id,{timerMinutes:Number(e.target.value)})}/></label>
                        <label htmlFor={videoId}>Video del passaggio · link HTTPS<input id={videoId} type="url" inputMode="url" value={item.videoUrl} placeholder="https://…" onChange={e=>updateStep(item.id,{videoUrl:e.target.value})}/></label>
                      </div>
                      <details className="editor-step-photo"><summary>Foto del passaggio</summary><PhotoUpload onBusyChange={uploadStatus} value={item.image} label={`Foto passaggio ${itemIndex+1}`} onChange={value=>updateStep(item.id,{image:value})}/></details>
                      <div className="editor-entry-actions"><button type="button" className="editor-remove" onClick={()=>{setForm(current=>({...current,steps:current.steps.filter(step=>step.id!==item.id)}));setSelectedStep(null);}}><Trash2 size={16}/>Rimuovi passaggio</button></div>
                    </div>
                  </article>;
                })}
                <button type="button" className="button dashed editor-add" onClick={()=>{const id=crypto.randomUUID();setForm(current=>({...current,steps:[...current.steps,{id,text:'',image:'',videoUrl:'',timerMinutes:0,ingredients:[]}]}));setSelectedStep(id);focusNewStep(id);}}><Plus size={17}/>Aggiungi passaggio</button>
              </div>}
            </div>
          </section>;
        })}
      </div>

      {uploads>0&&<p role="status" className="field-help editor-upload-status">Caricamento foto in corso…</p>}
      {error&&<div className="form-error" role="alert">{error}</div>}
      <footer className="editor-footer">
        <span className="muted"><Lock size={13}/>{form.visibility==='private'?'Solo per te':'Condivisa in Recipeek'}</span>
        <button type="button" className="button primary" disabled={saving||uploads>0} onClick={()=>void submit()}>{saving?'Salvo…':'Salva ricetta'}<Check size={17}/></button>
      </footer>
    </fieldset>
  </div>;
}
