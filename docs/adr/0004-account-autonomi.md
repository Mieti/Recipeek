# 0004 — Account Recipeek e transizione da Sites

Data: 17 ottobre 2026. Stato: integrazione implementata e verificata; attivazione autonoma e invio email agli amici da completare.

## Contesto

Riccardo ha richiesto registrazione email/password o provider principali e ha scelto di configurare Supabase da zero. Si riapre la scelta dell’ADR 0001 che riservava l’accesso a ChatGPT: resta adatta alla beta privata, ma non soddisfa la registrazione autonoma richiesta.

## Scelta

Supabase Auth gestisce credenziali, conferme email, recupero password, cambio email e identità OAuth. Il progetto `ybrxvbxjmxnxgbupxblj` (Recipeek) è stato creato nell’organizzazione esistente sul piano Free, regione eu-central-1. Ricette e foto restano in D1/R2; nessun dato del catalogo ospitato è stato copiato nel nuovo progetto. L’app riceve soltanto URL e chiave publishable: chiavi amministrative non vengono installate sul sito o nel browser.

Si usa l’SDK ufficiale con cookie e PKCE. Il Worker aggiorna i cookie prima del rendering e propaga gli aggiornamenti anche sulle risposte di redirect. Ogni identità è verificata con `getUser`, mai accettata da un cookie decodificato o dai metadati modificabili dell’utente. È necessaria un’email confermata. Guasti Auth o configurazioni mancanti non ripiegano su ChatGPT quando è attiva la modalità Supabase. Le risposte account, callback e API non sono memorizzabili in cache.

La tabella `external_identities` associa l’UUID Auth al profilo esistente. Il collegamento richiede contemporaneamente un’identità Sites e una Supabase verificata, conferma esplicita e stessa origine. Non si collegano ricettari tramite semplice uguaglianza email. Associazioni già esistenti con ricettari distinti producono un conflitto; non si fondono o sovrascrivono automaticamente i dati.

Il browser ricarica l’app al cambio di account o all’uscita e rimuove le bozze/stato cooking dell’account precedente, come già previsto per il logout. Le autorizzazioni restano sul server, indipendenti dall’interfaccia.

## Attivazione

`RECIPEEK_AUTH_MODE=sites` mantiene l’accesso attuale durante la transizione; `/account` permette di registrare il nuovo account e collegare il ricettario. `supabase` abilita soltanto le identità Auth verificate nelle API. Non basta modificare questa variabile per rimuovere il gate dell’hosting: il sito privato richiede comunque l’accesso Sites. Prima di cambiare modalità/pubblico occorrono SMTP funzionante, collegamento del proprietario e verifiche anonime del nuovo accesso. L’attuale pubblico owner-only viene conservato.

Google, Apple e Microsoft sono integrati tramite Supabase, ma non sono attivi senza le rispettive applicazioni e credenziali OAuth. Il client mostra solo i provider dichiarati abilitati dal servizio. Email/password è disponibile soltanto con conferma email abilitata. Il progetto non dispone ancora di SMTP personalizzato: il mittente predefinito è limitato agli indirizzi del team. Non è una registrazione aperta agli amici già operativa.

Sessioni JWT: durata 15 minuti. L’uscita globale revoca il rinnovo delle sessioni; token già emessi possono restare validi fino a scadenza. Il cambio email richiede conferma sicura, la password almeno 12 caratteri e riautenticazione secondo le impostazioni Supabase. La cancellazione completa dell’account e una lista nominativa dei dispositivi non sono implementate in questa iterazione.

## Verifica

Test automatici con SQLite per permessi e migrazione; test dell’SDK contro un servizio simulato per cookie contraffatti, refresh e indisponibilità; prova aggiuntiva con due utenti reali temporanei nel nuovo Supabase e Worker locale. Nessuna email è stata inviata dai test: gli utenti sintetici sono stati confermati amministrativamente, poi rimossi. Conferme/recupero email e OAuth reali restano da verificare dopo la configurazione esterna. Il report è in `docs/testing/2026-10-17-accounts.md`.
