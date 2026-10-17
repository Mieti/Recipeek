# Collaudo beta Recipeek

La versione rimane privata. Non sono stati invitati altri account automaticamente. Questa checklist richiede dispositivi e account del proprietario/tester: una build riuscita non certifica queste prove.

## Già verificato automaticamente

- API con identità locale, autorizzazioni e isolamento in SQLite, body limitati, quote e concorrenza.
- Cestino, ripristino privato, revisione invalidata ed eliminazione definitiva autorizzata.
- Foto conservate per le ricette nel cestino e pulizia dopo il distacco definitivo.
- Bozze incomplete e storage assente/pieno, separazione fra account.
- Archivio con foto collegate a più passaggi, integrità e rifiuto di file troncati/ostili.
- Ripristino ripetuto senza duplicare né sovrascrivere modifiche personali; vecchi JSON supportati.
- Unità di cucina, alias, singolare/plurale e conservazione delle unità precedenti.
- Geometria del viewport e del campo attivo; navigazione laterale con esclusione di scroll, pressioni prolungate e controlli.
- Due account temporanei reali Supabase e cinque ricette sul Worker locale; isolamento, follow, backup e cestino. Dettaglio/cooking delle cinque ricette verificati anche nel browser desktop. Report: [account](2026-10-17-accounts.md).

## Attivazione account autonomi

- [ ] Configurare Custom SMTP e verificare consegna conferma, recupero password e cambio email su due caselle autorizzate.
- [ ] Verificare che l’accesso del proprietario riconosca automaticamente il ricettario esistente con le due identità verificate e la stessa email; controllare ricette/foto dopo il passaggio (ADR 0005).
- [ ] Configurare e collaudare i provider desiderati, comprese callback, rifiuto del consenso e associazione delle identità.
- [ ] Passare alla modalità Supabase e verificare richieste anonime/contraffatte, rinnovo sessione e cambio account su due schede.
- [ ] Dopo il collaudo, autorizzare l’eventuale modifica del pubblico dell’hosting per rendere raggiungibile il login senza il gate ChatGPT.

## Da eseguire su iPhone/iPad

- [ ] Aprire il sito e accedere, sia da Safari sia dal collegamento sulla schermata Home.
- [ ] Scrivere parte di una ricetta, cambiare sezione, chiudere/riaprire la pagina e riprendere la bozza.
- [ ] Aprire la tastiera su titolo, ultimo ingrediente, quantità e procedimento: campo attivo visibile, pannello scorrevole, footer non sovrapposto. Ripetere in orizzontale, su Safari e dalla Home; chiudere la tastiera e verificare il ritorno all’altezza completa.
- [ ] Scegliere cucchiaino, cucchiaio e scoop dal menu; salvare, riaprire e ricalcolare le dosi. Verificare una ricetta precedente con unità personalizzata.
- [ ] Provare JPEG/PNG/WebP, orientamento verticale e file vicino a 6 MB. HEIC richiede conversione.
- [ ] Completare e salvare una ricetta: la relativa bozza deve sparire.
- [ ] Avviare cooking, cambiare dosi, usare due timer, sospendere/riprendere la pagina e controllare i risultati. Gli avvisi a schermo spento non sono garantiti.
- [ ] In cooking toccare i lati per cambiare step, scorrere un procedimento lungo e usare timer/video: solo i tap laterali devono navigare. Il primo/ultimo passaggio non devono uscire dai limiti; l’ultimo richiede «Ho finito». Controllare anche VoiceOver e dimensione testo aumentata.
- [ ] Spostare una ricetta di prova nel cestino, ripristinarla e controllare immagini, ingredienti e visibilità privata.
- [ ] Scaricare un backup ZIP, individuarlo in File, ripristinarlo due volte e verificare il conteggio delle ricette.
- [ ] Provare più parti di backup; simulare un’interruzione del ripristino e ripetere la stessa parte.
- [ ] Uscire dall’account: le bozze locali devono essere rimosse. Cestino e ricette restano sul server.

## Da eseguire con due account reali autorizzati

- [ ] Il secondo account non vede ricette private, cestino o foto private del primo.
- [ ] Una ricetta condivisa è consultabile ma non modificabile dal secondo account.
- [ ] Dopo lo spostamento nel cestino scompare dalla comunità; dopo il ripristino resta privata.
- [ ] Modificare la stessa ricetta da due dispositivi: il salvataggio obsoleto deve essere respinto, lasciando la bozza recuperabile.
- [ ] Importare il backup nell’altro account e controllare foto, dosi, collegamenti e assenza di duplicati al secondo tentativo.

Annotare per ogni problema dispositivo, versione del browser, azione, risultato atteso/ottenuto. Evitare password, cookie e dati personali nei report. Prima di ampliare la beta verificare anche consumi e spazio foto con dati d’uso reali.
