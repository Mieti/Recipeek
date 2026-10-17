import RecipeekApp from './recipeek-app';
import Landing from './landing';
import {getRecipeekUser} from './account-user';
import {accountContext} from '../lib/auth-context';
import AccountSessionGuard from './account-session-guard';
import {redirect} from 'next/navigation';
import {HttpError} from '../lib/http';
export const dynamic = 'force-dynamic';
export default async function Home() { let user;try{user=await getRecipeekUser();}catch(error){if(error instanceof HttpError&&error.status===409)redirect('/account');throw error;} if(!user)return <Landing/>; const state=accountContext(); return <>{state?.config&&<AccountSessionGuard config={state.config} expectedId={state.user?.id??null} profileId={user.userId}/>}<div data-account-surface><RecipeekApp userId={user.userId}/></div></>; }
