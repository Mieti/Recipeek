# Attivazione account autonomi

Il progetto Supabase **Recipeek**, `ybrxvbxjmxnxgbupxblj`, è già stato creato sul piano Free, regione Francoforte. Dashboard: https://supabase.com/dashboard/project/ybrxvbxjmxnxgbupxblj/auth/providers

URL e chiave publishable sono configurati nel runtime Sites. `RECIPEEK_AUTH_MODE=sites` conserva l’accesso attuale; `supabase` richiede l’identità Auth verificata nelle API. Mai inserire service_role, chiavi `sb_secret_` o il token di gestione Supabase nel frontend, nel manifest o nelle variabili dell’app. La password Postgres è stata generata casualmente durante la creazione e non è usata dall’app; se in futuro serve una connessione diretta, reimpostarla dal dashboard.

## Passaggi prima dell’apertura agli amici

1. Configurare Custom SMTP nel progetto, con un mittente verificato e un servizio email del proprietario. Il mittente predefinito di Supabase è destinato ai test con gli indirizzi del team e non abilita la registrazione generale. Conservare password e chiavi nel dashboard del servizio, mai nel repository o in chat.
2. Verificare conferma email, recupero password e cambio email su due caselle reali autorizzate. Mantenere conferma obbligatoria, cambio email sicuro, password minima 12 caratteri e limiti antiabuso.
3. Da `/account`, registrare l’account personale, confermare l’email e premere «Collega il mio ricettario» mentre è ancora presente l’accesso ChatGPT. La tabella di associazione preserva proprietario, ricette e foto; un conflitto viene segnalato senza fusione automatica.
4. Abilitare i provider desiderati in Supabase dopo aver creato le rispettive applicazioni Google, Apple o Microsoft. Callback provider: `https://ybrxvbxjmxnxgbupxblj.supabase.co/auth/v1/callback`. Microsoft richiede lo scope email. Apple richiede la corretta configurazione web e manutenzione della chiave secondo le proprie scadenze. Nessun pulsante viene mostrato prima dell’abilitazione.
5. Verificare callback dell’app `https://recipeek.muddydace3.chatgpt.site/auth/callback`; per il preview è autorizzato anche `http://127.0.0.1:5173/auth/callback`. Rimuovere il loopback prima di una distribuzione commerciale se non serve più. Non usare wildcard ampie.
6. Dopo il collegamento e il collaudo, impostare `RECIPEEK_AUTH_MODE=supabase` nel runtime e pubblicare. Verificare che richieste senza identità ricevano 401 e che nessun cookie/header contraffatto possa ripiegare su ChatGPT.
7. Solo dopo questi controlli valutare il cambio di pubblico Sites per rendere raggiungibile il login senza il gate ChatGPT. Il sito attuale resta privato. Rendere raggiungibile la pagina non rende pubbliche le ricette: le API continuano a controllare il proprietario. Il cambio di pubblico è un’azione distinta, da autorizzare sul risultato configurato e verificato.

La tabella `external_identities` è introdotta da `drizzle/0003_external_identity.sql`. Applicare le migrazioni una sola volta e in ordine; non riscrivere quelle applicate.

SDK e sessioni sono gestiti da Supabase. L’uscita globale impedisce il rinnovo, ma i token già emessi possono restare validi fino a 15 minuti. La pagina account permette cambio email/password, collegamento provider e uscita; cancellazione completa dell’account e inventario dei dispositivi restano successivi.

Riferimenti: [SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [password](https://supabase.com/docs/guides/auth/passwords), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Google](https://supabase.com/docs/guides/auth/social-login/auth-google), [Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple), [Microsoft](https://supabase.com/docs/guides/auth/social-login/auth-azure).
