import { env } from 'cloudflare:workers';
import { accountContext, externalProfile } from '../../lib/auth-context';
import { HttpError } from '../../lib/http';
import { getChatGPTUser } from '../chatgpt-auth';
import { redirect } from 'next/navigation';
import AccountPanel from './panel';
import AccountSessionGuard from '../account-session-guard';

export const dynamic = 'force-dynamic';

type AccountPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Account({ searchParams }: AccountPageProps) {
  const params = await searchParams ?? {};
  const state = accountContext();
  const legacy = await getChatGPTUser();
  const user = state?.user;
  const legacyActive = Boolean(state?.mode === 'sites' && legacy && !state?.requiresAccount && !state?.attempted);
  const hasAccountContinuation = ['reset', 'error', 'notice'].some((key) => params[key] !== undefined);

  if (!user && !legacyActive && !hasAccountContinuation) redirect('/');

  let providers: string[] = [];
  let emailEnabled = false;
  let settingsAvailable = false;
  if (state?.config) {
    try {
      const response = await fetch(`${state.config.url}/auth/v1/settings`, {
        headers: { apikey: state.config.key },
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      });
      if (response.ok) {
        const settings = await response.json() as { external?: Record<string, boolean>; mailer_autoconfirm?: boolean };
        providers = ['google', 'apple', 'azure'].filter((provider) => settings.external?.[provider] === true);
        emailEnabled = settings.external?.email === true && settings.mailer_autoconfirm === false;
        settingsAvailable = true;
      }
    } catch {
      // Never advertise unavailable or unconfigured providers.
    }
  }

  let profileId: string | null = null;
  let accountIssue = '';
  if (user && env.DB) {
    try {
      profileId = await externalProfile(env.DB, legacy);
    } catch (error) {
      accountIssue = error instanceof HttpError && error.status === 409
        ? 'Questo accesso è associato a un profilo diverso. Contatta l’assistenza prima di continuare.'
        : 'Non riusciamo a caricare il tuo account. Riprova tra poco.';
    }
  }

  const storageUserId = user ? (profileId ?? '') : (legacy?.userId ?? '');
  return <>
    {state?.config && <AccountSessionGuard config={state.config} expectedId={user?.id ?? null} profileId={storageUserId} />}
    <div data-account-surface>
      <AccountPanel
        config={state?.config ?? null}
        providers={providers}
        emailEnabled={emailEnabled}
        emailDeliveryReady={env.RECIPEEK_EMAIL_DELIVERY_READY === 'true'}
        settingsAvailable={settingsAvailable}
        storageUserId={storageUserId}
        user={user ? { id: user.id, email: user.email ?? '', verified: Boolean(user.email_confirmed_at), providers: user.identities?.map((identity) => identity.provider) ?? [] } : null}
        legacy={legacy ? { email: legacy.email } : null}
        legacyActive={legacyActive}
        accountIssue={accountIssue}
      />
    </div>
  </>;
}
