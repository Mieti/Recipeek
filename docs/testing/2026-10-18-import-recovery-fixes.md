# Correzioni import, revisione e budget — 18 ottobre 2026

## Verifiche

- 78 test app passati, TypeScript riuscito; 15 test del laboratorio e relativo TypeScript passati.
- Nuove prove su SQLite reale: recupero dopo scarto, ripetizioni concorrenti idempotenti, autorizzazione di secondo account, massimo due analisi globali/una serie foto, prenotazione della frequenza Supadata, HTTP 429 con Retry-After, bozze incomplete e revisioni obsolete, usage conservato su output invalido/rete incerta, controlli numerici e conversioni, eliminazione facoltativa delle foto sorgente, selezione del testo pertinente, budget atomico e membership beta facoltativa.
- Collaudo browser sul Worker locale con account Supabase temporaneo e bozza esplicitamente sintetica: titolo e porzioni vuoti conservati senza salvataggio manuale, passaggio vuoto persistito, riapertura della bozza dal server, riordino, collegamento ingredienti-step, scelta sui suggerimenti e conferma finale riuscita nel catalogo privato.
- Screenshot locale: `.local/proofs/ai-import-recovery.png`. Account temporaneo, ricetta e import sintetici rimossi al termine. Nessun dato sintetico inserito in produzione.

## Comportamento corretto

Le importazioni fallite si possono riprovare con avviso di costo; reinviare una fonte scartata crea una nuova generazione. I doppi invii ritrovano lo stesso tentativo. Le quote giornaliere contano anche i nuovi tentativi. Il recupero automatico continua a fermarsi quando l'esito della generazione è incerto.

La revisione salva automaticamente anche campi vuoti, con controlli di concorrenza basati sulla revisione e invii serializzati nel client. La ricetta finale richiede ancora validazione completa, porzioni e conferma umana. Durante il salvataggio esplicito i campi sono temporaneamente disabilitati, evitando modifiche che arriverebbero dopo la conferma.

La coda controlla slot globali e cooldown provider nel database. La pagina mostra attese e heartbeat in ritardo. I contatori ricevuti vengono conservati prima di validare la risposta; quelli assenti restano sconosciuti. Il JSON Schema deriva dal contratto Zod con adattamento al sottoinsieme documentato Gemini.

Per ridurre costi, didascalie brevi prive di segnali culinari passano alla trascrizione prima dell'analisi; pagine lunghe privilegiano la sezione ingredienti. La verifica iniziale delle foto controlla proprietà, stato e dimensioni senza preparare inutilmente base64. Dopo il salvataggio si possono rimuovere le foto della fonte, conservando le immagini della ricetta e il periodo di attesa prima della pulizia.

Su richiesta del proprietario di minimizzare le spese, default di budget **5 USD stimati/mese Gemini** e **100 crediti/mese Supadata**, senza acquisto di piani o ricariche. Le riserve sono 0,50 USD per analisi testuale o 2 USD per foto, sostituite dalla stima solo con usage completo; esiti incerti possono quindi sospendere prudentemente nuovi import. Il registro separa output e ragionamento secondo il contratto Interactions. Le tariffe e le riserve richiedono manutenzione; non equivalgono alla fattura o a una garanzia sulle variazioni dei provider.

## Migrazioni e limiti

Migrazioni additive `0006`–`0008`: chiave/generazione con backfill dei lavori esistenti, stato provider, indici e registro budget. Nessuna cancellazione di ricette nella migrazione. ADR: [0010](../adr/0010-recupero-import-e-bozze-incomplete.md).

Le chiavi Gemini/Supadata restano da configurare. Non sono state fatte chiamate AI reali o a pagamento; qualità, copertura social, consumi fatturati e prove iPhone/iPad rimangono da verificare. Il fetch diretto dei siti con JSON-LD è una futura ottimizzazione; il trasporto resta Supadata. Il cron a un minuto mantiene i limiti di latenza della beta.

## Pubblicazione verificata

- Commit GitHub: `0c1fc4d`, [CI riuscita](https://github.com/Mieti/Recipeek/actions/runs/39150909025).
- Sorgente Sites: `af93389b95435b5c22f872d35e5d5cfe80b1486d`.
- Versione **14**: `appgprj_6ad2743d738081919511870b64108e39~appgver_f91e5576d8608191a05b3bf27eda63cc`.
- Deployment riuscito: `appgdep_6ad5052f37f4819182b842b6d04bd094`, ambiente revisione 3, pubblico invariato.
- TypeScript e build produzione riusciti; archivio di distribuzione verificato dal servizio, 255 file.
- Produzione anonima: landing/account HTTP 200; configurazione AI e tick interno senza token HTTP 401; risposte `private, no-store`.
- Supabase Cron ancora attivo; nuovo richiamo cloud dopo la pubblicazione e ultimi esiti HTTP 200 senza timeout, `processed:0, disabled:true` per assenza della chiave Gemini. Nessun acquisto di servizi, piano o ricarica.
- Nessun listener locale residuo sulla porta 5173 al termine del collaudo.
