# Recipeek: fattibilità dell'importazione e della beta privata

Ricerca del 16 ottobre 2026. Fonti primarie ufficiali; nessuna chiamata di prova ad API a pagamento o autenticata. Questo documento distingue capacità documentate, vincoli contrattuali e proposte da verificare. Non costituisce una valutazione legale dei singoli contenuti.

## Conclusione operativa

Per uno sviluppatore solo, che parte da uso personale e amici, il progetto è affrontabile restringendo la prima promessa: **trasformare contenuti accessibili in una bozza verificabile e poi aiutare a cucinarla**. L'importazione universale da qualunque social non è una capacità da dare per acquisita. Il rischio principale precede l'LLM: ottenere il contenuto necessario tramite un percorso utilizzabile e mantenerlo disponibile nel tempo.

Prima della UI completa, farei uno spike su contenuti reali. Primo percorso video candidato: URL YouTube tramite l'integrazione documentata di Gemini. Per Instagram e TikTok, una beta può salvare il link e chiedere testo o materiale autorizzato quando non dispone di contenuto sufficiente. Il messaggio deve dichiarare cosa è stato analizzato: descrizione, testo incollato, audio o immagini. Una bozza da sola didascalia non deve presentarsi come analisi del video.

## Matrice per la prima versione

Le priorità e i fallback seguenti sono proposte progettuali, non copertura misurata.

| Origine | Percorso realistico | Promessa della beta | Fallback |
| --- | --- | --- | --- |
| Ricetta manuale o testo incollato | Form e normalizzazione AI facoltativa | Supporto principale | Editor manuale sempre disponibile |
| Sito di ricette accessibile | Estrarre dati `Recipe` strutturati, poi testo utile | Supporto iniziale a domini provati; revisione obbligatoria | Incollare la ricetta; conservare il link |
| URL YouTube pubblico | Input video URL nella Gemini API | Funzione sperimentale dopo spike | Testo fornito dall'utente; link al video originale |
| TikTok pubblico arbitrario | Embed/metadati dove disponibili; acquisizione video da risolvere | Salva-link; bozza soltanto se esiste materiale sufficiente | Incollare didascalia; media propri o autorizzati |
| Reel/post Instagram arbitrario | Accesso da verificare per API e permessi effettivi | Salva-link; nessuna garanzia di analisi completa | Testo o materiale fornito dall'utente |
| Foto/video dell'utente o con autorizzazione | Upload e analisi multimodale | Candidato successivo allo spike; limiti di durata/dimensione | Inserimento manuale |
| Contenuti privati, cancellati, con accesso riservato | Nessun bypass | Non supportati automaticamente | Contenuti che l'utente può legittimamente fornire |

I dati strutturati dei siti di ricette possono già includere ingredienti, porzioni, tempi, categorie, istruzioni `HowToStep` e riferimenti ai media. È opportuno leggerli prima di usare l'LLM; la loro presenza non è una licenza di ripubblicazione. [Google: dati strutturati Recipe](https://developers.google.com/search/docs/appearance/structured-data/recipe).

### YouTube: due percorsi molto diversi

La YouTube Data API non offre un normale download di sottotitoli per qualunque video pubblico: `captions.download` richiede che l'utente abbia il permesso di modificare quel video. [YouTube: captions.download](https://developers.google.com/youtube/data/reference/rest/v3/captions/download).

