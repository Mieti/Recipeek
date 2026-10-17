# Landing pubblica — verifica del 17 ottobre 2026

- Home anonima con presentazione di Recipeek e collegamenti alla pagina account.
- Modalità Supabase attiva nel runtime (revisione 2); il gateway ChatGPT non autorizza più da solo le API personali.
- Associazione di migrazione del proprietario configurata con UUID Auth verificato e ID del profilo esistente, dopo confronto dell'identità proprietaria Sites e dell'account Google confermato. Il prossimo login effettivo del proprietario resta da osservare; i test verificano la risoluzione senza sessione Sites, il mantenimento del catalogo e il rifiuto dei conflitti.
- Google disponibile; email/password per accessi esistenti. Registrazione e recupero email nascosti con messaggio esplicito finché SMTP non è collaudato. Apple non configurato.
- 56 test applicativi superati, TypeScript senza errori, collaudo live locale con due account Supabase temporanei, cinque ricette, foto e trasferimento ZIP idempotente superato. Utenti Auth sintetici rimossi.
- Build e CI del cambiamento applicativo riusciti: [run 39054896149](https://github.com/Mieti/Recipeek/actions/runs/39054896149).
- Sorgente Sites `1ece74f4195a284c080e84f03cff731eb1b59709`; versione `appgprj_6ad2743d738081919511870b64108e39~appgver_800bc7c867808191b04b53fed9a20b3a`.
- Controllo sul Worker prima dell'apertura tramite service access ufficiale: home e account 200, otto API personali 401 con no-store anche con header identità contraffatti, logout GET 405.
- Pubblico aggiornato da owner-only a `public`, revisione accessi 2, su richiesta del proprietario. Il primo controllo anonimo restituiva ancora la schermata ChatGPT; dopo la ripubblicazione della stessa versione con il pubblico aggiornato, il controllo completo senza cookie, credenziali o header di service access passa.
- Deploy pubblico riuscito `appgdep_6ad3b3ca24188191b11b8b1cca1f7ccb`, runtime revisione 2.
- Verifica HTTP pubblica: `/` e `/account` 200 senza ChatGPT; nessun contenuto del catalogo nell'HTML anonimo. `/api/me`, `/api/recipes`, community, people, trash, storage, backup e media rispondono 401 con no-store senza sessione; logout GET 405.
- Verifica browser della versione pubblicata: landing, Accedi, pagina account con icona Google e campi email/password, senza gate ChatGPT. Nessun consenso OAuth personale eseguito dall'agente.

URL: https://recipeek.muddydace3.chatgpt.site

Restano SMTP, prova del proprietario dopo il passaggio e collaudo iOS reale come indicato nella checklist beta.
