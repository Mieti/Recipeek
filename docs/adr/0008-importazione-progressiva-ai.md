# 0008 — Importazione AI progressiva e revisione delle proposte

Data: 18 ottobre 2026. Stato: implementazione beta, attivazione provider e valutazione reale pendenti.

## Contesto

L’utente ha approvato importazione da URL, testo e foto, priorità al testo per contenere i costi e suggerimenti AI separati, modificabili e accettati esplicitamente. L’importazione deve produrre una bozza privata da verificare prima del salvataggio.

## Scelta

- `/import` è una pagina autenticata con lo stesso controllo di sessione e cache delle altre superfici private.
- D1 conserva input, materiali, estrazione originale, suggerimenti, revisione, stato, consumi disponibili e associazione alla ricetta. R2 conserva le foto tramite l’upload esistente, che rimuove i metadati. Le foto della fonte non diventano automaticamente immagini del piatto.
- Gli URL sono passati esclusivamente all’endpoint fisso Supadata: il Worker non esegue fetch arbitrari verso la destinazione. Sono rifiutati URL non HTTPS, credenziali, IP e nomi locali. L’accesso alla pagina remota è delegato al provider, inclusi risoluzione e redirect.
- Per social: metadata/didascalia → estrazione → trascrizione esistente `mode=native` solo se insufficiente → nuova estrazione. Nessuna generazione automatica dell’audio. Se il testo basta ci fermiamo, con copertura dichiarata nell’interfaccia.
- Per siti: Supadata Web Scrape produce testo Markdown. Il percorso di produzione non usa ancora il parser JSON-LD diretto del laboratorio Node, che richiede un trasporto DNS compatibile e sicuro per Workers. Questo mantiene una dipendenza di acquisizione anche per i siti.
- Per foto: da una a quattro pagine, massimo 12 MB complessivi dopo upload; analisi visiva Gemini con riferimenti distinti alle pagine.
- Gemini `gemini-3.8-flash` è il primo adapter operativo, non il vincitore di un confronto già eseguito. Un’eventuale selezione economica per tipo di materiale richiede valutazioni reali.
- Supadata Extract gestisce l’approfondimento video asincrono. È disattivato per impostazione predefinita; quando abilitato richiede durata nota entro 180 secondi e consente un solo avvio per importazione. Le osservazioni del video restano da verificare, le fonti testuali precedenti restano consultabili.
- Schema rigoroso e controlli deterministici verificano riferimenti, citazioni, dose associata all’ingrediente, lacune e contraddizioni. Questi controlli evidenziano problemi e non certificano correttezza culinaria o sicurezza alimentare.
- Proposte e campi estratti sono distinti. I suggerimenti non colmano le lacune ai fini della decisione di approfondire. Il salvataggio richiede una decisione per ogni proposta, porzioni confermate e revisione esplicita. La ricetta viene salvata privata; l’importazione originale e le decisioni restano disponibili in D1 e una sintesi entra nelle note.
- Deduplicazione per account/input, salvataggio idempotente, confronto della revisione e lease limitano doppie chiamate e conflitti. Esiti ambigui non vengono ripetuti automaticamente. Quote beta: 10 nuovi import al giorno per account, 100 complessivi; non equivalgono a un tetto monetario garantito.

## Limiti e passaggi successivi

La progressione è guidata da richieste del client, con ogni fase salvata sul server. La richiesta in corso può completarsi dopo la chiusura della pagina, ma le fasi successive riprendono riaprendo l’importazione. Il completamento autonomo a pagina chiusa richiede una coda o workflow durevole: questa beta non lo garantisce.

Le credenziali non erano disponibili all’implementazione. I test con risposte simulate verificano controllo del flusso e sicurezza dei dati, non la qualità reale del modello, l’accessibilità dei social o i consumi fatturati. Prima di attivare i provider, verificare i contratti reali, i limiti dei piani e un campione rappresentativo. Il benchmark comparativo di 60–100 fonti rimane da eseguire.

Le bozze hanno un pulsante esplicito “Salva bozza”; modifiche non salvate nella revisione si perdono se si chiude la pagina. L’elenco mostra le ultime 50 importazioni non scartate.