Le Developer Policies vietano al client API di scaricare, importare o conservare copie audiovisive senza previa approvazione scritta di YouTube, e vietano la riproduzione offline. Un embed consente la visione attraverso il player; non equivale a disponibilità dei byte per una pipeline autonoma. Un downloader non ufficiale non è quindi una soluzione da assumere come base del prodotto. [YouTube Developer Policies, sezione III.E](https://developers.google.com/youtube/terms/developer-policies).

Esiste però un'opzione ufficialmente documentata distinta: **Gemini accetta direttamente URL di video YouTube pubblici**, esclusi privati e non in elenco. La funzione URL è in preview; la pagina la indica senza addebito specifico e avverte che prezzi e limiti possono cambiare. Il campionamento statico predefinito è a un fotogramma al secondo, quindi scritte molto rapide possono sfuggire. Lo spike deve verificare questo percorso, senza costruire un downloader Recipeek e senza promettere accuratezza su tutti i video. [Gemini: video understanding](https://ai.google.dev/gemini-api/docs/video-understanding).

Il supporto tecnico non risolve da solo i diritti su input e output. I termini generali Google richiedono i diritti necessari sui contenuti inviati e disciplinano l'utilizzo dei contenuti ottenuti tramite API. Va verificato il caso concreto prima di un lancio commerciale, soprattutto per immagini, clip e ripubblicazione delle ricette; l'attribuzione da sola non è una licenza. [Google APIs Terms, sezioni 1 e 5](https://developers.google.com/terms).

### TikTok

La Display API è centrata sul creator autorizzato. `/v2/video/query/` verifica che i video richiesti appartengano a quell'utente e restituisce campi quali descrizione, cover ed embed; non documenta un file video scaricabile nei campi di questo endpoint. Non è dunque un motore di analisi per ogni URL che un consumatore salva. [TikTok: Query Videos](https://developers.tiktok.com/docs/en/tiktok-api-v2-video-query).

L'oEmbed pubblico restituisce markup di incorporamento e metadati del video. Può servire a mostrare la fonte; non documenta l'accesso a video o trascrizione per l'analisi. [TikTok: Embed Videos](https://developers.tiktok.com/docs/en/embed-videos).

Le integrazioni API/SDK in modalità Live richiedono revisione, e le linee guida vietano di rimuovere meccanismi di copyright del creator, quali watermark, senza consenso. Un'eventuale API commerciale di estrazione deve essere valutata anche per provenienza, autorizzazioni e continuità, non solo per percentuale di successo. [TikTok: Developer Guidelines](https://developers.tiktok.com/docs/en/our-guidelines-developer-guidelines).

### Instagram

La documentazione pubblicata da Meta nel proprio workspace Postman descrive Instagram API with Instagram Login come API per account professionali, aziende e creator. Quella con Facebook Login esclude gli account consumer. Questo non documenta accesso universale ai Reel di terzi condivisi da un utente ordinario. [Meta: Instagram API](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api), [Meta: Instagram Login](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login).

Le pagine dirette Meta per oEmbed e Meta oEmbed Read hanno restituito errori/429 durante questa ricerca. **Resta da verificare** nel portale sviluppatore il contratto corrente: app review, token, campi effettivamente disponibili, uso consentito oltre la visualizzazione e caching. Non considero quindi verificata una pipeline Instagram completa. Riferimenti da riesaminare: [Instagram oEmbed](https://developers.facebook.com/docs/instagram-platform/oembed/), [Meta oEmbed Read](https://developers.facebook.com/docs/features-reference/meta-oembed-read/).

## Bozza affidabile e modalità cooking

Proposta per Recipeek:

1. Conservare URL, autore quando disponibile e metodo di acquisizione. Per i campi decisivi, memorizzare una prova: estratto testuale oppure timestamp. Separare il valore originale da quello normalizzato e dalla correzione dell'utente.
2. Usare stati distinti per un dato esplicito, un'inferenza e un dato mancante. Una quantità non dichiarata resta mancante: il modello non deve inventare 200 g perché sembrano plausibili. Un punteggio di fiducia generato dal modello non sostituisce la prova.
3. Validare sintassi e contenuto separatamente: JSON valido non significa ricetta corretta. Controllare ingredienti citati negli step, ingredienti mai usati, unità incompatibili, tempi contraddittori e informazioni necessarie assenti.
4. Consentire bozza incompleta, revisione, rigetto e salvataggio solo consapevole. Durante la revisione evidenziare precisamente i campi da confermare, evitando un generico «controlla tutto».
5. Ogni step cooking deve avere testo e ingredienti pertinenti; immagine o video sono opzionali. Se non esiste un media autentico per quello step, mostrare testo, riferimento alla fonte o foto dell'utente. Un'immagine generata non è prova di come il creator abbia eseguito il passaggio.
6. Per i video originali usare link o player ammessi e, dove supportato, timestamp. La conservazione di fotogrammi/clip è un requisito diverso, da validare separatamente.

Per la beta privata eliminerei feed pubblico, follower, commenti e catalogo pubblico. Misurerei prima se gli amici riescono davvero a importare, correggere e cucinare. Eventuale condivisione futura dovrebbe essere esplicita, con libreria privata come default.

## iOS, tablet e distribuzione agli amici

Una Share Extension riceve ciò che l'app sorgente condivide: testo o allegati, inclusi link, immagini e video. **Ricevere un URL non implica ricevere il file multimediale.** Apple documenta l'avvio dell'upload in background e richiede di prepararsi alla terminazione dell'estensione. [Apple: Share Extensions](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html).

App ed estensione possono condividere dati tramite App Groups; gli upload/download con `URLSession` in background richiedono un contenitore condiviso. [Apple: Extension common scenarios](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/ExtensionScenarios.html).

Il sistema decide quando eseguire i task differiti in background. Raccomandazione: l'estensione salva/invia la richiesta, il backend elabora un job persistente, e l'app recupera lo stato al ritorno in primo piano. Una notifica può aiutare, ma non deve essere l'unico modo per recuperare il risultato. Questo va testato su iPhone e iPad reali anche se la UI è cross platform. [Apple: Choosing Background Strategies](https://developer.apple.com/documentation/backgroundtasks/choosing-background-strategies-for-your-app).

Per gli amici, TestFlight prevede tester esterni e revisione della prima build del gruppo. I tester interni sono utenti App Store Connect, non semplicemente amici; ogni build scade dopo 90 giorni. Quindi una beta privata è adatta alla sperimentazione, ma non è distribuzione permanente senza manutenzione. [Apple: TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/).

## Policy e dati da considerare nel progetto

Apple richiede autorizzazione per salvare, convertire o scaricare media di servizi terzi; può chiedere evidenza. Per la condivisione di dati personali con AI di terzi richiede informazione chiara e permesso esplicito. Se in futuro introduciamo contenuti visibili tra utenti, la guideline UGC richiede filtri, segnalazioni, blocco utenti e contatti pubblici. Rinvio del social significa meno prodotto e moderazione da costruire, non un'esenzione generale da privacy o diritti. [Apple App Review Guidelines, 1.2, 5.1.2 e 5.2](https://developer.apple.com/app-store/review/guidelines/).

I termini Gemini indicano che per rendere API Client disponibili a utenti nello SEE, Svizzera o Regno Unito occorre usare Paid Services. Per sviluppatori in queste aree il trattamento dati previsto per Paid Services si applica anche alla quota gratuita; non è corretto trasferire automaticamente alle utenze italiane la regola globale sul free tier usato per migliorare i modelli. Prima della beta configurare e verificare progetto, billing e condizioni effettive. [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms).

Scelte proposte: inviare al modello soltanto il contenuto necessario; evitare credenziali social o dati non utili; scadenza breve per file temporanei; cancellazione di draft, account e relativi file; accesso ai dati separato per utente. Prima di offrire il servizio al pubblico verificare ruoli privacy, contratti dei fornitori, retention e trasferimenti con una valutazione specifica.

## Guardrail tecnici minimi

- **URL fetch:** consentire solo protocolli previsti; impedire accesso a loopback, rete privata e metadati cloud; verificare DNS e ogni redirect; limitare dimensione, tempo e numero di richieste. Le stesse regole valgono per URL di immagini estratti dalle pagine. [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).
- **Contenuto non attendibile:** didascalie, pagine, OCR e trascrizioni sono dati, non istruzioni. Il modello di estrazione non deve poter leggere segreti o avviare azioni esterne; risultato validato e rendering senza HTML arbitrario. I guardrail basati su un altro modello non sostituiscono i controlli deterministici. [OWASP Prompt Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).
- **Job e costi, proposta:** identificativo stabile per import, retry limitati, nessuna doppia bozza/doppio addebito per il medesimo tentativo logico, timeout chiari e quote per utente. Salvare stato di acquisizione separato da stato di generazione, così «URL non accessibile» non diventa «AI ha fallito».

## Spike verificabile prima di investire nella UI

Proposta: 3–5 giornate di lavoro concentrato, esclusi tempi di review dei provider. Non è una stima di completamento dell'app.

Preparare circa 50 esempi autorizzati e rappresentativi: italiano/inglese, didascalia completa/incompleta, parlato/nessun parlato, testo rapido sul video, più ricette nello stesso contenuto, contenuto non culinario, link scaduto/privato. Includere input deliberatamente incompleti e ambigui. Usare la stessa scheda di riferimento compilata a mano per tutti i percorsi.

Misurare separatamente:

- percentuale di contenuti acquisiti per fonte e metodo;
- ingredienti e quantità estratti correttamente quando presenti;
- numero di quantità inventate e campi mancanti riconosciuti;
- correttezza dell'ordine degli step e dei riferimenti alla fonte;
- tempo mediano e p95, costo per tentativo e per bozza accettata, retry;
- tempo reale di correzione dell'utente e percentuale di bozze che decide di salvare.

Il criterio preliminare proposto è ottenere su fonti dichiarate supportate bozze correggibili velocemente, con nessuna quantità inventata silenziosamente nel campione e un fallback comprensibile quando l'acquisizione fallisce. Il risultato serve a decidere quali origini promettere nella beta, non a sostenere accuratezza universale. Per ogni social non supportato, scegliere esplicitamente tra integrazione autorizzata, fornitore da validare o fallback manuale.
