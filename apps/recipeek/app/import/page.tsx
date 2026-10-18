import {redirect} from 'next/navigation';
import {getRecipeekUser} from '../account-user';
import ImportPanel from './panel';
import {accountContext} from '../../lib/auth-context';
import AccountSessionGuard from '../account-session-guard';
export const dynamic='force-dynamic';
export default async function ImportPage(){const user=await getRecipeekUser();if(!user)redirect('/account');const state=accountContext();return <>{state?.config&&<AccountSessionGuard config={state.config} expectedId={state.user?.id??null} profileId={user.userId}/>}<div data-account-surface><ImportPanel/></div></>;}
