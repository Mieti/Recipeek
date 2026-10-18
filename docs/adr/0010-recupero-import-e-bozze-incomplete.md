# 0010 — Recupero import, bozze incomplete e budget

Data: 18 ottobre 2026. Aggiorna ADR 0008 e 0009.

La deduplicazione usa una chiave della fonte per account e una generazione progressiva. Un invio duplicato ritrova il lavoro corrente. Scartare e ripresentare la fonte crea una nuova generazione; riprovare un lavoro fallito richiede un'azione esplicita con avviso sul possibile costo. La generazione successiva ha un identificativo deterministico e un vincolo unico, per evitare duplicazioni fra richieste concorrenti. Ogni tentativo conta nelle quote. Gli esiti ambigui continuano a non essere ritentati automaticamente.

L'acquisizione del lease è un'unica scrittura con controllo dei lavori attivi globali: massimo due fasi e una serie di foto fra tutte le istanze. Supadata ha inoltre una prenotazione persistente di 1,2 secondi fra gli avvii. HTTP 429 conserva Retry-After e comporta fino a tre riprese con backoff e cooldown condiviso. La frequenza del cron resta un minuto; questa modifica non promette latenza immediata.

La revisione ha uno schema distinto, che ammette titolo/ingredienti/passaggi incompleti e porzioni non impostate (zero solo nella bozza). La ricetta finale continua a usare lo schema completo. L'autosalvataggio è serializzato, mantiene la revisione ricevuta dal server e conserva le modifiche successive a un invio. Un conflitto interrompe nuove sovrascritture e segnala il problema. Gli avvisi di uscita proteggono le modifiche non confermate; non sono una garanzia contro sospensione improvvisa del browser.

Il JSON Schema richiesto al provider deriva dallo schema Zod dell'estrazione. Le proprietà non documentate nel sottoinsieme Gemini, come pattern e lunghezze delle stringhe, diventano istruzioni descrittive; il server mantiene la validazione rigorosa. Le citazioni numeriche di tempi e porzioni vengono confrontate con il valore estratto, includendo conversioni ore/minuti. Le segnalazioni di formattazione da sole non acquistano altro materiale.

Ogni fase riserva budget prima dell'invio. Default mensili UTC: 5 USD stimati Gemini e 100 crediti Supadata. Gemini riserva prudentemente 0,50 USD per analisi testuale e 2 USD per foto; con contatori completi sostituisce la riserva con la stima alle tariffe configurate nel codice. Interactions distingue output e thought, sommati una volta per la componente output. Contatori assenti/esiti di rete incerti mantengono la riserva. Una chiamata mai inviata la libera. Supadata riserva un credito per chiamata oppure 15 per l'avvio video fino a tre minuti; il suo header di fatturazione riconcilia i consumi quando disponibile. Anche errori e risposte AI invalide conservano i consumi conosciuti.

Questo è un controllo applicativo prudenziale, non la fattura del provider o una garanzia indipendente da variazioni di listino. Non vengono acquistate ricariche automaticamente. La gestione di riserve sconosciute richiede verifica dell'operatore; non vengono azzerate automaticamente. Le righe precedenti a questa migrazione non vengono ricostruite come spesa zero. Al momento dell'attivazione della funzionalità le chiavi erano ancora assenti, quindi non esisteva consumo reale precedente da migrare.

Un elenco facoltativo di profili abilitati consente di riservare la beta AI agli account scelti, lasciando pubblico l'ingresso del sito e mantenendo separato il ricettario manuale. Non abilita nuovi utenti automaticamente.

Riferimenti: [Gemini Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output), [Interactions e usage](https://ai.google.dev/api/interactions-api), [tariffe Gemini](https://ai.google.dev/gemini-api/docs/pricing).
