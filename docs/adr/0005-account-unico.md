# 0005 — Un account, più metodi di accesso

Data: 17 ottobre 2026. Stato: adottata. Aggiorna l’ADR 0004 su associazione del profilo e transizione Sites.

## Contesto

Riccardo richiede che Google, email/password e gli altri metodi aprano lo stesso account senza un passaggio manuale per collegare ricettari. La precedente modalità Sites continuava a usare l’identità ChatGPT per le API anche dopo un accesso Supabase, rendendo visibile una distinzione che appartiene alla migrazione tecnica.

## Scelta

L’UUID dell’utente Supabase identifica l’account, indipendentemente dal provider. Il collegamento automatico delle identità con la stessa email verificata è gestito da Supabase; provider con indirizzi differenti si possono aggiungere mentre si è autenticati nell’account desiderato. Una password può essere impostata nello stesso account creato con Google.

Durante la transizione, due identità contemporaneamente verificate dal gateway Sites e da Supabase, con lo stesso indirizzo email (solo trim e confronto senza distinzione di maiuscole), vengono associate automaticamente al profilo esistente. L’uguaglianza di un’email inserita in un form o nei metadati modificabili non prova il possesso. Non si rimuovono alias, punti o suffissi dall’indirizzo. Il ricettario mantiene ID, proprietario, immagini, raccolte e collegamenti.

Pagina account e API risolvono lo stesso profilo. Un tentativo di sessione Supabase prevale anche in modalità Sites: credenziali scadute, false o un servizio guasto non fanno accedere silenziosamente con l’identità precedente. Il cambio di account ricarica l’interfaccia e pulisce lo stato locale precedente anche durante la transizione.

Il login porta direttamente al ricettario. Sono rimossi il pulsante e l’endpoint di collegamento manuale dei ricettari. I conflitti con profili già associati a cataloghi distinti vengono bloccati e segnalati: non si uniscono dati di persone diverse o cataloghi esistenti sulla sola base di un indirizzo.

## Verifica e limiti

51 test automatici, inclusi più provider con lo stesso UUID, continuità del catalogo precedente, email non verificata, email differente, metadati contraffatti, conflitti e risoluzione nel contesto Auth del Worker. L’hosting resta privato; SMTP e l’attivazione di Apple restano separati.

Google è abilitato e l’accesso del proprietario risulta con email verificata. `passkey_enabled=false` nel progetto Supabase e nessuna API WebAuthn è usata dall’app: un’eventuale preferenza per passkey nella schermata Google dipende dalle impostazioni di Google.
