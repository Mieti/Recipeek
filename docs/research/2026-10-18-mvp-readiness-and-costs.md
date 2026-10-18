# Recipeek: seconda analisi MVP e costi per meno di 10 persone

Data: 18 ottobre 2026. Revisione del codice `4c46040`, applicazione pubblicata Sites v13. Questa è un'analisi: i problemi sotto non sono stati corretti o distribuiti in questo giro.

Aggiornamento successivo: le correzioni e i nuovi controlli sono documentati nel [collaudo del seguito](../testing/2026-10-18-import-recovery-fixes.md). Le stime economiche sotto restano scenari, non consumi misurati.

## Esito e prove

La base del ricettario è adatta a una beta personale; il flusso AI richiede ancora alcune correzioni e collaudo reale prima di considerarlo pronto per gli amici. Non serve una riscrittura dell'architettura per questo volume.

- Rieseguiti TypeScript e tutti i **68 test app**: passati. Comprendono isolamento, logout, cinque ricette, follow, foto, backup, guardrail e coda con provider simulati.
- Sei riproduzioni aggiuntive su SQLite in memoria confermano i problemi sotto. Script locale ignorato: `.local/mvp-import-audit.mts`; nessun servizio AI chiamato, nessuna modifica ai dati reali.
- Verifica Sites corrente: pubblico, attivo, versione 13. Ambiente revisione 3, chiavi Gemini/Supadata ancora assenti.
- Verifica Supabase corrente: cron `recipeek-import-queue` attivo ogni minuto; ultime tre risposte HTTP 200, senza timeout, `processed:0, disabled:true`. Il richiamo funziona; l'AI rimane disabilitata per configurazione assente.
- Nessuna nuova prova su iPhone, import reale o misura dei token fatturati. I precedenti collaudi browser restano documentati separatamente.

## Correzioni prima della beta AI

| Priorità | Riscontro concreto | Impatto e intervento |
| --- | --- | --- |
| P1 | Dopo `discard`, ripresentare lo stesso testo restituisce lo stesso job `discarded`; dopo un errore restituisce lo stesso job `failed`. L'hash determina per sempre l'identità del lavoro. | Consentire un nuovo tentativo esplicito con un nuovo identificativo, mantenendo deduplicazione di lavori attivi e protezione dagli esiti di pagamento incerti. Non trasformare ogni doppio tap in una nuova chiamata. |
| P1 | Un HTTP 429 durante acquisizione viene convertito in errore generico e termina il lavoro; `Retry-After` non viene conservato. Riproduzione: `failed`, zero retry. Due tick sfalsati hanno inoltre prodotto **4 chiamate simultanee**. | Il limite di due è per richiamo, non globale. Introdurre prenotazione atomica di slot e frequenza per provider, valida fra istanze, più gestione specifica dei rifiuti temporanei. Supadata Free ammette 1 richiesta/s; anche due richieste contemporanee possono essere eccessive. Riconciliare esiti ambigui senza riavviare alla cieca generazioni a pagamento. |
| P1 | `Salva bozza` richiede porzioni e ricetta già valida, sia nell'interfaccia sia sul server. Una revisione senza porzioni viene rifiutata. | Separare schema della bozza incompleta da schema della ricetta finale. Conservare automaticamente le modifiche con revisione concorrente, distinguendo salvataggio in corso/riuscito/fallito e avvisando prima di uscire con modifiche non persistite. |
| P1 | Con fonte «Per 2 persone / Cottura 10 minuti», una risposta con **99 porzioni e 900 minuti**, ma le citazioni originali, non produce avvisi. | Verificare valore, unità e conversione dei tempi e delle porzioni; mantenere comunque la conferma umana. Il controllo della presenza di una citazione non verifica il significato del dato. |
| P2, prima di misurare i costi | Una risposta con usage e JSON/schema non valido termina `failed` con `usage:[]`. Il provider può aver fatturato. | Registrare tentativo, contatori disponibili ed esito prima della validazione del contenuto. Esiti senza usage rimangono sconosciuti con riserva prudenziale. Non sommare due volte eventuali token di ragionamento già inclusi nei contatori del provider. |

