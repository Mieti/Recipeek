'use client';
import {useEffect} from 'react';
import {createBrowserClient} from '@supabase/ssr';
import type {AuthConfig} from '../lib/auth-config';
import {clearKitchenState} from '../lib/kitchen-state';

export default function AccountSessionGuard({config,expectedId,profileId}:{config:AuthConfig;expectedId:string;profileId:string}){
  useEffect(()=>{
    const client=createBrowserClient(config.url,config.key);let leaving=false;
    const switchAccount=(id:string|null)=>{if(leaving||id===expectedId)return;leaving=true;clearKitchenState(profileId);window.location.replace('/');};
    const {data:{subscription}}=client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||event==='SIGNED_IN'||event==='INITIAL_SESSION')switchAccount(session?.user.id??null);});
    const check=()=>{if(document.visibilityState!=='visible')return;void client.auth.getUser().then(({data,error})=>{if(!error||error.status===401||error.status===403)switchAccount(data.user?.id??null);}).catch(()=>{/* APIs continue to verify identity if the Auth service is unavailable. */});};
    document.addEventListener('visibilitychange',check);
    return()=>{subscription.unsubscribe();document.removeEventListener('visibilitychange',check);};
  },[config.url,config.key,expectedId,profileId]);
  return null;
}
