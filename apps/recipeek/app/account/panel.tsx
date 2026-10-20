'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import type { Provider } from '@supabase/supabase-js';
import { Apple, ArrowLeft, ArrowUpRight, Check, KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { socialProviders, type AuthConfig } from '../../lib/auth-config';
import LogoutButton from '../logout-button';
import './account-redesign.css';

type Props = {
  config: AuthConfig | null;
  providers: string[];
  emailEnabled: boolean;
  emailDeliveryReady: boolean;
  settingsAvailable: boolean;
  storageUserId: string;
  user: { id: string; email: string; verified: boolean; providers: string[] } | null;
  legacy: { email: string } | null;
  legacyActive?: boolean;
  accountIssue?: string;
};

type View = 'signin' | 'signup' | 'forgot';

function ProviderMark({ provider }: { provider: string }) {
  if (provider === 'google') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
        <path fill="#4285F4" d="M21.35 12.23c0-.7-.06-1.2-.2-1.72H12v3.31h5.37a4.6 4.6 0 0 1-2 3.01v2.5h3.23c1.9-1.75 2.75-4.33 2.75-7.1Z" />
        <path fill="#34A853" d="M12 21.5c2.7 0 4.97-.9 6.6-2.43l-3.23-2.5c-.9.6-2.05.97-3.37.97-2.6 0-4.8-1.75-5.6-4.1H3.07v2.56A9.97 9.97 0 0 0 12 21.5Z" />
        <path fill="#FBBC05" d="M6.4 13.44a6 6 0 0 1 0-3.88V7H3.07a9.97 9.97 0 0 0 0 9l3.33-2.56Z" />
        <path fill="#EA4335" d="M12 6.46c1.43 0 2.7.49 3.7 1.45l2.78-2.78A9.56 9.56 0 0 0 12 2.5 9.97 9.97 0 0 0 3.07 8l3.33 2.56c.8-2.35 3-4.1 5.6-4.1Z" />
      </svg>
    );
  }
  if (provider === 'apple') {
    return <Apple aria-hidden="true" size={20} fill="currentColor" strokeWidth={1.5} />;
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20">
      <path fill="#f25022" d="M1 1h8v8H1z" />
      <path fill="#7fba00" d="M11 1h8v8h-8z" />
      <path fill="#00a4ef" d="M1 11h8v8H1z" />
      <path fill="#ffb900" d="M11 11h8v8h-8z" />
    </svg>
  );
}

