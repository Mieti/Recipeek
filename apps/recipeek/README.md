# Recipeek — app

Web app adattiva per smartphone, tablet e desktop. Il primo deploy è privato, con accesso gestito da Sites. I dati personali non vengono inseriti automaticamente: al primo accesso puoi creare una ricetta o aggiungere sei esempi esplicitamente riconoscibili.

## Funzioni

- Ricette manuali: creazione, consultazione, modifica, eliminazione, fonte e appunti.
- Foto di copertina e di ogni passaggio, salvate in R2. JPEG/PNG/WebP, massimo 6 MB; HEIC richiede conversione.
- Ingredienti strutturati, dosi qualitative e dosi parziali assegnate ai passaggi.
- Categorie, modalità di cottura, raccolte, preferiti, ricerca per titolo/ingredienti, filtri e ordinamento.
- Ricalcolo per persone oppure rapporto tra aree delle teglie. I tempi e la temperatura non vengono moltiplicati.
- Cooking: avanti/indietro, media del passaggio, timer, tentativo di mantenere lo schermo acceso, punto di ripresa sullo stesso dispositivo.
- Profilo facoltativamente visibile, follow e ricette condivise con chi ha accesso al sito.
- Backup JSON e import di massimo 100 ricette per file. L’import crea nuove copie private, non sincronizza o deduplica. I file delle foto non sono inclusi.

Le modifiche alle ricette condivise sono riservate al proprietario. Un controllo di revisione evita di sovrascrivere modifiche salvate in un’altra finestra. Non vengono eseguite chiamate AI nell’app.

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
npm run dev -- --hostname 127.0.0.1
```

Apri l’URL locale stampato (normalmente `http://127.0.0.1:5173`). Il login di sviluppo è simulato dal template soltanto su loopback; non viene incluso nel build di produzione. Database locale e ospitato sono distinti.

Con il preview attivo, `node tests/http-smoke.mjs` verifica API reali locali, autenticazione, CSRF, validazione, foto e conflitti di modifica. Crea ed elimina la propria ricetta temporanea; una foto di test resta nell’archivio R2 locale.

## Deploy

Il manifest `.openai/hosting.json` contiene il progetto Sites già registrato e i binding logici `DB`/`BUCKET`. Riusa questo ID; non creare un nuovo sito a ogni pubblicazione. La pubblicazione con la skill Sites sincronizza il sorgente, crea il pacchetto e applica le migrazioni del database ospitato prima del Worker.

Il checkout dedicato usato dal helper di pubblicazione è conservato in `.local/recipeek-site` alla radice del repository. La copia di lavoro ordinaria resta `apps/recipeek`. Le credenziali temporanee di pubblicazione non vanno salvate su disco o nel repository.

Non servono chiavi Gemini/Supadata per questa app. L’autenticazione del sito e i permessi sui record devono restare attivi. Prima di invitare amici occorre concedere loro accesso attraverso le impostazioni del sito: il primo deploy è riservato al proprietario.

## Limiti da conoscere

Questa è la prima versione web, non una build iOS/Android nativa. Accesso iniziale tramite ChatGPT; Apple/Google diretti e distribuzione negli store restano successivi. È necessaria una connessione per caricare il ricettario. Il manifesto web permette l’uso standalone nei browser compatibili, senza garantire funzionalità offline.

La sessione cooking conserva una copia della ricetta e i timer nel browser, sul dispositivo corrente. I timer si basano sull’orologio: possono riprendere il conteggio dopo una pausa, ma su iOS la pagina può essere sospesa e non garantisce avvisi a schermo spento. Non sostituire un timer di sicurezza con quello del browser. Per la sessione contano le dosi selezionate all’avvio; modificare successivamente la ricetta non riscrive la sessione in corso.

Gli elenchi sono limitati a 1.000 ricette e 200 profili. Il nome normalizzato degli ingredienti unifica maiuscole, accenti e spazi; sinonimi e forme alimentari differenti restano distinti. Le immagini rimosse dall’editor o da una ricetta eliminata non vengono ancora ripulite automaticamente da R2: è previsto un futuro processo di raccolta degli oggetti non referenziati. Le note sono incluse quando condividi una ricetta.

L’AI e il relativo benchmark rimangono nel [laboratorio separato](../../tools/import-lab). Le foto importate in questa app sono illustrazioni della ricetta: non vengono analizzate per estrarne testo o ingredienti.

## Verifica

Sei test automatici con SQLite reale coprono privacy, permessi, salvataggio/indice ingredienti, modifiche concorrenti, dosi/teglie, validazione e ricerca. Un test HTTP locale aggiuntivo copre gli endpoint e lo storage foto. La verifica nel browser copre accesso locale, esempi persistenti, ricerca, editor, dosi, timer e ripresa dopo ricaricamento. I provider AI non partecipano a questi test.

Fotografie illustrative da [Unsplash](https://unsplash.com/), distribuite come asset locali: gli URL delle immagini sono documentati in `scripts/download-images.mjs`. Le ricette di esempio sono testi originali di progetto e non pretendono corrispondenza esatta con la foto.