Riferimenti al codice esaminato: `ai-import-service.ts:93` (deduplicazione), `:105` (review), `:168` (retry); `ai-import-queue.ts:11` e `:14` (selezione/concorrenza); `sites-worker.ts:32` (kickoff dopo POST); `ai-import-model.ts:62` (tempi/porzioni); `ai-import-provider.ts:23` e `:42` (errori/usage); `app/import/panel.tsx:56` e `:69` (salvataggio bozza).

La concorrenza globale mancante riguarda anche la protezione di memoria per i set di foto: la selezione di una foto per batch non limita batch sovrapposti. Non è stata osservata una saturazione reale; il test ha verificato quattro chiamate testuali concorrenti, non un carico di immagini.

## Migliorie funzionali ed efficienza

1. **Stato della coda comprensibile.** Mostrare attesa, analisi, ritardo e ultimo contatto del servizio. Il backend già espone `lastTick`, ma la UI non lo usa. Un tick elabora una fase: descrizione e analisi richiedono due fasi; con trascrizione almeno quattro, eventualmente altre attese. A browser chiuso la cadenza di un minuto può tradursi in diversi minuti, senza implicare un guasto. Valutare più fasi brevi nello stesso budget temporale solo dopo aver misurato latenze reali; non aumentare semplicemente i timeout del Worker.
2. **Revisione completa prima del cooking.** La UI consente aggiunta e modifica di step, ma mancano eliminazione/riordino e modifica delle associazioni ingrediente-step. Gli ingredienti aggiunti dall'utente non vengono associati agli step; i nuovi step nascono con lista ingredienti vuota. Servono questi controlli per rendere utile il focus durante la cucina. Anche la distinzione fra dose assente e q.b. merita un controllo esplicito, oltre al placeholder.
3. **Testo pertinente prima della prima inferenza.** Oggi una didascalia non vuota, anche solo promozionale, può avviare Gemini prima di cercare la trascrizione. Una verifica deterministica prudente può acquisire prima la trascrizione quando il testo è chiaramente privo di istruzioni, senza aggiungere una seconda chiamata LLM di classificazione. Didascalie brevi ma complete devono continuare a funzionare.
4. **Siti: prima contenuto strutturato.** Un futuro percorso Recipe JSON-LD con fetch/redirect/DNS sicuri può ridurre rumore e dipendenza dall'acquisizione a pagamento. Oggi il Markdown viene tagliato ai primi 24.000 caratteri: in pagine lunghe la ricetta può trovarsi oltre il taglio. Selezionare sezioni pertinenti prima di troncare, conservando riferimenti verificabili. È un miglioramento successivo ai bug, non un invito a introdurre fetch arbitrari non protetti.
5. **Schema di generazione e schema del server coerenti.** Il JSON Schema inviato al modello è meno restrittivo di Zod su quantità, identificativi e alcune dimensioni. Generarli da una definizione condivisa e testare gli stessi casi limite evita risposte formalmente accettabili dal provider ma scartate dall'app.
6. **Foto: meno lavoro e gestione delle fonti.** `photosFor` legge/sanifica/base64 anche alla creazione, dove il risultato viene scartato, poi ripete il lavoro nell'analisi. Separare verifica di proprietà/stato/dimensione dalla preparazione del payload. Le pagine dei libri rimangono collegate anche agli import salvati; prevedere una scelta esplicita per rimuovere il materiale sorgente, senza toccare foto della ricetta. Le quote attuali sono 250 MB e 500 foto per account.
7. **Budget mensile reale.** Le quote attuali sono 10 nuovi import/giorno/account e 100 globali/giorno; non sono un plafond in denaro. Nove persone al massimo individuale fanno 2.700 import/mese. Per la beta, assegnare l'AI a tester autorizzati, riservare budget prima delle chiamate e riconciliare a fine tentativo. Il sito pubblico e un login valido non limitano automaticamente l'accesso a dieci amici.

