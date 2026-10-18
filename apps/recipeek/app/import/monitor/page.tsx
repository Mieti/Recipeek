import {env} from 'cloudflare:workers';
import {redirect} from 'next/navigation';
import {getRecipeekUser} from '../../account-user';
import {isImportAdmin} from '../../../lib/ai-import-metrics';
import {accountContext} from '../../../lib/auth-context';
import AccountSessionGuard from '../../account-session-guard';
import Monitor from './panel';
export const dynamic='force-dynamic';
export default async function ImportMonitor(){
  const user=await getRecipeekUser();if(!user)redirect('/account');if(!isImportAdmin(env,user.userId))redirect('/import');
  const state=accountContext();return <>{state?.config&&<AccountSessionGuard config={state.config} expectedId={state.user?.id??null} profileId={user.userId}/>}<div data-account-surface><Monitor/></div></>;
}
