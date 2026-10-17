# 0001 — Prima versione utilizzabile e deploy privato

Data: 16 ottobre 2026. Stato: implementato per la prima versione; il client mobile nativo resta da scegliere.

## Contesto

Riccardo ha richiesto di proseguire con l’implementazione e un primo deploy, rinviando il modello AI. L’ambiente disponibile è Windows e offre il runtime Sites con autenticazione, D1 e R2.

## Scelta

La prima versione è una web app adattiva, con sorgente in `apps/recipeek`, React/TypeScript su Vinext e Cloudflare Workers. D1 conserva profili, documenti ricetta, anagrafica ingredienti, collegamenti e follow. R2 conserva le foto. L’autenticazione è quella gestita da Sites, con identità verificata nelle API e autorizzazione per ogni risorsa. Il deploy nasce privato e non modifica automaticamente il pubblico del sito.

Il flusso manuale è indipendente dall’AI. Il laboratorio di importazione rimane disponibile separatamente. Il JSON della ricetta e le regole di ricalcolo in `lib/model.ts` possono essere riusati da un futuro client, mentre autenticazione e storage richiederanno adapter.

## Conseguenze

- Il ricettario usa dati persistenti sul server, disponibili su dispositivi diversi dopo accesso allo stesso sito/account.
- Le ricette sono private per impostazione predefinita. Rendere condivisa una ricetta è un’azione distinta dal concedere accesso al sito.
- La UI può essere aggiunta alla schermata Home come collegamento web. Questa versione richiede connessione; non promette sincronizzazione offline, notifiche timer in background o distribuzione TestFlight/App Store.
- Il login iniziale è ChatGPT tramite Sites. Apple/Google diretti, un’eventuale app Expo/React Native e la portabilità del backend sono lavoro successivo, non funzioni già attive.
- Per pubblicazione e runtime ci sono dipendenze da Sites, Vinext, D1 e R2. L’esportazione JSON delle ricette è inclusa; le foto vanno gestite separatamente.
- Un limite di 1.000 ricette per elenco e 6 MB per foto mantiene circoscritta la prima versione. Le quote foto e la pulizia sono state introdotte con ADR 0002. Prima di ampliare il pubblico servono paginazione, moderazione e ulteriori verifiche su dispositivi reali.

## Alternative considerate

Expo/React Native con Supabase resta una possibilità per il prodotto mobile. Non viene introdotto come secondo stack in questa prima pubblicazione. Il prototipo con soli dati locali non avrebbe verificato persistenza e isolamento tra utenti.
