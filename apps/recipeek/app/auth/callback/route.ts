import {accountContext} from '../../../lib/auth-context';
import {safeAuthReturn} from '../../../lib/auth-config';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const url=new URL(request.url),code=url.searchParams.get('code'),client=accountContext()?.client;
  if(client&&code&&code.length<3000){const {error}=await client.auth.exchangeCodeForSession(code);if(!error)return Response.redirect(new URL(safeAuthReturn(url.searchParams.get('next')),url.origin),303);}
  return Response.redirect(new URL('/account?error=callback',url.origin),303);
}
