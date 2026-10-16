# Prova di importazione: Instagram, TikTok, siti e foto

Aggiornamento del 16 ottobre 2026. Riccardo ha confermato che le fonti principali sono Instagram e TikTok, seguite da siti e fotografie di pagine di libri. L'import da foto entra quindi nel perimetro iniziale. YouTube resta un'estensione successiva della prova.

## Cosa vogliamo dimostrare

La presenza di concorrenti con import social è un'indicazione concreta di fattibilità. Non dimostra però quale copertura, costo e dipendenza da servizi terzi otterremo nella nostra implementazione. Questa prova serve a misurarli senza anticipare il lavoro sull'intera app.

L'implementazione iniziale usa Supadata per metadati e trascrizione dei social, acquisizione diretta HTML per i siti e Gemini per estrazione strutturata da testo o foto. È una scelta reversibile per il laboratorio, non una decisione definitiva sullo stack mobile.

Fonti ufficiali consultate: [Supadata metadata](https://docs.supadata.ai/get-metadata), [trascrizioni](https://docs.supadata.ai/get-transcript), [prezzi](https://supadata.ai/pricing), [Gemini Interactions](https://ai.google.dev/api/interactions-api), [output strutturato](https://ai.google.dev/gemini-api/docs/structured-output), [immagini](https://ai.google.dev/gemini-api/docs/image-understanding), [prezzi Gemini](https://ai.google.dev/gemini-api/docs/pricing).

## Campione proposto

Prima un controllo minimo con un contenuto per origine, poi **40 casi**, scelti prima di osservare gli esiti:

| Origine | Casi | Varianti da includere |
| --- | ---: | --- |
| Instagram | 12 | Didascalia completa, solo parlato, testo nei frame, carosello, ricetta nei commenti, link non accessibile |
| TikTok | 12 | Parlato chiaro, musica senza parlato, testo sovrapposto, dosi omesse, URL condiviso breve, contenuto non pertinente |
| Siti | 8 | Recipe JSON-LD, HTML senza schema, più ricette, pagina non accessibile |
| Foto | 8 | Pagina singola, due pagine, frazioni e decimali, riflessi, pagina inclinata, due ricette vicine, porzione tagliata |

Usare materiale proprio o appropriato alla prova, evitando informazioni personali nelle immagini. Non inserire copie di libri, foto originali o contenuti importati nel repository pubblico. Conservare il campione e i risultati in `.local/`.

Per ogni caso preparare prima il riferimento umano: quali ingredienti, quantità, porzioni e passaggi sono effettivamente leggibili nella fonte. Se manca una dose anche nel riferimento, il risultato corretto è segnalarla come mancante.

## Procedura

1. Registrare ID, origine, variante e condizioni della fonte in un registro locale; conservare URL o percorso locale dell'immagine.
2. Eseguire l'import e registrare l'ID JSON prodotto. Non sostituire i fallimenti con casi più facili.
3. Distinguere mancata acquisizione, fonte incompleta, errore di estrazione e problema di revisione.
4. Confrontare bozza e riferimento, correggere, classificare lo sforzo, aggiungere note e confermare o rigettare.
5. Controllare il consumo effettivo nei provider. Ripetizioni e fallimenti rientrano nel costo del campione.

Il tempo di correzione del laboratorio misura il tempo trascorso dalla visualizzazione della bozza al salvataggio, comprese eventuali pause: annotarle per non confonderlo con lavoro attivo. La valutazione iniziale predefinita va cambiata quando non corrisponde al risultato.

Registro locale suggerito:

```csv
case_id,origin,variant,reference_location,job_id,acquisition_ok,missing_ingredients,wrong_quantities,invented_details,decision,active_correction_seconds,notes
```

## Misure e criterio proposto per continuare

- **Acquisizione per origine:** contenuti con materiale utilizzabile / tutti i casi provati di quell'origine, compresi quelli non accessibili.
- **Qualità dell'estrazione:** ingredienti omessi, dosi errate e dettagli inventati rispetto al riferimento. Separare l'assenza nella fonte dall'errore del modello.
- **Utilità:** ricette accettate senza correzioni o con correzioni piccole / tutti i tentativi; tempo mediano di correzione.
- **Costo per ricetta accettata:** costo di tutti i tentativi / ricette accettate, con quota degli abbonamenti dichiarata separatamente.
- **Latenza:** tempo fino alla bozza, distinguendo origine e percorso di trascrizione.

Soglia iniziale da discutere dopo il primo campione: almeno 80% di bozze utilizzabili con correzioni piccole sui contenuti accessibili e completi, mediana di correzione sotto 90 secondi, nessuna dose inventata non segnalata osservata nel campione. Non sono risultati raggiunti né una garanzia statistica: riportare sempre anche numero di casi, copertura complessiva e fallimenti per origine. Un buon risultato sui siti non compensa un import Instagram inutilizzabile.

Se caption e trascrizione non bastano sui casi reali, il passo successivo è valutare acquisizione e analisi dei fotogrammi, oppure un recupero tramite screenshot forniti dall'utente. Non allargare la promessa di supporto prima di quella verifica.

## Stato della verifica

- TypeScript e 15 test automatici superati. Test di URL e rete locale, estrazione HTML/JSON-LD, più ricette, schema, riferimenti, foto, gestione risposte provider, revisione e isolamento dell'endpoint locale.
- Browser: esempio senza AI caricato, titolo modificato, conferma umana e salvataggio locale verificati.
- Gemini e Supadata sono simulati nei test: mancano ancora prove con credenziali reali.
- Nessuna misura reale di accuratezza, copertura social, costo o latenza AI disponibile. L'esempio dimostrativo non fa parte del benchmark.

Istruzioni operative nel [README](../../README.md).
