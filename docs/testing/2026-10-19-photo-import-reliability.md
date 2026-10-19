# Correzione importazioni fotografiche — 19 ottobre 2026

## Diagnosi in produzione

Tre importazioni fotografiche osservate alle 11:30–11:33, ora italiana. La prima è terminata dopo circa 23 secondi complessivi con consumo Gemini sconosciuto: il timeout della chiamata era 20 secondi. Le successive due non hanno inviato richieste Gemini: la riserva di 2 USD, insieme alle riserve pregresse, superava il budget disponibile. Fonti conservate, nessuna ricetta salvata automaticamente.

Il kickoff `waitUntil` poteva prendere il lavoro prima della pagina e non è adatto a elaborazioni oltre la sua finestra di durata. Anche il cron HTTP esistente aveva timeout di 25 secondi.

## Correzioni

- Gemini fotografico: timeout 50 secondi, lease 90 secondi; testo invariato a 20 secondi.
- Kickoff breve esclude lavori con foto, comprese integrazioni; pagina e cron li elaborano usando gli stessi lock.
- Cron esistente `recipeek-import-queue`, job 1, mantiene cadenza ogni minuto con timeout HTTP 60 secondi. Stato attivo verificato; nessun nuovo servizio.
- Nuove riserve Gemini da 0,50 USD anche per foto; budget mensile e riserve storiche incerte conservati.
- Messaggio specifico per timeout, senza ripetizione automatica di generazioni dall'esito incerto.

La modalità background Gemini è stata esclusa dopo verifica reale: `store=false` rifiutato; `store=true` con immagini rifiutato con “Image input modality is not enabled”. Nessuna interazione asincrona creata. Il codice pubblicato mantiene `store=false` e il modello esistente.

## Verifiche

97 test passati e TypeScript senza errori. Nuovi casi verificano esclusione dal kickoff breve, elaborazione nella coda ordinaria, proprietà delle foto, lease più lungo, assenza di generazioni duplicate, rispetto delle riserve storiche, riconciliazione del costo e messaggio sui timeout. Build di produzione riuscita; shim npm locale aggirato eseguendo lo stesso script build con Node 24.

Prova reale tramite pipeline API/upload/Gemini/revisione/salvataggio con database e archivio isolati, senza creare account o ricette di produzione: pagina PNG “Muffin al limone”, 8 ingredienti, 4 passaggi, 6 persone. Verificati 180 g farina, 60 g zucchero e 0,5 lievito; ricetta salvata. Una sola generazione, circa 20 secondi, 1.958 token input e 1.317 output, 0 thought; costo stimato 0,006408 USD. Singola osservazione, nessuna garanzia di latenza.

Le tre importazioni originali non sono state ripetute automaticamente: la prima ha consumo incerto. L'utente può riaprire un'importazione e confermare “Riprova la fonte”; le immagini conservate vengono riutilizzate. Non sono state cancellate riserve, foto o ricette dell'utente.

Limiti: non eseguito nuovo collaudo su iPhone fisico né sulle immagini personali dell'utente. Un provider che non risponde entro 50 secondi può ancora interrompere l'importazione; il timeout e la mancata ripetizione tutelano la spesa.

## Pubblicazione

Versione Sites 22 pubblicata con successo il 19 ottobre 2026 alle 11:50 italiane, URL https://recipeek.muddydace3.chatgpt.site. Sorgente `2515c5bfb969d37d37bdde41f206927bf716086f`; versione `appgprj_6ad2743d738081919511870b64108e39~appgver_b629e087f13c81918da49574f66d65e4`; deployment `appgdep_6ad5e7e6b7288191ad8e68c35ab4c6cc`, stato `succeeded`, revisione ambiente 5.

Archivio `.local/recipeek-photo-reliability.tar.gz`: hash SHA256 del file locale `9c8a4890cfacc57f716e8398212b69e3d997b3a47da155fc2e8fda42daef3b72`; hash del contenuto restituito da Sites `475ff18016c87c39de5f1763cee889fe0e72fed8093f8c37594a89a003c31e8d`. Pacchettizzazione completata con Git Bash e `TAR_OPTIONS=--force-local` per i percorsi Windows.
