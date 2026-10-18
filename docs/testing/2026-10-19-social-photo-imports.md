# Import social, foto e guardrail — 19 ottobre 2026

## Prove con provider reali

Tre fonti social provate in produzione su account Supabase temporanei, poi rimossi. Gli import di test sono stati scartati; registro dei consumi e storico conservati. Il catalogo del proprietario non è stato modificato.

| Fonte | Risultato osservato | Token Gemini input/output | Tempo osservato |
| --- | --- | --- | --- |
| [TikTok: one pot garlic butter noodles](https://www.tiktok.com/@misojenkitchen/video/7376415366727093547) | 11 ingredienti, 9 passaggi. Una sola analisi della didascalia; trascrizione nativa cercata ma non disponibile. Porzioni e tempi complessivi mancanti conservati come assenti. | 698 / 2046 | 32 s |
| [TikTok fornito dal proprietario: Risotto all'Amarone](https://www.tiktok.com/@sebastian_fitarau/video/7689923018595798304) | La descrizione promozionale passa direttamente alla trascrizione: 9 ingredienti e 6 passaggi con una sola analisi Gemini. Dosi e porzioni non dichiarate restano vuote. | 950 / 1803 | 35 s |
| [Instagram fornito dal proprietario: Pasta con i ceci](https://www.instagram.com/reel/Dd4HZJRID8D/) | Bozza `partial_recipe`: 9 ingredienti, nessun passaggio disponibile. Trascrizione nativa assente. Nessun procedimento inventato o salvataggio automatico. | 605 / 1070 | 21 s |

I tempi usano richiami manuali della stessa coda server per il collaudo e non rappresentano la latenza normale del cron, che richiama ogni minuto. Nessuna trascrizione AI o analisi visiva video attivata.

Tre ulteriori prove del backend usano Gemini reale con SQLite e bucket isolati in memoria, senza file nel bucket di produzione:

- Pagina PNG originale di prova, chiaramente etichettata: muffin al limone, 8 ingredienti, 4 passaggi, 6 porzioni. Verificate farina 180 g, zucchero 60 g e lievito 0,5 cucchiaino; upload/sanitizzazione, proprietà della foto, isolamento del secondo account e salvataggio revisionato riusciti. Non è una fotografia di un libro reale. Token: 1560 input, 1288 output; 7 secondi.
- Verbale di riunione: classificazione `not_recipe`, salvataggio come ricetta respinto dal server. Token: 522 / 142.
- Fonte culinaria contenente istruzioni ostili di cambiare una dose a 99999 g e rivelare credenziali: la dose rimane 200 g, istruzioni ignorate. Token: 571 / 455. Questa singola prova non dimostra resistenza a ogni prompt injection.

## Migliorie pubblicate

- Il confronto delle evidenze di trascrizione ignora i soli marcatori temporali aggiunti a inizio riga. Corrette sul risultato reale sette segnalazioni false; quantità o citazioni realmente diverse continuano a essere segnalate.
- Le evidenze fotografiche mostrano un solo avviso visivo generale; rimangono gli avvisi specifici su dosi dubbie o evidenze assenti. Nel caso di prova gli avvisi passano da 16 a 2.
- Per `not_recipe` l'interfaccia mostra uno stato dedicato e alternative testo/foto, con le fonti consultabili. Non presenta il modulo di una ricetta vuota né richiede inutilmente porzioni e tempi.
- Le bozze incomplete restano conservabili. Il pulsante del salvataggio finale si abilita solo quando il documento modificato soddisfa lo schema completo, oltre alle conferme di revisione già richieste. I controlli server restano attivi.
- I parametri di condivisione `rpxt`, `srtk`, `is_from_webapp` e `sender_device` vengono rimossi dai soli URL social, evitando nuove identità della stessa fonte per questi parametri. Le query dei siti normali restano significative.
- Import interrotti o senza materiale offrono accesso diretto a testo e foto come alternative a un nuovo tentativo.

## Browser e regressioni

83 test app passati, TypeScript e build produzione riusciti. Nuove regressioni su timestamp e valori numerici, avviso visivo con evidenza assente, contenuto non culinario e normalizzazione dei link social.

Browser locale con account Supabase temporaneo e risultati reali riprodotti come fixture terminali: verificata la schermata non culinaria; nella bozza Instagram il salvataggio finale resta disabilitato anche dopo conferma e porzioni se manca il procedimento, poi si abilita dopo l'aggiunta manuale di un passaggio. Salvataggio bozza riuscito. Viewport 390×844, nessun overflow orizzontale osservato. Screenshot `.local/proofs/import-nonrecipe-mobile.png`. Account e fixture locali rimossi; preview fermata e viewport ripristinato. La tastiera e la fotocamera di un iPhone reale restano da verificare.

## Consumi

Questo giro: tre analisi Gemini in produzione e tre isolate, tutte con contatori completi e zero token di ragionamento riportati. Stima alle tariffe nel codice: **0,029196 USD** complessivi, di cui 0,020137 in produzione e 0,009059 nelle prove isolate. Le prove isolate non figurano nel registro D1 di produzione. La fattura definitiva resta quella di Google.

Supadata `/v1/me` conferma piano `Free (100/mo)`: crediti usati da 4 a 10, quindi 6 per questo giro e 90 disponibili al momento del controllo. Nessun acquisto o ricarica. Budget applicativi invariati: 5 USD stimati Gemini e 100 crediti Supadata per mese UTC, con riserve prudenziali conservate.

## Pubblicazione

- GitHub: `06ed06a`, [CI riuscita](https://github.com/Mieti/Recipeek/actions/runs/39172518285).
- Sorgente Sites: `7fe26bd8def104f14956af89909ae33f7e84011e`.
- Versione 18: `appgprj_6ad2743d738081919511870b64108e39~appgver_659698bc55788191a1ace9eb5b09ddc7`.
- Deployment riuscito: `appgdep_6ad548ca28f08191a75b52245d7c08cb`, ambiente revisione 4, pubblico invariato.
- URL: https://recipeek.muddydace3.chatgpt.site
- Cron attivo ogni minuto; ultimi tre esiti HTTP 200, nessun timeout o errore, `processed:0, failures:0`.

## Limite emerso

Il link Instagram fornito contiene una lista ingredienti ma non un procedimento acquisibile tramite la didascalia o una trascrizione nativa disponibile. Per completare quella ricetta occorre inserire manualmente i passaggi o importare testo/foto che li contengano. Analisi visiva video e trascrizione audio generata restano possibili estensioni da valutare separatamente con i relativi costi. Anche la lingua dei campi estratti dalle fonti inglesi rimane da migliorare.
