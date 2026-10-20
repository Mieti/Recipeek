'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';

export default function Modal({children,onClose,label,wide=false,className=''}:{children:ReactNode;onClose:()=>void;label:string;wide?:boolean;className?:string}){
  const ref=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null,old=document.body.style.overflow;
    document.body.style.overflow='hidden';ref.current?.focus({preventScroll:true});
    function key(event:KeyboardEvent){
      if(event.key==='Escape'){event.preventDefault();close.current();return;}
      if(event.key!=='Tab')return;
      const all=[...ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex="0"]')??[]].filter(el=>el.getClientRects().length>0);
      const first=all[0],last=all.at(-1);if(!first){event.preventDefault();return;}
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
    document.addEventListener('keydown',key);
    return()=>{document.body.style.overflow=old;document.removeEventListener('keydown',key);previous?.focus({preventScroll:true});};
  },[]);
  return <div className="overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><div className={`modal ${wide?'wide':''} ${className}`.trim()} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref}><div className="modal-top"><span className="eyebrow">{label}</span><button className="icon-button" aria-label="Chiudi" onClick={onClose}><X size={20}/></button></div>{children}</div></div>;
}
