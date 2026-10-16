# Recipeek

Ricettario personale con import assistito da AI e revisione prima del salvataggio. Obiettivo iniziale: uso personale e amici, con possibile evoluzione commerciale.

## Stato attuale

È stata aggiunta la **prima app web completa del flusso manuale**, con database e foto persistenti, editor, catalogo, filtri, dosi, modalità cooking, profili/follow e condivisione esplicita. Il sorgente è in [`apps/recipeek`](apps/recipeek/README.md); il primo deploy usa Sites con accesso privato. Per avvio, test e limiti, leggi il README dell’app. Il modello AI è rinviato alla fase successiva.

**App online:** [Recipeek](https://recipeek.muddydace3.chatgpt.site), accesso privato tramite ChatGPT. Il deploy è stato confermato come riuscito il 16 ottobre 2026; il controllo dal browser ha verificato la schermata di accesso, mentre l’uso autenticato in produzione richiede il login del proprietario. I test funzionali sono stati eseguiti sul database locale.

Le sezioni seguenti riguardano il laboratorio di importazione preparato in precedenza.

Resta disponibile un **laboratorio locale di importazione**, per verificare il passaggio da link, foto o testo a una bozza modificabile. È separato dalla nuova app web e richiede le chiavi AI soltanto per i suoi import reali.

- Instagram/TikTok: integrazione Supadata per didascalia e trascrizione disponibile.
- Siti: lettura HTML, preferendo i dati strutturati `Recipe`; scelta esplicita se ce ne sono più di uno.
- Foto: da 1 a 4 immagini JPEG, PNG o WebP, analizzate direttamente da Gemini. Per HEIC esportare prima in JPEG.
- Testo: incolla una ricetta per provare estrazione e revisione.
- Bozza: ingredienti, dosi, passaggi, riferimenti alla fonte, dati mancanti, conferma o rigetto, esportazione JSON.

**Verificato:** controlli TypeScript, 15 test automatici e modifica/conferma dell'esempio locale nel browser. I provider nei test sono simulati. **Da verificare:** chiamate reali Gemini/Supadata, accuratezza sulle foto e copertura dei social. Non è ancora disponibile una misura di costo o successo su contenuti reali.

## Avvio su Windows

Richiede Node.js 20.17 o successivo e npm.

```powershell
npm ci
# Solo se .env.local non esiste già:
Copy-Item .env.example .env.local
npm run lab
```

Apri [il laboratorio](http://127.0.0.1:4317). **Prova un esempio locale, senza AI** funziona anche senza chiavi e non effettua chiamate esterne.

Per gli import reali, inserisci in `.env.local`:

```dotenv
GEMINI_API_KEY=la_tua_chiave
SUPADATA_API_KEY=la_tua_chiave
GEMINI_MODEL=gemini-3.5-flash-lite
SUPADATA_TRANSCRIPT_MODE=native
```

Le chiavi si creano nei rispettivi servizi: [Google AI Studio](https://aistudio.google.com/apikey) e [Supadata](https://dash.supadata.ai/). Non inserirle nel codice o in GitHub. `.env.local` è ignorato da Git; il server rilegge la configurazione a ogni richiesta. La disponibilità del modello dipende dal progetto/provider; `GEMINI_MODEL` è configurabile.

Gemini serve per tutti gli import reali. Supadata serve solo per i social. Con **Crea bozza**, testo/foto acquisiti vengono inviati a Gemini; gli URL social vengono inviati anche a Supadata. Configura quote e billing nel provider prima delle prove.

## Limiti deliberati del laboratorio

- I social non includono ancora analisi dei fotogrammi o dei commenti. Una ricetta scritta soltanto nel video potrebbe risultare incompleta.
- `native` cerca trascrizioni esistenti. `auto` permette anche trascrizione generata dal provider, con relativo consumo; per durata sconosciuta si torna a `native`. Oltre 3 minuti si usa solo la didascalia. La disponibilità effettiva va misurata.
- Le foto sono limitate a 8 MB ciascuna e 12 MB complessivi. Le pagine mantengono l'ordine selezionato: usare una ricetta per richiesta e controllare l'anteprima.
- Quantità mancanti e `q.b.` restano vuote. Le citazioni e i controlli strutturali aiutano la revisione, ma non garantiscono la correttezza culinaria o dell'OCR.
- Una sola importazione alla volta, massimo 20 tentativi per avvio. È un limite di tentativi, non un tetto monetario. Non vengono effettuati retry automatici delle generazioni.
- Nessun login ai social, aggiramento di blocchi, download dei video o esecuzione JavaScript delle pagine. Alcuni siti non saranno acquisibili.
- Server accessibile solo su `127.0.0.1`: questo strumento non va esposto come servizio pubblico.

## Risultati e costi

I risultati sono salvati in `.local/import-lab/<id>.json`, esclusi da Git. Contengono il testo acquisito, la bozza originale, la revisione umana, tempi, valutazione e consumi quando disponibili. Le immagini originali restano in memoria durante la richiesta e nell'anteprima del browser; non vengono salvate nei JSON. Il testo estratto dalle immagini può invece essere presente nella bozza.

La coda e la schermata non si ripristinano dopo riavvio/ricaricamento; i file già scritti rimangono sul disco. **Esporta JSON** permette di conservare il risultato visibile. Gli esempi sono marcati `demo: true` e vanno esclusi dal benchmark.

Il costo AI mostrato è una stima basata sui token dichiarati per il modello predefinito; con modello diverso o contatori incompleti resta sconosciuto. I crediti Supadata dipendono dagli header ricevuti e possono essere sconosciuti o stimati. In caso di errore il laboratorio potrebbe non registrare tutti i consumi: per il totale usare anche i dashboard dei provider, includendo tentativi falliti e abbonamenti.

## Verifica e prossimi passi

```powershell
npm run check
```

Leggi il [piano di prova](docs/research/2026-10-16-import-spike.md) per il campione e i criteri di valutazione. Il passo successivo è misurare gli import reali e scegliere il percorso affidabile da integrare nell'app mobile.

Ricerca: [prodotto e MVP](docs/research/2026-10-16-recipeek-discovery.md), [mercato](docs/research/2026-10-16-market.md), [fattibilità](docs/research/2026-10-16-import-feasibility.md), [costi](docs/research/2026-10-16-costs.md).
