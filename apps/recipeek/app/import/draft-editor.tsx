'use client';
import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {ArrowDown,ArrowUp,Check,ChevronDown,Plus,Trash2,Undo2} from 'lucide-react';
import {categories,methods,type RecipeInput} from '../../lib/model';
import {unitGroups} from '../../lib/units';

type Props={recipe:RecipeInput;setRecipe:Dispatch<SetStateAction<RecipeInput>>;servings:string;setServings:(value:string)=>void};
type Section='ingredients'|'steps'|'details';
function QuantityField({value,label,placeholder,onChange}:{value:number|null;label:string;placeholder:string;onChange:(value:number|null)=>void}){
  const [text,setText]=useState(value===null?'':String(value)),focused=useRef(false);
  useEffect(()=>{if(!focused.current)setText(value===null?'':String(value));},[value]);
  return <input aria-label={label} type="number" inputMode="decimal" step="any" min="0" value={text} placeholder={placeholder} onFocus={()=>{focused.current=true;}} onBlur={()=>{focused.current=false;setText(value===null?'':String(value));}} onChange={e=>{setText(e.target.value);onChange(e.target.value?Number(e.target.value):null);}}/>;
}
export default function DraftEditor({recipe,setRecipe,servings,setServings}:Props){
  const [section,setSection]=useState<Section>('ingredients'),[selected,setSelected]=useState<string|null>(null),[undo,setUndo]=useState<{label:string;restore:()=>void}|null>(null);
  const root=useRef<HTMLDivElement>(null);
  function finish(id:string){setSelected(null);requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>(`[data-entry="${id}"]>.draft-entry-toggle`)?.focus({preventScroll:true}));}
  function focusRemaining(index:number){requestAnimationFrame(()=>{const entries=root.current?.querySelectorAll<HTMLButtonElement>('.draft-entry-toggle');const target=entries?.[Math.min(index,entries.length-1)]??root.current?.querySelector<HTMLButtonElement>('.draft-add');target?.focus({preventScroll:true});});}
  function changeSection(next:Section){setSection(next);setSelected(null);}
  function focusNew(id:string){setSelected(id);requestAnimationFrame(()=>{const field=root.current?.querySelector<HTMLInputElement|HTMLTextAreaElement>(`[data-entry="${id}"] input,[data-entry="${id}"] textarea`);field?.focus();});}
  function ingredient(id:string,patch:Partial<RecipeInput['ingredients'][number]>){setRecipe(current=>({...current,ingredients:current.ingredients.map(i=>i.id===id?{...i,...patch}:i)}));}
  function step(id:string,patch:Partial<RecipeInput['steps'][number]>){setRecipe(current=>({...current,steps:current.steps.map(s=>s.id===id?{...s,...patch}:s)}));}
  function removeIngredient(id:string){
    const index=recipe.ingredients.findIndex(i=>i.id===id),item=recipe.ingredients[index];if(!item)return;
    const uses=recipe.steps.flatMap(s=>s.ingredients.filter(i=>i.ingredientId===id).map(use=>({stepId:s.id,use})));
    setRecipe(current=>({...current,ingredients:current.ingredients.filter(i=>i.id!==id),steps:current.steps.map(s=>({...s,ingredients:s.ingredients.filter(i=>i.ingredientId!==id)}))}));setSelected(null);
    focusRemaining(index);setUndo({label:'Ingrediente rimosso',restore:()=>{setRecipe(current=>{if(current.ingredients.some(i=>i.id===id))return current;const items=[...current.ingredients];items.splice(Math.min(index,items.length),0,item);return {...current,ingredients:items,steps:current.steps.map(s=>({...s,ingredients:[...s.ingredients,...uses.filter(u=>u.stepId===s.id&&!s.ingredients.some(i=>i.ingredientId===id)).map(u=>u.use)]}))};});finish(id);}});
  }
  function removeStep(id:string){
    const index=recipe.steps.findIndex(s=>s.id===id),item=recipe.steps[index];if(!item)return;
    setRecipe(current=>({...current,steps:current.steps.filter(s=>s.id!==id)}));setSelected(null);
    focusRemaining(index);setUndo({label:'Passaggio rimosso',restore:()=>{setRecipe(current=>{if(current.steps.some(s=>s.id===id))return current;const items=[...current.steps];items.splice(Math.min(index,items.length),0,{...item,ingredients:item.ingredients.filter(use=>current.ingredients.some(i=>i.id===use.ingredientId))});return {...current,steps:items};});finish(id);}});
  }
  function moveStep(id:string,direction:number){setRecipe(current=>{const steps=[...current.steps],index=steps.findIndex(s=>s.id===id),next=index+direction;if(index<0||next<0||next>=steps.length)return current;[steps[index],steps[next]]=[steps[next],steps[index]];return {...current,steps};});}
  return <div className="draft-editor" ref={root}>
    <div className="draft-segments" role="group" aria-label="Sezione della ricetta">
      {([['ingredients','Ingredienti',recipe.ingredients.length],['steps','Passaggi',recipe.steps.length],['details','Dettagli',null]] as const).map(([key,label,count])=><button type="button" key={key} aria-pressed={section===key} onClick={()=>changeSection(key)}>{label}{count!==null&&<span>{count}</span>}</button>)}
    </div>
    <div className="draft-section-heading"><p>{section==='ingredients'?'Tocca un ingrediente per modificarlo.':section==='steps'?'Un passaggio alla volta, tutto sotto controllo.':'Le informazioni essenziali della ricetta.'}</p><span className="draft-autosave"><Check size={12}/> Salvataggio automatico</span></div>
    {undo&&<div className="draft-undo" role="status"><span>{undo.label}</span><button type="button" onClick={()=>{undo.restore();setUndo(null);}}><Undo2 size={15}/>Annulla</button></div>}
    {section==='ingredients'&&<div className="draft-entry-list" aria-label="Ingredienti da modificare">
      {recipe.ingredients.map((i,index)=>{const open=selected===i.id;return <div className={`draft-entry${open?' is-open':''}`} key={i.id} data-entry={i.id}>
        <button type="button" className="draft-entry-toggle" aria-expanded={open} aria-controls={`edit-${i.id}`} onClick={()=>setSelected(open?null:i.id)}><span className="draft-entry-number">{index+1}</span><span className="draft-entry-name">{i.name||'Nuovo ingrediente'}</span><span className={`draft-entry-dose${i.quantity===null&&i.quantityKind!=='to_taste'?' is-missing':''}`}>{i.quantity!==null?`${i.quantity} ${i.unit}`.trim():i.quantityKind==='to_taste'?'q.b.':'Da indicare'}</span><ChevronDown size={16}/></button>
        {open&&<div className="draft-entry-fields" id={`edit-${i.id}`}>
          <label>Ingrediente<input aria-label={`Nome ingrediente ${index+1}`} autoComplete="off" value={i.name} placeholder="Es. Farina" onChange={e=>ingredient(i.id,{name:e.target.value})}/></label>
          <div className="draft-dose-fields"><label>Quantità<QuantityField label={`Quantità ingrediente ${index+1}`} value={i.quantity} placeholder={i.quantityKind==='to_taste'?'q.b.':'Es. 200'} onChange={quantity=>ingredient(i.id,{quantity,quantityKind:undefined})}/></label><label>Unità<select aria-label={`Unità ingrediente ${index+1}`} value={i.unit} onChange={e=>ingredient(i.id,{unit:e.target.value})}><option value="">Nessuna</option>{i.unit&&!unitGroups.some(g=>g.units.some(u=>u[0]===i.unit))&&<option value={i.unit}>{i.unit}</option>}{unitGroups.map(g=><optgroup key={g.label} label={g.label}>{g.units.map(u=><option key={u[0]} value={u[0]}>{u[1]}</option>)}</optgroup>)}</select></label></div>
          <div className="draft-dose-options" role="group" aria-label={`Tipo di dose ingrediente ${index+1}`}><button type="button" aria-pressed={i.quantity===null&&i.quantityKind==='to_taste'} onClick={()=>ingredient(i.id,{quantity:null,quantityKind:'to_taste'})}>Quanto basta</button><button type="button" aria-pressed={i.quantity===null&&i.quantityKind!=='to_taste'} onClick={()=>ingredient(i.id,{quantity:null,quantityKind:'unspecified'})}>Dose non indicata</button></div>
          <div className="draft-entry-actions"><button type="button" className="draft-remove" onClick={()=>removeIngredient(i.id)}><Trash2 size={16}/>Rimuovi</button><button type="button" className="draft-done" onClick={()=>finish(i.id)}><Check size={16}/>Fatto</button></div>
        </div>}
      </div>;})}
      {!recipe.ingredients.length&&<p className="draft-empty">Aggiungi il primo ingrediente.</p>}
      <button type="button" className="draft-add" onClick={()=>{const id=`user-${crypto.randomUUID()}`;setRecipe(current=>({...current,ingredients:[...current.ingredients,{id,name:'',quantity:null,quantityKind:'unspecified',unit:''}]}));focusNew(id);}}><Plus size={18}/>Aggiungi ingrediente</button>
    </div>}
    {section==='steps'&&<div className="draft-entry-list" aria-label="Passaggi da modificare">
      {recipe.steps.map((s,index)=>{const open=selected===s.id;return <div className={`draft-entry draft-step-entry${open?' is-open':''}`} key={s.id} data-entry={s.id}>
        <button type="button" className="draft-entry-toggle" aria-expanded={open} aria-controls={`edit-${s.id}`} onClick={()=>setSelected(open?null:s.id)}><span className="draft-entry-number">{index+1}</span><span className="draft-entry-copy"><span className="draft-entry-name">{s.text||'Scrivi il nuovo passaggio'}</span>{s.ingredients.length>0&&<small>{s.ingredients.length} ingredient{s.ingredients.length===1?'e':'i'} collegat{s.ingredients.length===1?'o':'i'}</small>}</span><ChevronDown size={16}/></button>
        {open&&<div className="draft-entry-fields" id={`edit-${s.id}`}>
          <label>Passaggio {index+1}<textarea aria-label={`Testo passaggio ${index+1}`} rows={5} value={s.text} placeholder="Descrivi cosa fare…" onChange={e=>step(s.id,{text:e.target.value})}/></label>
          <div className="draft-step-order" role="group" aria-label={`Ordine passaggio ${index+1}`}><button type="button" disabled={index===0} onClick={()=>moveStep(s.id,-1)} aria-label={`Sposta passaggio ${index+1} prima`}><ArrowUp size={16}/>Sposta prima</button><button type="button" disabled={index===recipe.steps.length-1} onClick={()=>moveStep(s.id,1)} aria-label={`Sposta passaggio ${index+1} dopo`}><ArrowDown size={16}/>Sposta dopo</button></div>
          <details className="draft-step-links"><summary>Ingredienti del passaggio <span>{s.ingredients.length}</span></summary><div className="draft-ingredient-chips">{recipe.ingredients.map(i=><button type="button" key={i.id} aria-pressed={s.ingredients.some(use=>use.ingredientId===i.id)} onClick={()=>step(s.id,{ingredients:s.ingredients.some(use=>use.ingredientId===i.id)?s.ingredients.filter(use=>use.ingredientId!==i.id):[...s.ingredients,{ingredientId:i.id,quantity:null}]})}>{s.ingredients.some(use=>use.ingredientId===i.id)&&<Check size={14}/>} {i.name||'Ingrediente da completare'}</button>)}</div>{!recipe.ingredients.length&&<p>Aggiungi prima gli ingredienti della ricetta.</p>}</details>
          <div className="draft-entry-actions"><button type="button" className="draft-remove" onClick={()=>removeStep(s.id)}><Trash2 size={16}/>Rimuovi</button><button type="button" className="draft-done" onClick={()=>finish(s.id)}><Check size={16}/>Fatto</button></div>
        </div>}
      </div>;})}
      {!recipe.steps.length&&<p className="draft-empty">Aggiungi il primo passaggio.</p>}
      <button type="button" className="draft-add" onClick={()=>{const id=`user-${crypto.randomUUID()}`;setRecipe(current=>({...current,steps:[...current.steps,{id,text:'',image:'',videoUrl:'',timerMinutes:0,ingredients:[]}]}));focusNew(id);}}><Plus size={18}/>Aggiungi passaggio</button>
    </div>}
    {section==='details'&&<div className="draft-details">
      <label>Titolo<input value={recipe.title} onChange={e=>setRecipe(current=>({...current,title:e.target.value}))}/></label>
      <label>Descrizione<textarea rows={2} value={recipe.description} onChange={e=>setRecipe(current=>({...current,description:e.target.value}))}/></label>
      <div className="draft-facts"><label>Porzioni<input type="number" inputMode="numeric" min="1" max="100" value={servings} placeholder="Es. 2" onChange={e=>setServings(e.target.value)}/></label><label>Preparazione<small>Minuti</small><input type="number" inputMode="numeric" min="0" value={recipe.prepMinutes} onChange={e=>setRecipe(current=>({...current,prepMinutes:Number(e.target.value)}))}/></label><label>Cottura<small>Minuti</small><input type="number" inputMode="numeric" min="0" value={recipe.cookMinutes} onChange={e=>setRecipe(current=>({...current,cookMinutes:Number(e.target.value)}))}/></label></div>
      <div className="draft-dose-fields"><label>Categoria<select value={recipe.category} onChange={e=>setRecipe(current=>({...current,category:e.target.value as RecipeInput['category']}))}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Metodo di cottura<select value={recipe.method} onChange={e=>setRecipe(current=>({...current,method:e.target.value as RecipeInput['method']}))}>{methods.map(c=><option key={c}>{c}</option>)}</select></label></div>
      <label>Note personali<textarea rows={3} value={recipe.notes} placeholder="Un dettaglio da ricordare…" onChange={e=>setRecipe(current=>({...current,notes:e.target.value}))}/></label>
    </div>}
  </div>;
}
