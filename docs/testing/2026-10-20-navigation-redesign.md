# Verifica redesign Recipeek — 20 ottobre 2026

## Verifiche automatiche

- `npm run typecheck`: superato.
- Test automatici con Node 24.19.0: 97 superati, 0 falliti.
- `node scripts/run-framework.mjs build`: superato.

## Browser locale

Le verifiche sono state eseguite sulla preview locale `/ux-preview` con fixture e API in memoria. Le richieste non configurate e la rete esterna sono bloccate; non sono state chiamate API AI né modificati dati di produzione.

- A 390 px, il pannello Aggiungi misura circa 311 px e offre Manuale/Importa. “Applica” conserva i filtri, mentre Indietro li annulla. L’editor manuale autosalva la bozza.
- A 390×844, l’editor con una ricetta fixture di 24 ingredienti e 16 passaggi mostra le tre sezioni, una aperta alla volta, con una riga ingrediente espansa; `document.scrollWidth` resta 390 px.
- A 390×844, la barra inferiore mobile è visibile. In cottura, `?cook=preview-lasagna`, Avanti passa dal passaggio 1 al 2; Indietro torna a `?recipe=preview-lasagna` e chiude la cottura. Il comando Ricette torna a `?view=recipes` e rimuove `cook` e `recipe`.
- A 768×1024, `?view=friends` apre Amici con persone e ricette condivise; il layout usa tutta la larghezza e non crea overflow orizzontale (`scrollWidth` 753 px).
- A 1280×800, la sidebar resta visibile, la navigazione mobile è nascosta e non c’è overflow orizzontale (`scrollWidth` 1265 px).
- Tu mostra profilo, backup, foto e cestino; il collegamento a identità, sicurezza e logout è `/account`.

La verifica copre il browser locale di sviluppo; non costituisce uno smoke test post-deploy né una verifica su Safari/iOS.
