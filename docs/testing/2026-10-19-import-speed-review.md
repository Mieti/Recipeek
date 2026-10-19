# Import rapido e revisione semplificata — 19 ottobre 2026

## Pubblicazione

Versione Sites 21 pubblicata con esito `succeeded`, audience pubblica invariata e ambiente revisione 5. Commit sorgente Sites `ff9be504bc256c927a48fc1aff57543db79be11e`. URL: https://recipeek.muddydace3.chatgpt.site.

Archivio `.local/recipeek-fast-import.tar.gz`, SHA256 del file locale `33783fb33cd9bcc3df0a5adffe5be541e0da3bda72049bc0eb29f6111636d839`; content hash restituito da Sites `e8aa6e3a8c2ef5f258e005c7f24288a9360432d6c09528b6d9f74f4d2d25957f`. Nessuna migrazione, modifica dei budget o attivazione di nuovi provider.

## Controlli automatici

95 test superati, TypeScript e build produzione completati. I quattro nuovi test coprono concatenazione acquisizione/estrazione nello stesso tick, prosecuzione autenticata concorrente con la coda, rispetto di cooldown e isolamento, trascrizioni assenti/ripetute/404 senza cicli, decisioni finali sui suggerimenti e note personali prive di report automatici. Restano attivi i test precedenti su guardrail, quote, prenotazioni, esiti incerti, foto e isolamento delle ricette.

## Prove con Gemini reale

Una ricetta da testo attraverso la UI locale ha prodotto un'anteprima osservata entro circa 9 secondi: quattro ingredienti, tre passaggi, porzioni e tempi. Il tempo include il riscontro manuale della UI, non è una misura percentile. La successiva modifica di titolo/note e “Conferma e salva” hanno salvato la ricetta privata senza caselle aggiuntive.

Quattro casi aggiuntivi con provider reale e database isolato: pane (7 s, ingredienti e tre passaggi), cosmetico (3 s, `not_recipe`), solo titolo culinario (3 s, `insufficient_content`), ricetta con istruzioni ostili (5 s, ricetta mantenuta con dose originale di 200 g). Zero fallimenti; costo Gemini stimato del solo insieme di quattro chiamate: 0,008363 USD. Il loro registro isolato non confluisce nel budget D1 di produzione.

## Prove sui link dell'utente in produzione

Account temporaneo separato dal proprietario. Il driver usa l'azione autenticata `continue` senza invocare manualmente l'endpoint interno della coda; la normale coda cloud resta attiva.

| Fonte | Tempo osservato | Esito | Chiamate Gemini | Token input/output |
| --- | ---: | --- | ---: | ---: |
| TikTok, Sebastian Fitarau, `7689923018595798304` | 28 s | Ricetta, 8 ingredienti, 6 passaggi | 1 | 1348 / 1390 |
| Instagram, `Dd4HZJRID8D` | 23 s | Parziale, 9 ingredienti, procedimento assente | 1 | 1003 / 1025 |

TikTok usa due crediti Supadata riconciliati; Instagram mantiene il conteggio sconosciuto quando il provider omette l'header. Nessun costo incerto viene trasformato in zero. I tempi comprendono rete, autenticazione, acquisizione e analisi; sono singole osservazioni, non un confronto controllato con la versione precedente né una promessa di SLA. Resta possibile latenza maggiore durante cooldown, congestione o sospensione della pagina.

Confronto qualitativo TikTok: il burro iniziale e quello di mantecatura sono un'unica voce nell'elenco, entrambi presenti nel procedimento; preservati riposo di due minuti, brodo caldo, evaporazione e mantecatura. Le dosi non dette dalla fonte rimangono assenti. La ricetta di prova viene salvata privata con le sole note inserite nel payload. Instagram non inventa il procedimento mancante e non effettua una seconda chiamata Gemini per colmare artificialmente la fonte.

## Interfaccia

Verifiche via browser a 390 × 844 e 768 × 1024, senza overflow orizzontale. Anteprima leggibile, modulo chiuso, salvataggio con una conferma, porzioni mancanti editabili anche a due cifre, bozza senza procedimento non salvabile, fonti chiuse in fondo. Il report espanso distingue citazioni riscontrate nel testo da interpretazione delle dosi. Screenshot locale `.local/proofs/import-simple-mobile.png`.

Non sono stati testati tastiera fisica iOS o fotocamera in questo giro. Nessuna riduzione del controllo semantico è deducibile dalla sola brevità del prompt: il piccolo campione conferma i casi provati, non garantisce assenza universale di errori.

## Dati temporanei

La revisione automatica ha richiesto consenso esplicito per eliminare l'account temporaneo e i dati di produzione. Il collaudo è stato completato conservandoli, senza riutilizzare account reali: due import e una ricetta privata `TEST AI · Import rapido`. La richiesta di pulizia è stata presentata all'utente separatamente dalla pubblicazione.
