import {env} from 'cloudflare:workers';
import {accountContext} from '../../lib/auth-context';
import {mappedProfile} from '../../lib/account-identity';
import {getChatGPTUser} from '../chatgpt-auth';
import AccountPanel from './panel';
export const dynamic='force-dynamic';
export default async function Account(){
  const state=accountContext(),legacy=await getChatGPTUser();let providers:string[]=[],emailEnabled=false,settingsAvailable=false;
  if(state?.config){try{
    const response=await fetch(`${state.config.url}/auth/v1/settings`,{headers:{apikey:state.config.key},signal:AbortSignal.timeout(5000),cache:'no-store'});
    if(response.ok){const settings=await response.json() as {external?:Record<string,boolean>;mailer_autoconfirm?:boolean};providers=['google','apple','azure'].filter(p=>settings.external?.[p]===true);emailEnabled=settings.external?.email===true&&settings.mailer_autoconfirm===false;settingsAvailable=true;}
  }catch{/* Never advertise unavailable or unconfigured providers. */}}
  const user=state?.user,linked=user&&env.DB?await mappedProfile(env.DB,user.id):null;
  return <AccountPanel config={state?.config??null} mode={state?.mode??'sites'} providers={providers} emailEnabled={emailEnabled} settingsAvailable={settingsAvailable} storageUserId={state?.mode==='supabase'?(linked??(user?`sb_${user.id}`:'')):(legacy?.userId??'')} user={user?{id:user.id,email:user.email??'',verified:Boolean(user.email_confirmed_at),providers:user.identities?.map(i=>i.provider)??[]}:null} legacy={legacy?{email:legacy.email,linked:linked===legacy.userId}:null}/>;
}
