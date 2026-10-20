'use client';
import {useState} from 'react';
import {LogOut} from 'lucide-react';
import {clearKitchenState} from '../lib/kitchen-state';
import {publishSignedOut} from '../lib/account-events';
export default function LogoutButton({userId,allDevices=false,className='button'}:{userId:string;allDevices?:boolean;className?:string}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function leave(){if(busy)return;setBusy(true);setError('');try{
    const response=await fetch('/auth/logout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scope:allDevices?'global':'local'})});
    const result=await response.json() as {signedOut?:boolean;notice?:string;redirectTo?:string;error?:string};
    if(!response.ok||!result.signedOut)throw new Error(result.error??'Uscita non riuscita. Riprova.');
    clearKitchenState(userId);publishSignedOut();
    const destination=result.redirectTo==='/signout-with-chatgpt?return_to=%2Faccount'
      ? '/signout-with-chatgpt?return_to=%2F'
      : result.notice==='global-logout-failed'
        ? '/?notice=global-logout-failed'
        : '/';
    window.location.replace(destination);
  }catch{setBusy(false);setError('Uscita non riuscita. Controlla la connessione e riprova.');}}
  return <span className="logout-control"><button type="button" className={className} disabled={busy} onClick={()=>void leave()}><LogOut size={17}/><span>{busy?'Uscita…':allDevices?'Esci da tutti i dispositivi':'Esci'}</span></button>{error&&<span className="logout-error" role="alert">{error}</span>}</span>;
}
