import {accountContext,finishAccountSession} from '../../../lib/auth-context';
import {handleLogout} from '../../../lib/logout';
import {tokenSessionId} from '../../../lib/session-policy';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  const state=accountContext();let sessionId:string|null=null;
  if(state?.client){try{const {data}=await state.client.auth.getSession();sessionId=tokenSessionId(data.session?.access_token);}catch{/* Clear local session even when expired. */}}
  return handleLogout(request,{client:state?.client??null,authenticated:Boolean(state?.user),onSignedOut:()=>finishAccountSession(sessionId),redirectTo:state?.config?'/account':'/signout-with-chatgpt?return_to=%2Faccount'});
}
export async function GET(){return Response.json({error:'Usa il pulsante Esci.'},{status:405,headers:{Allow:'POST','cache-control':'private, no-store'}});}
