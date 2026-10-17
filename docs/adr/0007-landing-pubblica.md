# 0007 — Landing pubblica e accesso autonomo

Data: 17 ottobre 2026. Stato: adottata su richiesta di Riccardo.

## Contesto

Il gate ChatGPT dell'hosting impedisce di raggiungere la pagina di accesso Recipeek. Il proprietario chiede una normale landing pubblica e login autonomo. Si aggiorna la scelta di mantenere l'hosting privato negli ADR 0004 e 0005.

## Scelta

La home anonima presenta Recipeek e collega `/account`. Le sessioni Supabase verificate aprono il catalogo personale. Il runtime usa `RECIPEEK_AUTH_MODE=supabase`: una sessione ChatGPT, da sola, non autorizza più pagine o API del ricettario. Solo dopo il deploy e il controllo delle API anonime si imposta l'hosting su pubblico, come richiesto.

Il catalogo precedente del proprietario non ha ancora un'associazione persistita. Prima del passaggio sono stati confrontati l'account proprietario restituito da Sites e l'unico account Google Supabase, con lo stesso indirizzo confermato, e identificato il profilo esistente. Si configura lato server una coppia esplicita `RECIPEEK_LEGACY_AUTH_ID` / `RECIPEEK_LEGACY_PROFILE_ID`. Solo l'UUID verificato da Supabase può risolvere quel profilo, che deve già esistere; un conflitto non sovrascrive associazioni o ricette. Nessun identificativo arriva da form, metadati utente o header del browser. Questo completa l'ADR 0005 per la migrazione verificata dall'operatore anche senza una sessione ChatGPT nel browser del proprietario. Non è una ricerca generica per email.

Google permette registrazione e accesso. Email/password continua a permettere l'accesso agli account già configurati. Senza SMTP collaudato, `RECIPEEK_EMAIL_DELIVERY_READY=false` nasconde registrazione e recupero via email e ne spiega l'indisponibilità: l'invio email non è più un prerequisito della landing pubblica, perché Google è disponibile. La flag sarà abilitata solo dopo aver verificato la consegna. Apple resta disabilitato.

La pubblicazione della landing non rende anonime le API. Ricette e foto private restano autorizzate per proprietario; le ricette esplicitamente condivise sono consultabili dagli utenti Recipeek autenticati, ora ammessi tramite Supabase.

## Verifica

56 test automatici, incluso UUID di migrazione verificato, metadati contraffatti, indirizzo cambiato, profilo mancante e associazioni in conflitto. TypeScript senza errori. Due account temporanei reali e cinque ricette sul Worker locale in modalità Supabase: home anonima 200, nessun link ChatGPT, identità gateway isolata respinta 401, CRUD, foto, condivisione e backup fra utenti.

Browser desktop: landing, pulsante Accedi e login Recipeek con Google/email; indicazione esplicita sullo stato dell'invio email. La verifica del consenso Google personale e dei dispositivi iOS resta separata.
