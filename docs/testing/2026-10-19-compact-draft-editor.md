# Editor compatto della bozza — 19 ottobre 2026

## Modifica

Il modulo monolitico è sostituito da tre sezioni: Ingredienti, Passaggi e Dettagli. Ingredienti in righe con nome e dose; passaggi in anteprime di due righe. Un solo elemento aperto alla volta; titolo, porzioni, tempi, categoria e note rimangono nella sezione Dettagli. Unità native selezionabili, distinzione tra q.b. e dose assente, riordino esplicito e rimozione annullabile. L'annullamento ripristina l'elemento e i suoi collegamenti compatibili senza sovrascrivere le altre modifiche.

I campi di quantità conservano la stringa durante la digitazione per permettere dosi decimali come 0.5. L'editor aggiorna lo stesso stato RecipeInput della revisione esistente: restano autosalvataggio serializzato, revisione ottimistica e validazione server.

Riferimenti di progettazione consultati: [Apple UI Design Dos and Don'ts](https://developer.apple.com/design/tips/) e [Apple HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout/). Informazioni progressive, controlli touch almeno 44 px, campi da 16 px, sezioni visibili durante lo scorrimento, navigazione non sticky quando il hook del viewport rileva la tastiera.

## Collaudo

Browser locale sul componente effettivo con una pagina temporanea e dati interamente fittizi: 24 ingredienti, nomi lunghi e 16 passaggi. Nessun nuovo account, chiamata LLM o modifica di ricette in produzione.

Verificati cambio sezione, una sola voce aperta, modifica di quantità e unità, q.b., rimozione e annullamento, aggiunta con focus, modifica e riordino del passaggio conservandone l'identificativo, selezione degli ingredienti collegati, conservazione delle modifiche passando tra sezioni, digitazione decimale 0.5, ritorno del focus alla riga dopo “Fatto”.

Viewport 320×740, 390×844 e 768×1024: nessun overflow orizzontale; controlli dell'editor alti almeno 44 px, campi 46 px e caratteri da 16 px. Screenshot di prova `.local/proofs/draft-editor-mobile.png`. Non provati iOS/Safari o tastiera fisica del dispositivo: il viewport desktop non li emula.

La pagina temporanea di collaudo viene rimossa prima della build e della pubblicazione. L'autosalvataggio dell'API è coperto dai test esistenti, mentre la pagina di prova verifica lo stato del componente senza inviare dati al backend.

97 test automatici superati, TypeScript senza errori e build di produzione riuscita. La tabella delle route generata dalla build non contiene la pagina di collaudo. Nessuna nuova dipendenza o modifica a autenticazione, provider e budget.

## Pubblicazione

Versione Sites 23 pubblicata con stato `succeeded` il 19 ottobre 2026 su https://recipeek.muddydace3.chatgpt.site. Sorgente `7e8312cd16bc46fca6221577c0219fbdcaa54d6b`; versione `appgprj_6ad2743d738081919511870b64108e39~appgver_a66d8570eaf88191aa8e6cca7c1920d3`; deployment `appgdep_6ad617e84d688191886e0d76e107ae08`; revisione ambiente 5.

Archivio `.local/recipeek-compact-editor.tar.gz`: SHA256 del file locale `3c47ba74e3ca3d176635bbd7d3db84f6c2cf87c1f5cf89be5ceb2dfe2d10afe4`; hash del contenuto restituito da Sites `0d955788301629b89ba87b5a4a4e4c7bf4db20785e2299da356e0da48b785adc`.
