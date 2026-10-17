# Verifica account unico — 17 ottobre 2026

## Risultati

- Google abilitato nel progetto Recipeek; account del proprietario con identità Google ed email confermata. Verificata la corrispondenza dell’email con il proprietario Sites, senza esporre credenziali nei report.
- Passkey disabilitate in Supabase (`passkey_enabled=false`). Nessun uso di WebAuthn/passkey nel codice Recipeek. La preferenza della schermata di accesso Google è gestita da Google.
- 51 test automatici superati. Nuove prove: più provider con UUID unico e ricettario invariato, migrazione automatica con due identità verificate, email non verificata o diversa, metadati alterabili, conflitti e sessione SDK durante la modalità Sites.
- TypeScript e lint dei componenti di account superati (resta un avviso sulla navigazione completa dopo login, necessaria per ricaricare il contesto server).
- Prova aggiuntiva contro Supabase reale e Worker locale con due utenti sintetici temporanei: stesso profilo prima e dopo l’accesso, tutte e sei le ricette locali invariate, sessione Supabase da sola ancora associata al profilo, secondo account isolato anche in presenza del cookie Sites, cookie Supabase falso respinto con 401, endpoint manuale rimosso e pagina senza pulsante di collegamento.
- Rimossi gli utenti Auth e le associazioni locali della prova; nessuna ricetta di prova o modifica al catalogo ospitato.

## Limiti

L’associazione del profilo reale si applica alla prima nuova richiesta del browser in cui sono presenti le sessioni Google/Supabase e Sites verificate. I test non impersonano il proprietario e non ricreano il consenso OAuth Google. La configurazione Google e l’accesso già riuscito sono stati verificati sul servizio.

SMTP non configurato: la consegna di conferme e recuperi email agli amici rimane da attivare. Apple è disabilitato. La possibilità di aggiungere una password a un account OAuth usa `updateUser` dell’SDK ufficiale; non è stata cambiata alcuna credenziale personale durante la verifica. L’hosting è ancora privato.
