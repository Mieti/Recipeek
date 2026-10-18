# 0011 — Integrazioni della bozza, guardrail e monitor

Data: 19 ottobre 2026. Aggiorna ADR 0008–0010 senza attivare analisi video o nuovi piani.

Una bozza pronta può ricevere testo o foto della stessa ricetta. La fonte, il lavoro e la revisione restano gli stessi. L'utente conferma il nuovo consumo; la coda analizza insieme le fonti e conserva il risultato separato in `candidate`. La revisione precedente rimane intatta anche dopo errori del provider, timeout o un risultato non culinario. Prima di salvare la ricetta occorre integrare o scartare il candidato.

L'integrazione riempie lacune, conserva campi manuali e rimozioni, riconcilia gli identificativi degli ingredienti tramite il nome normalizzato e non sostituisce un procedimento esistente. Se il procedimento era assente, aggiunge i passaggi estratti; altrimenti il nuovo procedimento rimane consultabile nel confronto prima della decisione. Le proposte AI richiedono nuove decisioni esplicite. Quantità q.b. e unità incompatibili non vengono convertite automaticamente.

Limiti: tre integrazioni per lavoro, quattro foto e 12 MB complessivi, 64.000 caratteri complessivi di fonti testuali. Le integrazioni contano nelle quote giornaliere condivise con i nuovi import, anche dopo lo scarto. Una scrittura condizionale con revisione e lease impedisce due analisi concorrenti della stessa integrazione. Budget e prenotazioni esistenti si applicano anche alla nuova fase; le foto aggiuntive rispettano proprietà, sanificazione, protezione dalla pulizia e limite globale di un lavoro fotografico.

La classificazione culinaria avviene nella stessa chiamata di estrazione, senza una chiamata classificatrice aggiuntiva. Il prompt distingue ricette per persone, bevande e tecniche di cucina da recensioni senza preparazione, pubblicità, diete senza procedimento, metafore, cosmetici e detergenti. Solo titolo o hashtag non bastano. Più ricette richiedono selezione anziché fusione. Un controllo indipendente sul server verifica riferimenti e supporto letterale delle evidenze; una risposta non sostenuta o strutturalmente incoerente viene resa insufficiente. `not_recipe` e `insufficient_content` non espongono ingredienti, passaggi o suggerimenti generati e non sono salvabili come import AI. Una fonte dichiarata non culinaria non può ricevere materiale estraneo per trasformarla artificiosamente in una ricetta.

La semantica rimane probabilistica: schema, citazioni e test non certificano accuratezza culinaria, sicurezza alimentare o resistenza universale a prompt injection. Le osservazioni da foto/video richiedono confronto umano con la fonte.

`RECIPEEK_IMPORT_ADMIN_PROFILES` è una lista esplicita di profili server; assente significa nessun amministratore. `/import/monitor` e l'API aggregata richiedono questa autorizzazione. Il monitor non espone documenti, URL, foto, email o identificativi degli altri utenti. Distingue consumi stimati conosciuti e riserve non riconciliate; non modifica budget o saldi. Nessuna nuova dipendenza a pagamento.

I tempi di primo esito vengono registrati per i nuovi lavori; non sono ricostruiti usando il successivo salvataggio della revisione. I token mostrati riguardano lavori creati nel mese; il registro budget rimane il riferimento per le operazioni fatturate nel mese UTC. I contatori provider mancanti restano incerti.
