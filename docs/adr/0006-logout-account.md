# 0006 — Uscita unica dall’account Recipeek

Data: 17 ottobre 2026. Stato: adottata. Completa l’ADR 0005 durante la transizione Sites/Supabase.

## Problema

Il logout era disponibile soltanto in fondo alla pagina account. La sola rimozione della sessione Supabase poteva inoltre consentire il ripiego sull’identità Sites, e le altre schede conservavano la vista precedente.

## Scelta

Il pulsante Esci è visibile nella barra principale e nell’intestazione dell’account. Tutti i pulsanti usano lo stesso endpoint POST `/auth/logout`, con origine obbligatoria e confronto completo di schema/host/porta. Un GET non termina alcuna sessione.

Il server richiede la revoca locale o globale a Supabase, elimina cookie Auth e PKCE e riporta al login. La pulizia locale avviene anche se Auth è indisponibile; l’eventuale mancata uscita dagli altri dispositivi viene comunicata senza dichiarare una revoca globale riuscita. I cookie di un rinnovo eseguito prima del logout vengono scartati.

Un cookie HttpOnly, Secure su HTTPS e SameSite=Lax richiede d’ora in poi l’identità Recipeek e impedisce il ripiego Sites. Dopo logout contiene l’ID della sessione chiusa, se disponibile: una risposta di rinnovo tardiva non può ripristinarla. Il valore è soltanto un criterio di rifiuto; non è una credenziale e non autentica nessuno. L’identità rimane verificata con `getUser`; un nuovo login crea una sessione diversa e può accedere normalmente.

Il logout pulisce bozze, cooking e timer dell’utente locale. Eventi BroadcastChannel/storage aggiornano le altre schede. La superficie privata viene nascosta all’uscita o al pagehide; una pagina ripristinata dalla cronologia ricarica la verifica server. L’app torna direttamente a `/account` quando manca un’identità valida.

La sessione Google e il gate privato dell’hosting sono separati dall’account Recipeek. Il logout Recipeek non richiede l’uscita dall’account Google o da ChatGPT. L’hosting conserva il proprio pubblico privato.

## Verifica

Test automatici per metodo/origine, revoca globale fallita, pulizia durante un rinnovo, barriera contro il ripiego Sites e vecchia sessione, nuovo login e isolamento dei cookie del progetto. Prova con utenti Supabase temporanei e Worker locale: revoca reale dei refresh token, isolamento fra dispositivi/account e nuovo accesso. Browser locale: pulsante visibile, due schede aggiornate al logout e Indietro che resta sulla pagina di accesso. Vedi report del 17 ottobre.
