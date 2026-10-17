'use client';
import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {ArrowLeft,ArrowUpRight,Check,CheckCheck,ChefHat,ChevronLeft,ChevronRight,Leaf,Play,Sun} from 'lucide-react';
import {formatQuantity,type Recipe} from '../lib/model';
import {formatUnit} from '../lib/units';
import {adjacentStep,stepTapDirection,type StepTap} from '../lib/cooking-navigation';
import {removeKitchenState,writeKitchenState} from '../lib/kitchen-state';
import StepTimer from './step-timer';
import Modal from './modal';

export default function Cooking({initial,userId,onExit}:{initial:{recipe:Recipe;servings:number;factor:number;step:number};userId:string;onExit:(done?:boolean)=>void}){
  const r=initial.recipe,[index,setIndex]=useState(Math.min(initial.step,r.steps.length-1)),[done,setDone]=useState(false),[wake,setWake]=useState(false),[ingredientsOpen,setIngredientsOpen]=useState(false);
  const stage=useRef<HTMLDivElement>(null),scroll=useRef<HTMLDivElement>(null),heading=useRef<HTMLHeadingElement>(null),gesture=useRef<StepTap|null>(null);
  const step=r.steps[index],last=index===r.steps.length-1,sessionKey=`recipeek:cooking:${userId}`,timerKey=`recipeek:timer:${userId}:${r.id}:${step.id}`;
  const go=(direction:'previous'|'next')=>setIndex(old=>adjacentStep(old,r.steps.length,direction));
  useEffect(()=>{if(!done)writeKitchenState(sessionKey,JSON.stringify({...initial,step:index}));},[index,initial,sessionKey,done]);
  useEffect(()=>{scroll.current?.scrollTo({top:0});heading.current?.focus({preventScroll:true});},[index]);
  useEffect(()=>{
    let lock:WakeLockSentinel|null=null,cancelled=false,acquiring=false;
    const acquire=async()=>{if(cancelled||acquiring||lock&&!lock.released||document.visibilityState!=='visible'||!('wakeLock'in navigator))return;acquiring=true;
      try{const next=await navigator.wakeLock.request('screen');if(cancelled){await next.release();return;}lock=next;setWake(true);next.addEventListener('release',()=>{if(!cancelled)setWake(false);});}catch{if(!cancelled)setWake(false);}finally{acquiring=false;}
    };void acquire();document.addEventListener('visibilitychange',acquire);return()=>{cancelled=true;document.removeEventListener('visibilitychange',acquire);void lock?.release();};
  },[]);
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{if(done||ingredientsOpen||event.altKey||event.ctrlKey||event.metaKey||(event.target as Element)?.closest('input,button,textarea,select,a,summary,[contenteditable=true]'))return;
      if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();setIndex(old=>adjacentStep(old,r.steps.length,event.key==='ArrowRight'?'next':'previous'));}
    };document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);
  },[r.steps.length,done,ingredientsOpen]);
  const interactive=(target:EventTarget|null)=>target instanceof Element&&Boolean(target.closest('button,a,input,textarea,select,summary,details,video,audio,[data-no-step-tap]'));
  function down(event:PointerEvent<HTMLDivElement>){if(!event.isPrimary||event.button!==0||interactive(event.target)){gesture.current=null;return;}const rect=stage.current!.getBoundingClientRect();gesture.current={x:event.clientX-rect.left,y:event.clientY,time:performance.now(),scroll:scroll.current?.scrollTop??0};}
  function up(event:PointerEvent<HTMLDivElement>){const start=gesture.current;gesture.current=null;if(!start||!event.isPrimary)return;const rect=stage.current!.getBoundingClientRect();
    const direction=stepTapDirection(start,{x:event.clientX-rect.left,y:event.clientY,time:performance.now(),scroll:scroll.current?.scrollTop??0},rect.width,interactive(event.target)||Boolean(window.getSelection()?.toString()));if(direction)go(direction);
  }
  function finish(){removeKitchenState(sessionKey);setDone(true);}
  return <div className="focus-cooking">
    <header className="focus-header"><button className="focus-exit" onClick={()=>onExit(done)} aria-label="Esci dalla modalità cooking"><ArrowLeft size={19}/><span>Ricettario</span></button><div className="focus-recipe"><span>IN CUCINA CON RECIPEEK</span><strong>{r.title}</strong></div><span className={`focus-wake ${wake?'is-on':''}`} title={wake?'Lo schermo rimane acceso finché il browser lo consente':'Lo schermo può spegnersi'}><Sun size={17}/><span>{wake?'Schermo attivo':'Cooking'}</span></span></header>
    <div className="focus-progress" role="progressbar" aria-label="Avanzamento della ricetta" aria-valuemin={0} aria-valuemax={r.steps.length} aria-valuenow={done?r.steps.length:index+1}><span style={{width:`${done?100:(index+1)/r.steps.length*100}%`}}/></div>
    {done?<main className="focus-finished"><div className="focus-finished-icon"><ChefHat size={44} strokeWidth={1.4}/></div><p className="eyebrow">FATTO CON LE TUE MANI</p><h1>A tavola.</h1><p>Hai completato {r.title}. Buon appetito!</p><button className="button primary" onClick={()=>onExit(true)}>Torna al ricettario<CheckCheck size={18}/></button></main>:<>
      <div className="focus-stage" ref={stage} onPointerDown={down} onPointerUp={up} onPointerCancel={()=>{gesture.current=null;}}>
        <button className="focus-side previous" aria-label="Passaggio precedente" aria-controls="focused-step" disabled={index===0} onClick={()=>go('previous')}><ChevronLeft size={24}/></button>
        <div className="focus-stage-scroll" ref={scroll}>
          <main className={`focus-step ${step.image?'with-photo':''}`} id="focused-step" key={step.id}>
            <div className="focus-step-top"><span className="focus-step-number">{String(index+1).padStart(2,'0')}</span><div><p className="eyebrow">{index===0?'SI COMINCIA':last?'IL TOCCO FINALE':'UN PASSAGGIO ALLA VOLTA'}</p><p className="focus-step-count" aria-live="polite">Passaggio {index+1} di {r.steps.length}</p></div></div>
            {step.image&&<img className="focus-step-photo" src={step.image} alt={`Foto del passaggio ${index+1}`} draggable={false}/>}
            <h1 ref={heading} tabIndex={-1}>{step.text}</h1>
            {step.ingredients.length>0&&<section className="focus-step-ingredients" aria-label="Ingredienti di questo passaggio"><p className="eyebrow">TI SERVE ADESSO</p><div>{step.ingredients.map(use=>{const ingredient=r.ingredients.find(item=>item.id===use.ingredientId);if(!ingredient)return null;return <span className="focus-ingredient" key={ingredient.id}><span>{ingredient.name}</span>{use.quantity!==null?<strong>{formatQuantity(use.quantity,initial.factor)} {formatUnit(ingredient.unit,use.quantity*initial.factor)}</strong>:ingredient.quantity===null?<strong>q.b.</strong>:null}</span>;})}</div></section>}
            {step.timerMinutes>0&&<div data-no-step-tap><StepTimer key={timerKey} storageKey={timerKey} minutes={step.timerMinutes}/></div>}
            {step.videoUrl&&<a className="focus-video" href={step.videoUrl} target="_blank" rel="noopener noreferrer"><Play size={16}/>Guarda questo passaggio<ArrowUpRight size={15}/></a>}
          </main>
        </div>
        <button className="focus-side next" aria-label="Passaggio successivo" aria-controls="focused-step" disabled={last} onClick={()=>go('next')}><ChevronRight size={24}/></button>
      </div>
      <footer className="focus-footer"><button className="focus-ingredients-button" onClick={()=>setIngredientsOpen(true)}><Leaf size={19}/><span>Tutte le dosi<small>{initial.servings} persone{initial.factor!==1?' · dosi ricalcolate':''}</small></span></button><p>Tocca a sinistra per tornare,<br/>a destra per continuare.</p><button className="button primary" onClick={()=>last?finish():go('next')}>{last?'Ho finito':'Avanti'}{last?<Check size={19}/>:<ChevronRight size={19}/>}</button></footer>
    </>}
    {ingredientsOpen&&<Modal label="Ingredienti della sessione" onClose={()=>setIngredientsOpen(false)}><h2>Le dosi, tutte qui.</h2><p>{r.title} · {initial.servings} persone{initial.factor!==1?' · dosi ricalcolate':''}</p><div className="focus-all-ingredients">{r.ingredients.map(ingredient=><div key={ingredient.id}><span>{ingredient.name}</span><strong>{formatQuantity(ingredient.quantity,initial.factor)} {formatUnit(ingredient.unit,ingredient.quantity===null?null:ingredient.quantity*initial.factor)}</strong></div>)}</div><button className="button primary" onClick={()=>setIngredientsOpen(false)}>Torna al passaggio<ChevronRight size={18}/></button></Modal>}
  </div>;
}
