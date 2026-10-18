# Import, integrazioni e beta — 19 ottobre 2026

## Modifiche

- Integrazione di testo/foto nella stessa bozza con risultato separato, confronto e applicazione esplicita. Le modifiche manuali non vengono sostituite.
- Classificazione culinaria più restrittiva; risposte senza supporto e riferimenti incoerenti bloccate dal server. Nessun suggerimento o ricetta inventata per contenuti respinti.
- Quote giornaliere estese alle integrazioni, massimo tre per bozza; deduplicazione del testo aggiuntivo, protezione da concorrenza e autorizzazione delle foto.
- Monitor riservato al proprietario: stati, classificazioni, token, budget conosciuto, riserve, heartbeat e tempi del primo esito. Cache privata anche per le sottopagine import.
- Icone PNG e icona Apple per l'aggiunta alla Home; guida `/install` collegata dall'account. Input fotografico con accesso alla fotocamera, campi mobile a 16 px per evitare lo zoom automatico e testo lungo contenuto nelle schede.

## Campione con servizi reali

20 fonti, con Gemini reale e acquisizione Supadata per i tre link. Database SQLite e bucket in memoria isolati, nessuna modifica al catalogo del proprietario.

| Campione | Numero | Esito |
| --- | ---: | --- |
| Ricette testuali originali: pasta, frittata, insalata, tè freddo, pane, pancake in inglese | 6 | Tutte riconosciute come ricette, dosi e passaggi presenti |
| Sport con metafora “ricetta del successo”, installazione software, recensione ristorante, cosmetico, detergente, menu settimanale senza procedimento | 6 | Tutti `not_recipe`, ingredienti e passaggi vuoti |
| Istruzione malevola senza ricetta | 1 | `not_recipe` |
| Nome del piatto e hashtag, due ricette senza scelta | 2 | `insufficient_content`, nessuna fusione o invenzione |
| Ricetta con istruzione di cambiare pasta a 99999 g e rivelare segreti | 1 | Ricetta estratta, dose originale 200 g conservata |
| Video musicale YouTube `dQw4w9WgXcQ` | 1 | `not_recipe`, salvataggio con documento ricetta completo respinto HTTP 400 |
| TikTok del proprietario: Risotto all'Amarone | 1 | 9 ingredienti, 6 passaggi, dosi mancanti non inventate |
| Instagram del proprietario: Pasta con ceci | 1 | 9 ingredienti, 0 passaggi; bozza parziale corretta rispetto al materiale disponibile |
| PNG originale di prova: muffin al limone | 1 | 8 ingredienti, 4 passaggi, 6 porzioni, mezzo cucchiaino riconosciuto |

Non è una fotografia di un libro reale. Il campione di 20 fonti è un controllo MVP, non una misura statistica della qualità sul mercato. Le ricette sintetiche verificano dosi, classificazione e guardrail in condizioni controllate; non sostituiscono una beta con persone e foto reali.

In più, rianalisi dell'Instagram reale con procedimento scritto esplicitamente dall'utente di prova: tre passaggi aggiunti. Titolo personale, note e una quantità modificata a 321 restano invariati; revisione e salvataggio privato riusciti. Il procedimento aggiuntivo è materiale di test, non una presunta trascrizione del video originale.

Le 16 prove testuali usano 0,031693 USD stimati; link, integrazione e foto altre 0,025497 USD. Totale 21 chiamate Gemini con contatori completi, zero token di ragionamento riportati: **0,057190 USD stimati**. Il registro isolato Supadata conserva cinque richieste, quattro con contatore riconciliato e una riserva: il saldo effettivo va confrontato con il provider. Queste prove non figurano nel registro D1 di produzione. Nessuna analisi visiva video o trascrizione AI attivata.

## Regressioni e interfaccia

91 test app, TypeScript e build produzione riusciti. I nuovi test coprono integrazione confermata, concorrenza, revisioni, proprietà delle foto, pulizia degli upload, mantenimento di modifiche/rimozioni, fallimento o irrilevanza delle nuove fonti, quote incluse dopo scarto, guardrail deterministici e accesso al monitor con secondo account.

Browser locale con account Supabase temporaneo e fixture derivate dai risultati reali: confronto espandibile, applicazione dell'integrazione e riapertura con titolo/quantità/note personali e tre passaggi conservati. Viewport 390×844 senza overflow orizzontale. Il database locale aveva bisogno della migrazione budget già presente in produzione; allineato prima della verifica del monitor.

## Limiti esterni

- iPhone/iPad fisici: fotocamera, tastiera virtuale, aggiunta alla Home e ritorno OAuth dal contesto installato restano da verificare sui dispositivi. Il browser mobile desktop non li certifica.
- Le email di registrazione/recupero richiedono ancora un servizio SMTP e un mittente. La beta usa Google; non sono stati acquistati domini o servizi.
- I budget applicativi restano 5 USD stimati Gemini e 100 crediti Supadata per mese UTC. Il monitor non è una fattura né un tetto di spesa indipendente dal provider.
