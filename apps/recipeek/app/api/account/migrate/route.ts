import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {accountContext} from '../../../../lib/auth-context';
import {confirmedIdentity} from '../../../../lib/auth-config';
import {linkLegacyProfile} from '../../../../lib/account-identity';
import {assertSameOrigin,HttpError,readJsonBody} from '../../../../lib/http';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  try{
    assertSameOrigin(request);const body=await readJsonBody(request);if(!body||typeof body!=='object'||!('confirm'in body)||body.confirm!==true)throw new HttpError(400,'Conferma il collegamento del ricettario.');
    const legacy=await getChatGPTUser(),identity=confirmedIdentity(accountContext()?.user??null);
    if(!legacy||!identity)throw new HttpError(401,'Accedi sia con ChatGPT sia con il nuovo account verificato prima di collegarli.');
    if(!env.DB)throw new HttpError(503,'Database non disponibile.');
    await linkLegacyProfile(env.DB,identity.id,legacy.userId);
    return Response.json({linked:true},{headers:{'cache-control':'private, no-store'}});
  }catch(error){return Response.json({error:error instanceof HttpError?error.message:'Collegamento non disponibile.'},{status:error instanceof HttpError?error.status:503,headers:{'cache-control':'private, no-store'}});}
}
