'use client';
import { useEffect, useState } from 'react';
import { Clock, Pause, Play, RotateCcw } from 'lucide-react';
import { parseTimerState, readKitchenState, timerSeconds, writeKitchenState } from '../lib/kitchen-state';

// Each step mounts its own timer. Effects can never write another step's key.
export default function StepTimer({storageKey,minutes}:{storageKey:string;minutes:number}) {
  const [state,setState]=useState(()=>parseTimerState(readKitchenState(storageKey),minutes*60));
  const [,setTick]=useState(0);
  const seconds=timerSeconds(state);
  useEffect(()=>{if(!state.end)return;const id=setInterval(()=>setTick(t=>t+1),500);return()=>clearInterval(id);},[state.end]);
  useEffect(()=>{
    if(state.end&&seconds===0){const finished={end:null,remaining:0,expired:true};setState(finished);writeKitchenState(storageKey,JSON.stringify(finished));if('vibrate'in navigator)navigator.vibrate([150,100,150]);}
  },[state.end,seconds,storageKey]);
  function update(action:'start'|'pause'|'reset') {
    const next=action==='reset'?{end:null,remaining:minutes*60,expired:false}:action==='pause'?{end:null,remaining:seconds,expired:false}:{end:Date.now()+(state.remaining||minutes*60)*1000,remaining:0,expired:false};
    setState(next);writeKitchenState(storageKey,JSON.stringify(next));
  }
  return <div className="cooking-timer"><Clock size={22}/><div><strong>{`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`}</strong><small role={state.expired?'status':undefined}>{state.expired?'Tempo scaduto · controlla la cottura':state.end?'Timer in corso · resta su questa pagina':'Timer del passaggio'}</small></div><button className="icon-button" aria-label={state.end?'Pausa timer':'Avvia timer'} onClick={()=>update(state.end?'pause':'start')}>{state.end?<Pause size={20}/>:<Play size={20}/>}</button><button className="icon-button" aria-label="Azzera timer" onClick={()=>update('reset')}><RotateCcw size={18}/></button></div>;
}
