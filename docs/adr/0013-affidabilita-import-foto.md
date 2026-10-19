# 0013 — Affidabilità dell'importazione fotografica

Data: 19 ottobre 2026. Aggiorna ADR 0009 e 0012 sui tempi delle foto.

L'analisi Gemini con foto ha un timeout di 50 secondi e un lease di 90 secondi. Testo e acquisizioni mantengono 20 secondi. Il kickoff `waitUntil`, limitato nella durata dopo la risposta, esclude i lavori con foto, comprese le integrazioni fotografiche. Questi lavori vengono elaborati dalla continuazione autenticata della pagina o dal richiamo HTTP della coda. Il cron esistente mantiene la cadenza di un minuto con timeout HTTP 60 secondi. Lease atomici e massimo un lavoro fotografico attivo restano invariati.

Un timeout conserva fonti e consumo sconosciuto; non provoca nuove generazioni automatiche. Il messaggio distingue il servizio lento da un formato AI non valido. Un nuovo tentativo resta esplicito.

La riserva preventiva dei nuovi tentativi Gemini è 0,50 USD anche per foto, entro i limiti esistenti di quattro foto/12 MB complessivi e 8.000 token di output. È una stima prudente applicativa, non un massimale garantito sulla fattura. Il tetto mensile resta invariato; nessuna riserva storica incerta viene cancellata o retroattivamente ridotta. I contatori completi sostituiscono la singola riserva col costo stimato.

La modalità asincrona Gemini è stata verificata e scartata: l'API reale richiede `store=true` e rifiuta gli input immagine in background per il modello configurato. Restano richieste sincrone `store=false`; nessuna nuova conservazione remota deliberata o cambio di modello.
