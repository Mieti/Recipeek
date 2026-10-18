# Revisione del flusso AI e coda cloud — 18 ottobre 2026

## Esito

Versione Sites 13 pubblicata, coda cloud configurata e richiamo verificato da Supabase verso il Worker. Le chiavi Gemini/Supadata restano assenti: nessuna importazione reale o a pagamento è stata eseguita.

- GitHub: `f3f925ba7527cf82ffd7d643555a62940a114ccf`.
- Sorgente Sites: `100627b82a015a54c34a941019577603e04c2ac9`.
- Versione: `appgprj_6ad2743d738081919511870b64108e39~appgver_4b9ab9de08f0819196ca9222797a8829`.
- Deployment: `appgdep_6ad4fad2c26481919d798e64211fbfe7`, riuscito, ambiente revisione 3.
- [CI riuscita](https://github.com/Mieti/Recipeek/actions/runs/39147409216), TypeScript e 68 test app riusciti; build produzione riuscita.

## Problemi trovati e corretti

1. **Dipendenza dal browser:** sostituita con selezione server dei lavori D1, avvio breve dopo le mutazioni e richiamo Supabase Cron ogni minuto. Il browser legge solo lo stato.
2. **Duplicazioni e interruzioni:** lease atomici, prossima esecuzione persistente, polling remoto con backoff e massimo due ritentativi. Generazioni con esito sconosciuto non vengono avviate nuovamente. Il recupero del salvataggio rimane idempotente.
3. **Traffico di polling:** endpoint compatto privo di input, fonti e bozza. Download completo solo allo stato terminale; polling meno frequente a scheda nascosta.
4. **Inferenze ridondanti:** trascrizioni già contenute nel testo analizzato non provocano una seconda estrazione. Spazi superflui e parametri di tracciamento comuni vengono normalizzati per deduplicare nello stesso account.
5. **Output e ragionamento:** livello Gemini `low`, citazioni entro 320 caratteri nello schema richiesto e input senza etichette UI. Numeri interi, limiti di array e massimo cinque proposte sono espliciti nel JSON Schema. I contatori assenti restano sconosciuti.
6. **Falsi allarmi ed evidenze:** frazioni miste e Unicode riconosciute, unità confrontate con la fonte. Errori di associazione sono segnalati per revisione e non bastano da soli ad acquisire altro video.
7. **Revisioni incomplete:** applicare una proposta valida non richiede più che l’intera ricetta sia già valida. La validazione completa resta obbligatoria al salvataggio finale.
8. **Dati e risorse:** foto sanificate anche prima dell’invio al modello, proteggendo caricamenti precedenti; due set di foto non vengono elaborati nello stesso batch per contenere memoria/base64. Risposta vuota HTTP 206 gestita come assenza di contenuto.

## Verifiche nuove

Test con SQLite reale: due proprietari, esecutori concorrenti, lavori pronti senza richieste del browser, assenza di chiamate duplicate, endpoint interno protetto, impossibilità di scegliere proprietario/URL nel tick, polling pubblico incapace di eseguire fasi, risposte di avanzamento compatte, backoff dei job remoti, blocco degli avvii ambigui, deduplicazione e ragionamento basso nel payload Gemini.

Produzione senza cookie: GET/POST al percorso interno restituiscono 401 senza token; API AI utente restano 401 con header identità contraffatto e cache `no-store`.

Supabase: job `recipeek-import-queue`, identificativo 1, attivo ogni minuto. Un richiamo eseguito con `pg_net` dal cloud ha restituito HTTP 200, senza timeout, corpo `{"processed":0,"disabled":true}`. Questo dimostra accesso al Worker, autenticazione di servizio e scrittura del heartbeat D1 anche senza browser; `disabled` indica soltanto assenza della chiave Gemini. Il token non è presente nel repository o nel client.

## Limiti

Il risparmio di token e il mantenimento della qualità devono essere misurati con chiamate reali: nessuna percentuale viene attribuita alle ottimizzazioni. Disponibilità dei contenuti social, latenza del modello, fedeltà delle ricette e video richiedono ancora il collaudo con le chiavi. La coda beta richiede servizi cloud disponibili e non offre un SLA di latenza; ogni tick elabora una fase per un massimo di due lavori.
