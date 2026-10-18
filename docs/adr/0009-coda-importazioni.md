# 0009 — Coda persistente delle importazioni

Data: 18 ottobre 2026. Stato: implementato. Aggiorna la progressione guidata dal browser dell’ADR 0008.

## Scelta

D1 rimane l’unica fonte dello stato dei lavori. Ogni fase ha una scadenza del lease, una data di prossima esecuzione e un contatore dei tentativi. Un esecutore seleziona al massimo due lavori pronti, li reclama atomicamente e conserva l’esito prima di liberarli. Gli indici coprono selezione, elenco del proprietario e quote giornaliere.

Il Worker avvia un’elaborazione breve con `waitUntil` dopo una richiesta valida di creazione o aggiornamento. Supabase `pg_cron` e `pg_net` richiamano ogni minuto lo stesso esecutore tramite HTTPS. Questo richiamo cloud assicura che le fasi successive non dipendano dal browser o dal computer dello sviluppatore. Ogni richiamo elabora una fase per lavoro; il carico beta è limitato a due lavori contemporanei per richiamo, con lease che impediscono doppie elaborazioni dello stesso lavoro fra richiami sovrapposti.

L’endpoint `/internal/import-queue` accetta soltanto POST con un token di servizio casuale a 256 bit. Il token è conservato in Supabase Vault e fra i segreti Sites. La selezione dei lavori e dei proprietari avviene esclusivamente dal database: il chiamante non può indicare account, URL o credenziali. Il percorso è verificato prima dell’autenticazione utente, senza una chiamata a Supabase Auth per ciascun tick. Le altre API mantengono l’autorizzazione del proprietario.

Il browser legge uno stato compatto ogni cinque secondi, oppure ogni trenta quando la scheda è nascosta. I materiali e la bozza completa vengono scaricati quando lo stato diventa terminale. La richiesta legacy `advance` non esegue una fase.

## Recupero e costi

- Richiami concorrenti possono leggere gli stessi candidati; soltanto chi acquisisce il lease può elaborare il lavoro.
- Il polling di un job remoto già identificato può essere ritentato fino a due volte con attesa crescente. Un avvio di generazione con esito sconosciuto non viene ripetuto automaticamente; viene conservata la bozza testuale se disponibile.
- Un salvataggio interrotto usa l’identificativo idempotente della ricetta per riconciliare lo stato.
- Il richiamo periodico continua a verificare la coda anche quando non ci sono lavori. Non avvia analisi senza chiave Gemini. Il heartbeat registra l’ultimo controllo.
- Il ritmo di un minuto è un compromesso beta: non è una garanzia di latenza né un servizio con SLA. Richiede che progetto Supabase e hosting siano disponibili. Non è stato acquistato un piano aggiuntivo.

## Efficienza e qualità

Input testuali e parametri di tracciamento comuni vengono normalizzati prima della deduplicazione nello stesso account. Una trascrizione contenuta nel testo già analizzato non provoca una seconda chiamata AI. Gemini usa ragionamento `low`, citazioni brevi e input privi di etichette UI superflue, con un limite di output complessivo. Le stime di risparmio richiedono misure reali; non sono state attribuite percentuali ai cambiamenti.

Errori di associazione fra dosi e ingredienti o unità rimangono segnalati per revisione, ma da soli non fanno acquisire altro video: nuovo materiale non garantisce di correggere una lettura errata di una fonte già completa. Le lacune e i rimandi visivi continuano ad attivare l’approfondimento. Frazioni miste e Unicode sono riconosciute nei controlli numerici. Le immagini vengono sanificate anche prima dell’invio al provider, inclusi caricamenti precedenti.

## Riferimenti

[Supabase Cron e richieste HTTP](https://supabase.com/docs/guides/functions/schedule-functions), [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net), [controllo del ragionamento Gemini](https://ai.google.dev/gemini-api/docs/thinking).
