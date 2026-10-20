import { env } from 'cloudflare:workers';
import AccountPanel from './account/panel';
import { accountContext } from '../lib/auth-context';
import { socialProviders } from '../lib/auth-config';

export default async function LandingAuth() {
  const state = accountContext();
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
        providers = socialProviders.map(({ id }) => id).filter((provider) => settings.external?.[provider] === true);
        emailEnabled = settings.external?.email === true && settings.mailer_autoconfirm === false;
        settingsAvailable = true;
      }
    } catch {
      // Do not advertise a provider if Auth settings cannot be read.
    }
  }

  return (
    <AccountPanel
      config={state?.config ?? null}
      providers={providers}
      emailEnabled={emailEnabled}
      emailDeliveryReady={env.RECIPEEK_EMAIL_DELIVERY_READY === 'true'}
      settingsAvailable={settingsAvailable}
      storageUserId=""
      user={null}
      legacy={null}
      embedded
    />
  );
}