Per questo volume manterrei il modello corrente finché non abbiamo un campione reale. Risparmiare una frazione di centesimo con un modello peggiore può far aumentare correzioni e abbandoni. Misurare costo per **bozza accettata**, non solo token per richiesta. La cache condivisa fra utenti e un secondo modello che revisiona sempre ogni risultato aggiungerebbero complessità non ancora giustificata.

## Ipotesi economiche

Stime in USD, imposte e conversione della carta escluse. Prezzi consultati il 18 ottobre 2026. Nessun piano acquistato. Il tempo di sviluppo di Riccardo, eventuali abbonamenti per lo sviluppo e l'hardware non sono conteggiati come costo API.

Modello esistente: Gemini 3.8 Flash. Standard: **$0,75/M input**, **$3,75/M output incluso ragionamento** fino al 31 dicembre 2026; listino annunciato doppio dal 1 gennaio 2027. Fonte: [Google pricing](https://ai.google.dev/gemini-api/docs/pricing).

Esempio di calcolo, non telemetria: 6.000 input e 3.000 output fatturabili per analisi costano $0,01575. Ipotesi mix: 70% social, 20% foto, 10% siti; il 40% dei social richiede una seconda analisi con trascrizione. Risultano 1,28 analisi e circa 1,08 crediti di acquisizione per import. Costo centrale AI circa **$0,020/import**; intervallo di pianificazione **$0,01–0,04/import**, non tetto garantito. Nessuno sconto da cache ipotizzato. Output lunghi, più immagini ed errori fatturati possono alzare il costo.

Supadata: **Free 100 crediti/mese**, **Basic 300 crediti a $60/anno anticipati** (equivalente $5/mese), **Pro 3.000 crediti a $17/mese**. Acquisizione web/metadata e trascrizione nativa: stimare 1 credito ciascuna; approfondimento video 5 crediti/minuto, minimo 5. Il video non entra negli scenari e rimane disabilitato. Ricarica automatica esclusa. Fonte: [Supadata pricing](https://supadata.ai/pricing).

| Utilizzo mensile | Import | Crediti Supadata stimati | Piano di esempio | Gemini stimato | Totale AI + acquisizione |
| --- | ---: | ---: | --- | ---: | ---: |
| 5 persone × 10 | 50 | 54 | Free | $0,50–2 | **$0,50–2/mese** |
| 8 persone × 25 | 200 | 216 | Basic | $2–8 | **$7–13/mese equivalenti** |
| 9 persone × 60 | 540 | 584 | Pro | $5,40–21,60 | **$22,40–38,60/mese** |

Nel caso centrale di 200 import, AI circa $4 e acquisizione equivalente $5: circa **$9/mese**. Se si preferisce evitare l'anticipo annuale, Pro porta lo stesso scenario a **$19–25/mese**. La riga Free presuppone la correzione del limite di frequenza descritta sopra. Un cambiamento del mix può superare i 300 crediti Basic anche con 200 import.

## Altri costi del MVP

- **Supabase Auth e cron:** Free basta per meno di dieci utenti a livello di quote; Pro parte da **$25/mese** per l'organizzazione con un progetto Micro coperto. Eventuali ulteriori progetti attivi dell'organizzazione possono aggiungere compute: non trasferire indiscriminatamente tutti i progetti al piano pagato. Free può essere sospeso per scarsa attività: il cron non costituisce garanzia di disponibilità. [Prezzi](https://supabase.com/pricing), [compute](https://supabase.com/docs/guides/platform/billing-faq), [pause](https://supabase.com/docs/guides/platform/free-project-pausing).
- **Email transazionali:** un piano come Resend Free comprende 3.000 email/mese e 100/giorno, sufficienti per questo gruppo. Serve un dominio mittente verificato per l'uso reale; SMTP non è ancora configurato in Recipeek. Google login permette una prima beta senza dipendere dalle email di registrazione. [Prezzi Resend](https://resend.com/pricing), [domini](https://resend.com/docs/dashboard/domains/introduction).
- **Dominio:** facoltativo per il link attuale, utile per email e identità. Budget indicativo **$12–25/anno** per un nome ordinario, da confermare su nome/TLD scelti; non implica disponibilità di `recipeek.com`. Il listino .com ordinario consultato è $11,08. [Porkbun](https://porkbun.com/products/domains).
- **Hosting attuale Sites:** il tool conferma deployment gestito, ma non fornisce la fattura o un listino attribuibile a questo account. Non considero automaticamente gratuito né sommo un immaginario abbonamento Cloudflare. Indichiamo con **H** l'eventuale costo incrementale dell'hosting/piano esistente, da verificare sulla fatturazione.
- **Alternativa indipendente, non attivata:** un proprio Worker Paid parte da circa **$5/mese**. D1 ha 5 GB inclusi; R2 Standard 10 GB-mese gratuiti con quote operative. Con nove account al limite applicativo le foto arrivano al massimo a circa 2,25 GB, oltre a eventuali oggetti residui: il volume previsto è piccolo, ma le tariffe Cloudflare dirette non sono una fattura Sites. Una migrazione richiede lavoro e verifica dei dati. [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), [R2](https://developers.cloudflare.com/r2/pricing/).
- **Distribuzione:** il budget riguarda la web app da Safari/Home, non una nuova app nativa o pubblicazione sugli store.

Per condividere Gemini con utenti in Italia il piano assume Paid Services, come richiesto dai [termini Gemini](https://ai.google.dev/gemini-api/terms). Per nuovi account il billing può richiedere almeno **$5 di credito anticipato**: è credito consumabile, non un abbonamento mensile aggiuntivo. I controlli di spesa del provider possono avere ritardo; restano utili limiti nell'app. [Billing Gemini](https://ai.google.dev/gemini-api/docs/billing).

**Budget operativo consigliato per 8 persone/200 import:** circa **$10–15/mese + H**, includendo dominio ammortizzato e un piccolo margine, Supabase Free e Supadata Basic. Con un solo progetto Supabase Pro: **$35–40/mese + H**. Il margine non sostituisce un limite di spesa. Al listino Gemini annunciato per gennaio la componente AI raddoppia, non l'intero totale.

**Esborso iniziale:** per una prova fino ai crediti Free Supadata, $5–10 di credito Gemini, più eventuale dominio. Se si sceglie già Basic e un dominio ordinario: indicativamente **$77–95** ($60 annuali + $5–10 credito + $12–25 dominio), oltre H. Il credito Gemini include i primi consumi, non va ricontato come costo di attivazione. Per il primo trimestre dello scenario 200 import: riserva prudente **$90–120 + 3H**, con l'annualità Basic già pagata, dominio e prove aggiuntive; aggiungere circa $75 per tre mesi Pro con un solo progetto. Queste sono riserve di cassa, diverse dal costo mensile equivalente.

## Criterio di apertura della beta

Prima correggere recupero/errori, limiti globali, bozze incomplete, controlli numerici e contabilizzazione; poi attivare le chiavi con budget e video disabilitato. Collaudare almeno **30 fonti reali**: 10 Instagram, 10 TikTok, 5 siti, 5 foto di libri, con esempi completi/incompleti e dosi frazionarie. Aggiungere test di rate limit, contenuto privato/rimosso, connessione interrotta, chiusura browser e due account contemporanei.

Registrare successo di acquisizione separato da qualità della bozza, errori critici, durata, correzioni e costo per ricetta salvata. Verificare su iPhone foto, tastiera, riapertura della bozza e cooking. Una beta controllata può partire con Google login; se si promette anche email/password va prima completato SMTP e provato il recupero password. Restano da completare le verifiche operative di backup e ripristino della configurazione server, oltre all'export del ricettario già disponibile.
