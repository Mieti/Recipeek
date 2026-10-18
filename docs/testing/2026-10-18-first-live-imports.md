# Prime importazioni reali — 18 ottobre 2026

## Attivazione e correzioni

`GEMINI_API_KEY` e `SUPADATA_API_KEY` trasferite dal file locale ignorato ai segreti Sites, senza riportarne i valori. Ambiente produzione revisione 4. Nessun piano o ricarica acquistato dall'agente.

Le prove hanno trovato e risolto due incompatibilità non emerse con i provider simulati:

- Il runtime Workers rifiuta `redirect: error`. Le chiamate ora usano `manual` e rifiutano le risposte di reindirizzamento prima di seguirle.
- Gemini rifiutava lo schema completo con i suoi `maxItems`. I massimi degli array sono ora istruzioni descrittive al provider, con validazione Zod rigorosa sul server.

La validazione delle evidenze ignora soltanto i delimitatori di enfasi Markdown e riconosce `mins`/`secs`, evitando segnalazioni false su fonti inglesi. Un valore numerico diverso dalla citazione continua a produrre un avviso.

## Prove in produzione

Account Supabase temporanei separati dal proprietario, rimossi al termine. La sola ricetta salvata durante il test è stata eliminata anche dal cestino. Import non salvati scartati; storico e registro dei consumi conservati per audit.

| Fonte | Esito | Chiamate Gemini | Token input/output | Durata osservata |
| --- | --- | --- | --- | --- |
| Testo proprio: pasta al pomodoro | Bozza pronta, 3 ingredienti, 4 passaggi, dosi 200/150/10 e 2 porzioni verificate; revisione esplicita e salvataggio privato riusciti | 1 | 597 / 859 | 11 s |
| [Good Food: Easy pancakes](https://www.bbcgoodfood.com/recipes/easy-pancakes) | Bozza pronta, 7 ingredienti, 5 passaggi, nessun blocco | 1 | 2301 / 1541 | 19 s |
| [YouTube: pasta al pomodoro](https://www.youtube.com/watch?v=hElG67zHSxM) | Descrizione, trascrizione nativa e seconda analisi; 7 ingredienti, 11 passaggi, nessun blocco | 2 | 1261 / 2372 e 5809 / 2337 | 57 s |

I tempi includono richiami manuali autorizzati della stessa coda server per il collaudo. Non rappresentano la latenza normale del cron, che richiama il Worker ogni minuto. Il video non è stato analizzato visivamente: il relativo servizio resta disattivato.

Una seconda acquisizione della pagina web per diagnosticare gli avvisi ha richiesto 2301 token input e 1525 output. La rivalidazione dello stesso risultato con il codice corretto riduce gli avvisi da 9 a 4: sale presente solo nel procedimento, dosi non specificate per limone, zucchero e sale. Nessun blocco. Questa rivalidazione non effettua altre chiamate AI.

## Consumi e limiti

- Supadata `/v1/me`: piano `Free (100/mo)`, 4 crediti usati su 100; 96 disponibili al momento del controllo.
- Cinque analisi Gemini riuscite in produzione: stima totale dal registro **0,041581 USD**, con contatori completi e zero token di ragionamento riportati.
- In aggiunta sono state effettuate brevi chiamate diagnostiche Gemini locali per isolare lo schema rifiutato. Non rientrano nel registro D1; il totale definitivo va verificato in AI Studio.
- Due tentativi iniziali falliti conservano **1 USD di riserve**, distinto dalla spesa stimata conosciuta. Non sono stati ritentati automaticamente né azzerati senza riconciliazione.
- Le risposte Supadata web non espongono il contatore atteso: D1 mantiene un credito riservato per ciascuna delle due acquisizioni. Il consumo aggregato di quattro crediti è confermato direttamente dal provider.
- Default applicativi ancora 5 USD Gemini e 100 crediti Supadata per mese UTC, condivisi fra gli account. Allowlist AI facoltativa non configurata; gli account verificati possono usare la funzionalità entro le quote.
- La sola API key non consente di attestare il limite di spesa impostato nella dashboard Google o la configurazione della ricarica automatica. Questi controlli non sono stati modificati o certificati dall'agente.

## Verifica e pubblicazione

80 test app passati, TypeScript e build produzione riusciti. Test aggiunti per reindirizzamenti e formattazione delle evidenze. Ultimi tre richiami cloud della coda HTTP 200, nessun timeout o errore, `processed:0, failures:0`; cron attivo ogni minuto.

- Commit correzioni GitHub: `f836567`, `e717fcf`, `ab77f69`.
- Sorgente Sites: `0651e265a5ac2c78321fb9736abaf8ff0c7772c1`.
- Versione 17: `appgprj_6ad2743d738081919511870b64108e39~appgver_c922905e75508191a81674b4db525440`.
- Deployment riuscito: `appgdep_6ad5408c3a54819191f1283eabedc369`, revisione ambiente 4.
- URL: https://recipeek.muddydace3.chatgpt.site

## Copertura ancora da estendere

Non sono stati collaudati import reali Instagram/TikTok, fotografie di libri, casi reali di contenuto non culinario o dispositivi iPhone/iPad. Le prove non costituiscono una misura statistica della qualità. La lingua dei campi estratti dalle pagine inglesi non è sempre italiana: va migliorata tenendo distinta la traduzione dalle citazioni originali. La revisione umana della bozza resta necessaria.
