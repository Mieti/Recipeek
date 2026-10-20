# 0014 — Navigazione e spazio personale

Data: 20 ottobre 2026. Stato: adottata; decisione aggiornata il 20 ottobre 2026.

## Contesto

La navigazione precedente mostrava Ricette, Amici e Tu come destinazioni distinte e ripeteva l'accesso al profilo nella barra laterale. Su telefono l'azione Aggiungi era separata da quattro pulsanti in basso. Le viste, i link condivisi e la cronologia devono continuare a funzionare mentre Amici diventa una sezione del Profilo.

## Decisione

Le tre azioni principali sono Ricette, Aggiungi e Profilo. Su telefono sono disposte in basso, nell'ordine Ricette a sinistra, Aggiungi al centro e Profilo a destra. Su desktop la barra laterale presenta le stesse tre azioni. Aggiungi apre la scelta esistente fra Manuale e Importa. Preferite, Ingredienti e Raccolte restano accessibili come contenuti secondari del ricettario.

Profilo riunisce dati personali, Amici e ricette condivise, backup, spazio foto e cestino. La sezione Amici mantiene persone visibili, azioni Segui/Non seguire, filtro per le persone seguite e ricette condivise. Il link `?view=friends` resta valido e apre questa sezione con Profilo selezionato; `?view=you` apre i dati del profilo e `?view=recipes` il ricettario. I link alla singola ricetta, i filtri compatibili e la cronologia del browser continuano a ripristinare il proprio stato. `/import` e `/account` restano percorsi dedicati.

Schede, filtri e modalità di cottura partecipano alla cronologia. Indietro chiude prima il livello aperto e poi torna alla vista precedente. Le sessioni di cottura mantengono lo stato già salvato e si possono riprendere; il comando Ricette termina la modalità di cottura e rimuove la query della scheda.

L'unico collegamento a identità, sicurezza e logout va a `/account`, come stabilito dall'ADR 0006. Endpoint, verifiche di origine, revoca, cookie, pulizia locale e comportamento fra schede non cambiano.

Il catalogo mostra immagini solo quando esiste una foto reale. Le ricette senza foto usano righe testuali. L'editor manuale usa sezioni e dettagli espandibili, occupa lo schermo su telefono e mantiene campi, foto, timer, collegamenti agli ingredienti, dosi parziali, autosalvataggio e controllo della revisione. Una bozza senza ricetta originale resta recuperabile; copiarla come nuova è un'azione esplicita.

## Conseguenze

Amici non è più una destinazione principale: i suoi contenuti si raggiungono da Profilo e il vecchio deep link resta compatibile. Il guscio mostra una sola azione per ciascuna funzione principale e non duplica il collegamento al profilo. Nessun endpoint, permesso, provider, autenticazione o limite di servizio viene modificato.

## Verifica

TypeScript senza errori; 97 test automatici superati. La verifica visuale del preview con dati fittizi deve coprire 320, 390 e 768 pixel, inclusi il pulsante Profilo attivo su `?view=friends` e il ritorno alla sezione Profilo con Indietro.
