'use client';
import {useEffect} from 'react';
import {fieldScrollDelta,visibleViewport} from '../lib/viewport';

export function useKeyboardViewport(){
  useEffect(()=>{
    const root=document.documentElement,viewport=window.visualViewport;let frame=0,focusFrame=0,settle=0;
    function reveal(){
      const field=document.activeElement;if(!(field instanceof HTMLElement)||!field.matches('input:not([type=checkbox]):not([type=file]),textarea,select,[contenteditable=true]'))return;
      // Respect pinch zoom rather than moving the page under the user's fingers.
      if(viewport&&Math.abs(viewport.scale-1)>.05)return;
      const modal=field.closest<HTMLElement>('.modal'),rect=field.getBoundingClientRect();
      const top=(viewport?.offsetTop??0)+16,bottom=top+(viewport?.height??window.innerHeight)-32;
      const bounds=modal?.getBoundingClientRect();
      const delta=fieldScrollDelta(rect.top,rect.bottom,Math.max(top,(bounds?.top??top)+12),Math.min(bottom,(bounds?.bottom??bottom)-16));
      if(Math.abs(delta)<1)return;
      if(modal)modal.scrollBy({top:delta,behavior:'instant'});else window.scrollBy({top:delta,behavior:'instant'});
    }
    function update(){
      cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
        const state=visibleViewport(window.innerHeight,viewport?.height??window.innerHeight,viewport?.offsetTop??0,viewport?.scale??1);
        root.style.setProperty('--visible-height',`${state.height}px`);root.style.setProperty('--visible-top',`${state.top}px`);
        root.toggleAttribute('data-keyboard-open',state.keyboard);
        cancelAnimationFrame(focusFrame);focusFrame=requestAnimationFrame(reveal);
      });
    }
    function focused(){update();window.clearTimeout(settle);settle=window.setTimeout(update,350);}
    update();viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);document.addEventListener('focusin',focused);
    return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(focusFrame);window.clearTimeout(settle);viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);document.removeEventListener('focusin',focused);root.style.removeProperty('--visible-height');root.style.removeProperty('--visible-top');root.removeAttribute('data-keyboard-open');};
  },[]);
}
