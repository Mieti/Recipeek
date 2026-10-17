'use client';
import {useEffect} from 'react';
import {createBrowserClient} from '@supabase/ssr';
import type {AuthConfig} from '../lib/auth-config';
import {clearKitchenState} from '../lib/kitchen-state';
import {accountEventChannel,accountEventStorage,signedOutEvent} from '../lib/account-events';

export default function AccountSessionGuard({config,expectedId,profileId}:{config:AuthConfig;expectedId:string|null;profileId:string}){
  useEffect(()=>{
    const client=createBrowserClient(config.url,config.key);let leaving=false;
    const suspend=()=>document.documentElement.setAttribute('data-account-suspended','');
    const close=()=>{if(leaving)return false;leaving=true;suspend();clearKitchenState(profileId);return true;};
    const switchAccount=(id:string|null)=>{if(id===expectedId||!close())return;window.location.replace(id?'/':'/account');};
    const otherTabLogout=()=>{if(close())window.location.replace('/account');};
    const sameTabLogout=()=>{close();};
    const storage=(event:StorageEvent)=>{if(event.key===accountEventStorage&&event.newValue)otherTabLogout();};
    const pageshow=(event:PageTransitionEvent)=>{if(event.persisted){suspend();window.location.reload();}};
    let channel:BroadcastChannel|null=null;try{channel=new BroadcastChannel(accountEventChannel);channel.onmessage=event=>{if(event.data==='signed-out')otherTabLogout();};}catch{/* Storage events remain available. */}
    const {data:{subscription}}=client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||event==='SIGNED_IN'||event==='INITIAL_SESSION')switchAccount(session?.user.id??null);});
    const check=()=>{if(document.visibilityState!=='visible')return;void client.auth.getUser().then(({data,error})=>{if(!error||error.status===401||error.status===403)switchAccount(data.user?.id??null);}).catch(()=>{/* APIs continue to verify identity if the Auth service is unavailable. */});};
    document.addEventListener('visibilitychange',check);
    window.addEventListener(signedOutEvent,sameTabLogout);window.addEventListener('storage',storage);window.addEventListener('pagehide',suspend);window.addEventListener('pageshow',pageshow);
    return()=>{subscription.unsubscribe();channel?.close();document.removeEventListener('visibilitychange',check);window.removeEventListener(signedOutEvent,sameTabLogout);window.removeEventListener('storage',storage);window.removeEventListener('pagehide',suspend);window.removeEventListener('pageshow',pageshow);};
  },[config.url,config.key,expectedId,profileId]);
  return null;
}
