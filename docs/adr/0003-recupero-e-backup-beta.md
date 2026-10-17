# 0003 — Recupero del lavoro e backup per la beta

Data: 17 ottobre 2026. Stato: implementato, collaudo su dispositivi reali da completare.

## Decisione

Le bozze manuali incomplete vengono conservate in localStorage, per account e ricetta, insieme a sezione dell’editor e revisione originale. Chiudere l’editor conserva la bozza; salvarla o scartarla la rimuove. Il logout rimuove le bozze dell’account dal browser. Il salvataggio definitivo continua a controllare la revisione: recuperare una bozza vecchia non deve sovrascrivere modifiche di un altro dispositivo. Se il browser nega lo storage o lo esaurisce, l’editor mostra che la bozza non è conservata. Non si tratta di sincronizzazione delle bozze fra dispositivi; le foto di bozze mai salvate possono essere ripulite dopo 24 ore secondo ADR 0002.

La rimozione di una ricetta usa `deleted_at` e rende privato anche il documento. Il cestino è leggibile solo dal proprietario e non ha scadenza automatica. Ricette e foto rimangono nella quota; gli ingredienti delle ricette nel cestino non compaiono nell’anagrafica attiva. Il ripristino mantiene la visibilità privata e cambia la revisione. L’eliminazione definitiva rimuove ricetta/indice soltanto se è ancora nel cestino, evitando una gara con il ripristino. Le foto diventano eliminabili dopo almeno 24 ore dall’ultimo riferimento rimosso. È un’evoluzione esplicita della precedente eliminazione definitiva descritta in ADR 0001/0002.

Il backup completo è ZIP con file STORE, generato a flusso con backpressure usando fflate 0.8.3. Ogni parte contiene massimo 100 ricette e 5 MB di documenti, più le foto personali collegate, senza duplicare la stessa foto all’interno della parte. I riferimenti alle immagini di esempio restano asset distribuiti con Recipeek. Il cestino e le bozze locali non sono inclusi: le ricette da esportare vanno prima ripristinate nel catalogo. L’endpoint controlla proprietario, stato attivo, media e limiti prima di iniziare il flusso. Un errore successivo rende l’archivio incompleto, che il ripristino deve respingere.

Il manifest finale contiene nomi, dimensioni e SHA-256 dei file. Prima di scrivere, il browser valida l’intera parte, il manifest, i documenti, le foto e i riferimenti. Sono accettati soltanto i percorsi previsti e il metodo STORE, con limiti per file/totale/numero; non si estraggono file sul filesystem. Un ZIP modificato, troncato o con nomi duplicati è rifiutato. L’integrità non attesta l’identità di chi ha creato il backup.

Il ripristino aggiunge copie private senza sovrascrivere: riconosce le ricette originali già presenti nel proprio account e usa un identificativo deterministico per quelle importate da un’altra origine. Anche una copia nel cestino conta come presente. I media importati hanno identificativo derivato da account, formato e hash del contenuto. Un’interruzione può lasciare foto o alcune ricette già caricate; riprovare la stessa parte riusa il lavoro completato. Le nuove foto senza ricette restano soggette alla pulizia. Non è una transazione globale su R2 e D1 né una sincronizzazione di versioni diverse dello stesso backup.

Restano supportati i vecchi JSON, con le stesse regole di deduplicazione e senza foto personali. Quote storage invariate; ripristino fino a 600 tentativi foto/ora, backup fino a 20 parti/ora. Il client distanzia le scritture per rispettare le 300 richieste API/minuto.

## Verifica

SQLite reale, test di archivio e smoke HTTP coprono cestino, permessi, revisione, foto protette, import ripetuti, integrità, ZIP ostili e collegamenti ripristinati. Le prove interattive iPhone/iPad e fra due account reali sono distinte e documentate nella checklist beta.