export default function AccountPanel({
  config,
  providers,
  emailEnabled,
  emailDeliveryReady,
  settingsAvailable,
  user,
  legacy,
  storageUserId,
  legacyActive = false,
  accountIssue = '',
}: Props) {
  const client = useMemo(() => (config ? createBrowserClient(config.url, config.key) : null), [config]);
  const [view, setView] = useState<View>('signin');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reset, setReset] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [name, setName] = useState('');
  const [changeEmail, setChangeEmail] = useState('');
  const [passwordAdded, setPasswordAdded] = useState(false);
  const passwordEnabled = passwordAdded || Boolean(user?.providers.includes('email'));

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      if (!mounted) return;
      setReset(params.get('reset') === '1');
      if (params.has('error')) setError('Il collegamento di accesso è scaduto o non valido. Ripeti l’accesso.');
      if (params.get('notice') === 'global-logout-failed') {
        setMessage('Sei uscito da questo browser. L’uscita dagli altri dispositivi non è riuscita: riprova dopo aver effettuato l’accesso.');
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch {
      setError('Non è stato possibile completare l’operazione. Controlla i dati o riprova tra poco.');
    } finally {
      setBusy(false);
    }
  }

  function callback(next = '/account') {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (!client) return;
      if (view !== 'signin' && !emailDeliveryReady) {
        setError('Registrazione e recupero via email non sono disponibili al momento.');
        return;
      }
      if (view === 'forgot') {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: callback('/account?reset=1') });
        if (error) throw error;
        setMessage('Se l’indirizzo può ricevere il recupero, riceverai un’email con il collegamento. Controlla anche lo spam.');
        return;
      }
      if (view === 'signup') {
        if (password !== confirmation) {
          setError('Le password non coincidono.');
          return;
        }
        const { error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: callback('/'), data: { full_name: name.trim() } },
        });
        if (error) throw error;
        setPassword('');
        setConfirmation('');
        setMessage('Controlla la tua email per confermare la registrazione. Se hai già un account, usa Accedi o recupera la password.');
        return;
      }
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        setError('Email o password non valide, oppure indirizzo non ancora confermato.');
        return;
      }
      window.location.assign('/');
    });
  }

  async function social(provider: string, link = false) {
    await run(async () => {
      if (!client) return;
      const options = {
        redirectTo: callback(link ? '/account' : '/'),
        ...(provider === 'azure' ? { scopes: 'email' } : {}),
      };
      const result = link
        ? await client.auth.linkIdentity({ provider: provider as Provider, options })
        : await client.auth.signInWithOAuth({ provider: provider as Provider, options });
      if (result.error) throw result.error;
    });
  }

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (!client || !user) return;
      if (password !== confirmation) {
        setError('Le password non coincidono.');
        return;
      }
      if (!reset && passwordEnabled) {
        const { error } = await client.auth.signInWithPassword({ email: user.email, password: currentPassword });
        if (error) {
          setError('La password attuale non è corretta.');
          return;
        }
      }
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      setConfirmation('');
      setCurrentPassword('');
      setMessage(passwordEnabled ? 'Password aggiornata.' : 'Password impostata. Puoi accedere anche con email e password.');
      setPasswordAdded(true);
      setReset(false);
      window.history.replaceState(null, '', '/account');
    });
  }

  const configuredProviders = socialProviders.filter((provider) => providers.includes(provider.id));
  return (
    <main className={`account-page account-redesign${!user && config ? ' account-page--auth' : ''}`}>
      <header className="account-brandbar">
        <Link className="brand" href="/" aria-label="Recipeek, pagina iniziale">
          recipeek<span>✳</span>
        </Link>
        {(user || legacyActive) && <Link className="account-back-link" href="/?view=you"><ArrowLeft size={17} />Tu</Link>}
      </header>
      <div className={`account-layout${user ? ' account-layout--manage' : ''}`}>
        {(user || !config) && (
          <section className="account-intro">
            <p className="eyebrow">{user ? 'ACCOUNT RECIPEEK' : 'IL TUO SPAZIO IN CUCINA'}</p>
            <h1>{user ? 'Il tuo account.' : 'Le tue ricette,\nil tuo account.'}</h1>
            <p>
              {user
                ? 'Gestisci i metodi di accesso, la password e le sessioni.'
                : 'Un posto per le tue ricette, da ritrovare su ogni dispositivo. Decidi tu cosa condividere.'}
            </p>
            {!user && (
              <div className="account-assurance">
                <ShieldCheck size={20} />
                <span>Le ricette e le foto sono private finché scegli di condividerle.</span>
              </div>
            )}
          </section>
        )}

        <section className="account-card" aria-label={user ? 'Gestione account' : 'Accesso a Recipeek'}>
          {(error || accountIssue) && <p className="form-error" role="alert">{error || accountIssue}</p>}
          {message && <p className="account-success" role="status"><Check size={18} />{message}</p>}

          {!config ? (
            <>
              <UserRound size={28} />
              <h2>Il tuo accesso attuale</h2>
              {legacy ? (
                <>
                  <p>Hai effettuato l’accesso con ChatGPT come <strong>{legacy.email}</strong>.</p>
                  <p>La registrazione Recipeek con email e provider sarà disponibile al termine della configurazione. Il tuo ricettario resta accessibile.</p>
                  <LogoutButton userId={storageUserId} />
                </>
              ) : (
                <a className="button primary" href="/signin-with-chatgpt?return_to=%2Faccount" target="_top">
                  Accedi con ChatGPT<ArrowUpRight size={17} />
                </a>
              )}
            </>
          ) : user ? (
            <>
              <div className="account-identity">
                <span className="avatar">{user.email[0]?.toUpperCase()}</span>
                <div>
                  <h2>Il tuo account</h2>
                  <p>{user.email}</p>
                  <small>{user.verified ? 'Indirizzo verificato' : 'Conferma il tuo indirizzo email per accedere alle ricette'}</small>
                </div>
              </div>

              <section className="account-section">
                <h3>Metodi di accesso</h3>
                <p>Un solo account, con ogni metodo collegato.</p>
                <div className="account-methods">
                  {[...new Set([...user.providers, ...(passwordAdded ? ['email'] : [])])].map((provider) => (
                    <div key={provider}>
                      {provider === 'email' ? <Mail size={20} /> : <ProviderMark provider={provider} />}
                      <span>{provider === 'email' ? 'Email e password' : socialProviders.find((item) => item.id === provider)?.name ?? provider}</span>
                      <Check size={16} aria-label="Attivo" />
                    </div>
                  ))}
                </div>
                <div className="account-providers">
                  {configuredProviders.filter((provider) => !user.providers.includes(provider.id)).map((provider) => (
                    <button className="button" disabled={busy} key={provider.id} onClick={() => void social(provider.id, true)}>
                      <ProviderMark provider={provider.id} />Aggiungi {provider.name}<ArrowUpRight size={15} />
                    </button>
                  ))}
                </div>
              </section>

              <details className="account-password-settings" open={reset || undefined}>
                <summary>
                  <KeyRound size={18} />
                  {reset ? 'Scegli una nuova password' : passwordEnabled ? 'Modifica password' : 'Aggiungi accesso con password'}
                </summary>
                <form onSubmit={updatePassword}>
                  {!reset && passwordEnabled && (
                    <label>Password attuale<input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
                  )}
                  <label>Nuova password<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
                  <label>Ripeti la nuova password<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
                  <p className="field-help">Almeno 12 caratteri. Userai {user.email} per accedere allo stesso account.</p>
                  <button className="button primary" disabled={busy || !user.verified}>{passwordEnabled ? 'Aggiorna password' : 'Imposta password'}</button>
                </form>
              </details>

              {emailDeliveryReady && (
                <form className="account-email-settings" onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    if (!client) return;
                    const { error } = await client.auth.updateUser({ email: changeEmail }, { emailRedirectTo: callback() });
                    if (error) throw error;
                    setChangeEmail('');
                    setMessage('Conferma il cambio indirizzo tramite le email ricevute. L’indirizzo attuale resta valido fino alla conferma.');
                  });
                }}>
                  <h3><Mail size={18} />Indirizzo email</h3>
                  <label>Nuovo indirizzo<input type="email" autoComplete="email" maxLength={254} required value={changeEmail} onChange={(event) => setChangeEmail(event.target.value)} /></label>
                  <button className="button" disabled={busy}>Richiedi cambio email</button>
                </form>
              )}

              <section className="account-section account-session-section">
                <h3>Sessioni</h3>
                <p>Esci da questo browser oppure da tutti i dispositivi.</p>
                <div className="account-session-actions">
                  <LogoutButton userId={storageUserId} />
                  <LogoutButton userId={storageUserId} allDevices />
                </div>
                <p className="field-help">Gli accessi già in corso possono restare attivi fino alla loro scadenza.</p>
              </section>

              <Link className="account-install-link" href="/install">Aggiungi Recipeek alla schermata Home<ArrowUpRight size={15} /></Link>
            </>
          ) : (
            <>
              <div className="account-auth-heading">
                <span className="account-auth-symbol" aria-hidden="true">✳</span>
                <p className="eyebrow">IL TUO RICETTARIO</p>
                <h1>{view === 'signup' ? 'Crea il tuo account' : view === 'forgot' ? 'Recupera l’accesso' : 'Bentornato'}</h1>
                <p>{view === 'signup' ? 'Le tue ricette, in un solo posto.' : view === 'forgot' ? 'Ti invieremo un link per reimpostare la password.' : 'Accedi alle tue ricette.'}</p>
              </div>

              {!settingsAvailable && <p className="account-auth-notice" role="status">Il servizio di accesso non è disponibile al momento. Riprova tra poco.</p>}

              {view !== 'forgot' && configuredProviders.length > 0 && (
                <div className="account-providers account-auth-providers">
                  {configuredProviders.map((provider) => (
                    <button className="button" disabled={busy} key={provider.id} onClick={() => void social(provider.id)}>
                      <ProviderMark provider={provider.id} /><span>Continua con {provider.name}</span><span aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}

              {emailEnabled && view !== 'forgot' && configuredProviders.length > 0 && <div className="account-divider"><span>oppure con email</span></div>}

              {emailEnabled && (
                <>
                  <form onSubmit={submit}>
                    {view === 'signup' && <label>Come ti chiami?<input autoComplete="name" maxLength={60} required value={name} onChange={(event) => setName(event.target.value)} /></label>}
                    <label>Email<input type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                    {view !== 'forgot' && <label>Password<input type="password" autoComplete={view === 'signup' ? 'new-password' : 'current-password'} minLength={view === 'signup' ? 12 : 1} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
                    {view === 'signup' && (
                      <>
                        <label>Ripeti la password<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
                        <p className="field-help">Almeno 12 caratteri. Riceverai un’email per confermare l’indirizzo.</p>
                      </>
                    )}
                    <button className="button primary" disabled={busy}>
                      {busy ? 'Un momento…' : view === 'signup' ? 'Crea account' : view === 'forgot' ? 'Invia il collegamento' : 'Accedi'}
                    </button>
                  </form>

                  <div className="account-switch">
                    {view === 'signin' ? emailDeliveryReady ? (
                      <>
                        <button className="text-button" onClick={() => { setView('forgot'); setError(''); setMessage(''); setPassword(''); }}>Password dimenticata?</button>
                        <button className="text-button" onClick={() => { setView('signup'); setError(''); setMessage(''); setPassword(''); }}>Crea un account</button>
                      </>
                    ) : (
                      <p className="field-help">
                        {configuredProviders.length > 0
                          ? 'Per creare un account, scegli un metodo disponibile qui sopra. Il recupero via email non è disponibile.'
                          : 'Registrazione e recupero via email non sono disponibili al momento.'}
                      </p>
                    ) : (
                      <button className="text-button" onClick={() => { setView('signin'); setError(''); setMessage(''); setPassword(''); }}>Hai già un account? Accedi</button>
                    )}
                  </div>
                </>
              )}

              {settingsAvailable && !emailEnabled && configuredProviders.length === 0 && (
                <p className="account-auth-notice">L’accesso non è disponibile al momento. Riprova tra poco.</p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
