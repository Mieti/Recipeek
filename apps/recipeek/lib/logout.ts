import {HttpError,assertSameOrigin,readJsonBody} from './http.ts';

type LogoutClient={auth:{signOut:(options:{scope:'local'|'global'})=>Promise<{error:unknown}>}};
export async function handleLogout(request:Request,{client,authenticated,onSignedOut,redirectTo='/account'}:{client:LogoutClient|null;authenticated:boolean;onSignedOut:()=>void;redirectTo?:string}){
  try{
    if(request.method!=='POST')throw new HttpError(405,'Usa il pulsante Esci.',{Allow:'POST'});
    assertSameOrigin(request);
    if(request.headers.get('origin')!==new URL(request.url).origin)throw new HttpError(403,'Origine non consentita.');
    const body=await readJsonBody(request);
    if(!body||typeof body!=='object'||!('scope'in body)||(body.scope!=='local'&&body.scope!=='global'))throw new HttpError(400,'Tipo di uscita non valido.');
    let revoked=false;
    try{if(client){const result=await client.auth.signOut({scope:body.scope});revoked=authenticated&&!result.error;}}catch{/* Local cookies must still be removed if Auth is unavailable. */}
    onSignedOut();
    return Response.json({signedOut:true,globalRevoked:body.scope==='global'&&revoked,notice:body.scope==='global'&&!revoked?'global-logout-failed':null,redirectTo},{headers:{'cache-control':'private, no-store'}});
  }catch(error){return Response.json({error:error instanceof HttpError?error.message:'Uscita non disponibile. Riprova.'},{status:error instanceof HttpError?error.status:503,headers:{'cache-control':'private, no-store',...(error instanceof HttpError?error.headers:{})}});}
}
