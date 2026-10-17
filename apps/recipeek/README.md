# Recipeek — app

Web app adattiva per smartphone, tablet e desktop. Il primo deploy è privato, con accesso gestito da Sites. I dati personali non vengono inseriti automaticamente: al primo accesso puoi creare una ricetta o aggiungere sei esempi esplicitamente riconoscibili.

## Funzioni

- Ricette manuali: creazione, consultazione, modifica, eliminazione, fonte e appunti.
- Foto di copertina e di ogni passaggio, salvate in R2. JPEG/PNG/WebP statiche, massimo 6 MB; HEIC richiede conversione. L’editor applica l’orientamento, ridimensiona a 2048 pixel e converte in JPEG senza metadati personali. Il server filtra i metadati anche sulle foto precedenti.
- Spazio foto personale: 250 MB e 500 file, con contatore nelle impostazioni; 30 upload/ora e 300 richieste API/minuto, in finestre UTC. Quote e contatori persistono in D1.
- Ingredienti strutturati, dosi qualitative e dosi parziali assegnate ai passaggi.
- Categorie, modalità di cottura, raccolte, preferiti, ricerca per titolo/ingredienti, filtri e ordinamento.
- Ricalcolo per persone oppure rapporto tra aree delle teglie. I tempi e la temperatura non vengono moltiplicati.
- Cooking: avanti/indietro, media del passaggio, timer, tentativo di mantenere lo schermo acceso, punto di ripresa sullo stesso dispositivo.
- Profilo facoltativamente visibile, follow e ricette condivise con chi ha accesso al sito.
- Backup JSON e import di massimo 100 ricette per file. L’import crea nuove copie private, non sincronizza o deduplica. I file delle foto non sono inclusi.

Le modifiche alle ricette condivise sono riservate al proprietario. Un controllo di revisione evita di sovrascrivere modifiche salvate in un’altra finestra e un aggiornamento non può ricreare una ricetta eliminata. Non vengono eseguite chiamate AI nell’app.

## Sviluppo locale

Richiede **Node.js 22.13+** (verificato con Node 24), npm e Git per pubblicare.

```powershell
cd apps/recipeek
npm ci
npm run typecheck
npm test
npm run build
```

Per la prima installazione locale, applica le migrazioni in ordine una sola volta:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_odd_midnight.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_bright_elektra.sql
npm run dev -- --host 127.0.0.1
```

Apri l’URL locale stampato (normalmente `http://127.0.0.1:5173`). Il login di sviluppo è simulato dal template soltanto su loopback; non viene incluso nel build di produzione. Database locale e ospitato sono distinti.

Con il preview attivo, `node tests/http-smoke.mjs` verifica API reali locali, autenticazione, CSRF, validazione, foto e conflitti di modifica. Crea ed elimina la propria ricetta temporanea; quattro foto di test restano nell’archivio R2 locale e diventano eliminabili dopo 24 ore. Il contatore orario comprende anche i tentativi non validi: ripetere molti smoke nella stessa ora può restituire 429.

## Deploy

Il manifest `.openai/hosting.json` contiene il progetto Sites già registrato e i binding logici `DB`/`BUCKET`. Riusa questo ID; non creare un nuovo sito a ogni pubblicazione. La pubblicazione con la skill Sites sincronizza il sorgente, crea il pacchetto e applica le migrazioni del database ospitato prima del Worker.

Il checkout dedicato usato dal helper di pubblicazione è conservato in `.local/recipeek-site` alla radice del repository. La copia di lavoro ordinaria resta `apps/recipeek`. Le credenziali temporanee di pubblicazione non vanno salvate su disco o nel repository.

Non servono chiavi Gemini/Supadata per questa app. L’autenticazione del sito e i permessi sui record devono restare attivi. Prima di invitare amici occorre concedere loro accesso attraverso le impostazioni del sito: il primo deploy è riservato al proprietario.

## Limiti da conoscere

Questa è la prima versione web, non una build iOS/Android nativa. Accesso iniziale tramite ChatGPT; Apple/Google diretti e distribuzione negli store restano successivi. È necessaria una connessione per caricare il ricettario. Il manifesto web permette l’uso standalone nei browser compatibili, senza garantire funzionalità offline.

La sessione cooking conserva una copia della ricetta e i timer nel browser, sul dispositivo corrente. I timer si basano sull’orologio: possono riprendere il conteggio dopo una pausa, ma su iOS la pagina può essere sospesa e non garantisce avvisi a schermo spento. Non sostituire un timer di sicurezza con quello del browser. Per la sessione contano le dosi selezionate all’avvio; modificare successivamente la ricetta non riscrive la sessione in corso.

Il ricettario personale ha un limite di 1.000 ricette, applicato anche dal server. La pagina comunitaria mostra fino a 1.000 ricette e 200 profili. Il backup viene suddiviso in parti da massimo 100 ricette e 5 MB, da scaricare e reimportare singolarmente. Un import interrotto segnala quante ricette sono state già aggiunte. Il nome normalizzato degli ingredienti unifica maiuscole, accenti e spazi; sinonimi e forme alimentari differenti restano distinti. Le foto non referenziate sono eliminabili dopo 24 ore dal caricamento o dall’ultimo distacco da una ricetta: pulizia automatica a ogni nuovo upload e pulsante nelle impostazioni, fino a 10 file per richiesta. Non è un job periodico quando l’app è chiusa. I file in eliminazione non possono essere riagganciati. I file precedenti alla migrazione contano prudentemente come 6 MB finché non vengono letti; non vengono eliminate foto collegate per rientrare nella quota. Le note sono incluse quando condividi una ricetta.

L’AI e il relativo benchmark rimangono nel [laboratorio separato](../../tools/import-lab). Le foto importate in questa app sono illustrazioni della ricetta: non vengono analizzate per estrarne testo o ingredienti.

## Verifica

Ventotto test automatici coprono privacy e permessi su ricette e foto, revoca della condivisione, indice ingredienti, modifiche/cancellazioni concorrenti, quote, dosi e teglie, body HTTP limitati durante la lettura, CSRF, backup, storage browser indisponibile e timer. I test del repository usano SQLite reale. I nuovi test coprono anche saturazione delle quote, prenotazioni concorrenti, pulizia con R2 indisponibile, conflitti fra salvataggio e pulizia e filtro metadati nei tre formati. Un test HTTP locale aggiuntivo copre gli endpoint e lo storage foto. Il filtro server valida contenitori e dimensioni (massimo 16 MP/8192 pixel per lato), non è una scansione antivirus né una decodifica completa dei pixel. Dell’EXIF diretto conserva soltanto un nuovo tag di orientamento, necessario per visualizzare correttamente le immagini preesistenti; i dati personali non vengono inviati. Gli originali R2 precedenti non vengono riscritti in massa. La verifica nel browser copre accesso locale, esempi persistenti, ricerca, editor, dosi, timer e ripresa dopo ricaricamento. I provider AI non partecipano a questi test.

Fotografie illustrative da [Unsplash](https://unsplash.com/), distribuite come asset locali: gli URL delle immagini sono documentati in `scripts/download-images.mjs`. Le ricette di esempio sono testi originali di progetto e non pretendono corrispondenza esatta con la foto.

Il controllo sicurezza del 17 ottobre 2026 è documentato nel [report](../../docs/security/2026-10-17-review.md). L’audit npm delle dipendenze di produzione è pulito; la catena di sviluppo ha ancora segnalazioni transitive documentate. Il conteggio npm non sostituisce l’analisi del bundle effettivamente pubblicato. Gli header del Worker impediscono il caching delle risposte personali e limitano referrer, oggetti incorporati e framing esterno.
