# 0012 — Import rapido e anteprima della ricetta

Data: 19 ottobre 2026. Aggiorna ADR 0008, 0009 e 0011 su richiesta dell'utente: ridurre attesa, moduli e predominanza delle fonti.

## Elaborazione

La pagina visibile invia `continue` per il proprio lavoro. Ogni richiesta esegue al massimo una fase attraverso `processImportJob`, con gli stessi lease atomici, budget, autorizzazioni, backoff e limiti globali della coda. Restituisce solo stato compatto; materiali e ricetta vengono richiesti all'esito terminale. Non serve attendere il cron tra due fasi. GET e l'azione legacy `advance` restano prive di elaborazione diretta.

Il richiamo server può concatenare fino a sei fasi dei due lavori selezionati, iniziando una fase successiva soltanto nei primi tre secondi del batch. Il timeout provider rimane 20 secondi. Cooldown e polling remoto interrompono il batch senza attese attive. Il cron resta il recupero a browser chiuso: l'esecuzione in background non ha una garanzia di latenza immediata. Nessun nuovo servizio a pagamento.

Didascalie senza indizi di procedimento acquisiscono prima la trascrizione nativa, così ingredienti e procedimento possono essere estratti con una sola chiamata Gemini. È una scelta di ordine, non un classificatore culinario. Se la trascrizione è vuota, ripetuta o non disponibile con HTTP 404/422, il testo già acquisito viene comunque analizzato una volta. Il marcatore del tentativo evita un ciclo di riacquisizione. Restano esclusi audio generato automaticamente e analisi video non abilitata.

Il prompt chiede istruzioni operative sintetiche, normalmente 3–7 passaggi, senza eliminare tempi, temperature, riposi o dosi parziali. Non impone un taglio rigido alle ricette complesse. Suggerimenti normalmente 0–2, massimo cinque; classificazione, evidenze e validazione rimangono richieste nella stessa chiamata.

## Revisione

La superficie iniziale è una ricetta leggibile, con ingredienti e procedimento. Il modulo completo è chiuso sotto “Modifica ricetta”. Restano visibili lacune indispensabili, conflitti e avvisi sintetici sulle dosi/evidenze da controllare. Le porzioni assenti vengono richieste senza inventarle; dosi assenti restano tali e non diventano q.b.

“Conferma e salva” è l'atto esplicito di revisione e conferma delle porzioni: sostituisce la casella aggiuntiva dell'ADR 0008. Il testo del pulsante dichiara anche l'esclusione delle proposte non applicate; non occorre scartarle una alla volta. Il server continua a richiedere decisioni complete e una ricetta valida. Le modifiche manuali a proposte applicate sono registrate come `edited`; le proposte mai applicate restano escluse.

Autosalvataggio serializzato e revisione ottimistica rimangono attivi. I candidati di integrazione richiedono ancora una scelta prima del salvataggio, per non perdere correzioni. Il report delle fonti è chiuso in fondo: distingue riscontro letterale, citazione non riscontrata e lettura visiva. Un riscontro letterale non certifica l'associazione semantica tra ingrediente, dose e unità.

Aggiornamento UX del 19 ottobre: “Modifica ricetta” separa Ingredienti, Passaggi e Dettagli. Le liste mostrano righe sintetiche e aprono un solo elemento per volta; i passaggi mantengono il testo completo nel campo di modifica. I collegamenti degli ingredienti restano sotto un'ulteriore espansione. Rimozione annullabile nell'editor corrente, riordino tramite pulsanti accessibili e focus restituito alla riga; nessun gesto nascosto indispensabile. Campi da 16 px, controlli touch di almeno 44 px e navigazione delle sezioni non sovrapposta alla tastiera. Il componente aggiorna la stessa bozza, senza cambiare salvataggio, validazione o semantica dei suggerimenti AI.

La cronologia tecnica rimane nel documento privato dell'importazione. Non viene più aggiunta alle note personali della ricetta. Nessuna modifica retroattiva delle ricette già salvate.
