import {env} from 'cloudflare:workers';
import {getRecipeekUser} from '../../account-user';
import {handleApi} from '../../../lib/api-handler';
import {HttpError} from '../../../lib/http';
export const dynamic='force-dynamic';
async function handle(request:Request){try{return handleApi(request,{user:await getRecipeekUser(),db:env.DB,bucket:env.BUCKET,importEnv:env});}catch(error){return Response.json({error:error instanceof HttpError?error.message:'Accesso non disponibile.'},{status:error instanceof HttpError?error.status:503,headers:{'cache-control':'private, no-store'}});}}
export {handle as GET,handle as POST,handle as PATCH,handle as DELETE};
