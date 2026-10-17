import {env} from 'cloudflare:workers';
import {accountContext,externalProfile} from '../lib/auth-context';
import {getChatGPTUser} from './chatgpt-auth';
import {HttpError} from '../lib/http';
import {authMode} from '../lib/auth-config';
export async function getRecipeekUser(){
  const state=accountContext();
  if(authMode(env)==='supabase'||state?.requiresAccount||state?.attempted||state?.failed){
    if(!state||state.failed)throw new HttpError(503,'Il servizio di accesso non è disponibile. Riprova tra poco.');
    if(!env.DB)return null;
    const userId=await externalProfile(env.DB,await getChatGPTUser());return userId?{userId}:null;
  }
  return getChatGPTUser();
}
