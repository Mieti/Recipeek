# Attivazione dell’importazione AI

L’interfaccia è `/import`, raggiungibile da “Importa con AI” nel ricettario. Senza chiave Gemini il pulsante di analisi è disabilitato con uno stato esplicito. La compilazione manuale continua a funzionare.

## Credenziali

1. Creare una chiave Gemini API in Google AI Studio, con fatturazione e limiti adatti al progetto. Il modello utilizzato dall’app è `gemini-3.8-flash`.
2. Per URL social e siti creare una chiave Supadata e verificare copertura, quote e prezzi del piano. Testo incollato e foto richiedono solo Gemini.
3. In locale aggiungere `GEMINI_API_KEY` e `SUPADATA_API_KEY` al file ignorato `apps/recipeek/.dev.vars`. Se le chiavi sono state inserite nel file root `.env.local` del laboratorio, devono essere trasferite al runtime dell’app senza stamparle.
4. In produzione configurarle come variabili **segrete** Sites. Una nuova distribuzione applica la revisione dell’ambiente. Non inserirle nel manifest, nei sorgenti, negli argomenti shell o in chat.
5. Lasciare `RECIPEEK_IMPORT_VIDEO=false` durante i primi test. Abilitarlo solo dopo aver verificato Supadata Extract e i suoi costi; l’app limita i video alla durata nota di tre minuti.

## Coda cloud

La coda è persistente in D1. Il processo cloud `recipeek-import-queue` su Supabase richiama il Worker ogni minuto anche a browser chiuso. Il token interno `RECIPEEK_IMPORT_QUEUE_TOKEN` è un segreto generato per il servizio, distinto dalle chiavi Gemini e Supadata: non deve essere fornito agli utenti o inserito nel client.

Il ricettario non viene salvato automaticamente dall’AI: al termine dell’elaborazione rimane una bozza da revisionare. Il richiamo periodico non sostituisce Gemini/Supadata e non può generare ricette finché le relative chiavi mancano.

Per verificare lo scheduler: controllare in Supabase Cron il job `recipeek-import-queue`, il suo stato attivo e gli esiti HTTP in `net._http_response`. Il heartbeat della coda è restituito dalla configurazione dell’importazione soltanto agli utenti autenticati. Evitare di stampare header, Vault o valori dei segreti.

In locale il richiamo cloud punta esclusivamente alla produzione. Per provare le fasi locali, configurare un token locale distinto in `.dev.vars` e richiamare POST `http://127.0.0.1:5173/internal/import-queue` con il relativo bearer; ogni richiamo elabora al massimo una fase per due lavori. I test automatici non richiedono chiavi reali.

Fonti ufficiali per verificare il contratto corrente: [Gemini Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output), [Supadata API](https://docs.supadata.ai/api-reference/introduction), [Supadata OpenAPI](https://docs.supadata.ai/api-reference/v1-openapi.json).

## Verifica prima dell’attivazione per gli amici

- Eseguire import reali di descrizione completa, descrizione insufficiente con trascrizione, sito e foto di libro, poi video se attivato.
- Verificare omissioni, dosi/frazioni/unità, ordine dei passaggi, conflitti e qualità dei suggerimenti rispetto alla fonte originale.
- Confrontare i consumi registrati in D1 con quelli dei provider: conteggi assenti restano sconosciuti, non zero.
- Misurare costo per bozza accettata, latenza e tempo di correzione. Usare un insieme separato di esempi per validare le modifiche al prompt.
- Testare dal telefono reale acquisizione foto, tastiera, riapertura della bozza e salvataggio.

Non sono stati eseguiti import a pagamento durante l’implementazione perché le chiavi erano assenti. Gli adapter sono verificati con risposte simulate aderenti ai contratti documentati, non con chiamate reali.
