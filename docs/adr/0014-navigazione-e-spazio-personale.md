# 0014 — Navigazione e spazio personale

Data: 20 ottobre 2026. Stato: adottata. Aggiorna la navigazione dell’app e la sola regola di visibilità dell’uscita descritta nell’ADR 0006.

## Contesto

La navigazione precedente occupava lo stesso spazio su telefono e desktop e mostrava più punti di accesso all’account. Le pagine di ricette, community e profilo devono restare raggiungibili tramite URL, cronologia del browser e link esistenti.

## Decisione

Ricette, Amici e Tu sono le viste principali, rappresentate da `?view=recipes`, `?view=friends` e `?view=you`. La modifica della vista conserva il percorso corrente e i filtri compatibili; `/import` e `/account` restano percorsi dedicati. Su telefono e tablet in verticale la navigazione è in basso con un’azione centrale per aggiungere una ricetta; su desktop resta nella barra laterale. L’azione centrale apre una scelta accessibile tra inserimento Manuale e Importa.

Schede, filtri e modalità di cottura partecipano alla cronologia. Indietro chiude prima il livello aperto e poi torna alla vista precedente. Le sessioni di cottura mantengono lo stato già salvato e si possono riprendere; il comando Ricette termina la modalità di cottura e rimuove la query della scheda.

Tu riunisce profilo, backup, spazio foto e cestino. L’unico collegamento a identità, sicurezza e logout va a `/account`. Il logout resta disponibile su quella pagina; endpoint, verifiche di origine, revoca, cookie, pulizia locale e comportamento fra schede dell’ADR 0006 non cambiano.

Il catalogo mostra immagini solo quando esiste una foto reale. Le ricette senza foto usano righe testuali. L’editor manuale usa sezioni e dettagli espandibili, occupa lo schermo su telefono e mantiene campi, foto, timer, collegamenti agli ingredienti, dosi parziali, autosalvataggio e controllo della revisione. Una bozza senza ricetta originale resta recuperabile; copiarla come nuova è un’azione esplicita.

## Conseguenze

Le query rendono ripristinabili le viste principali e permettono di chiudere schede o filtri con Indietro. Il pulsante globale Esci viene rimosso dal guscio dell’app; l’uscita Recipeek continua a seguire integralmente l’ADR 0006. Nessun endpoint, provider, autenticazione, permesso o limite di servizio viene modificato.

## Verifica

TypeScript senza errori e 97 test automatici superati. Le verifiche nel browser locale coprono pannello Aggiungi, conferma e annullamento dei filtri, bozza dell’editor, deep link Amici, cronologia e uscita dalla cottura, oltre ai layout telefono, tablet e desktop; i risultati sono nel report QA del 20 ottobre 2026.
