# Glossario Recipeek

- **Ricetta**: documento salvato dall’utente, con ingredienti, dosi originali, porzioni, passaggi, riferimenti e note.
- **Bozza**: ricetta in lavorazione, non ancora confermata nel catalogo. Una **bozza manuale** è conservata automaticamente sul browser corrente; una **bozza AI** proviene dall’importazione, conserva sul server l’estrazione e richiede revisione. Le modifiche nella revisione AI si conservano con “Salva bozza”.
- **Suggerimento AI**: integrazione proposta separatamente dai dati estratti dalla fonte, modificabile e da accettare o scartare esplicitamente. Non rende completa una fonte incompleta.
- **Importazione AI**: processo privato e persistente di acquisizione, estrazione e revisione di una fonte. Privilegia il testo e approfondisce quando necessario; la coda server elabora le fasi anche a browser chiuso e conserva la bozza da revisionare.
- **Cestino**: ricette rimosse dal catalogo ma ancora recuperabili dal proprietario, con le foto conservate. Il ripristino mantiene la ricetta privata; l’eliminazione definitiva non è reversibile.
- **Backup completo**: parte ZIP del ricettario attivo con documenti, foto personali e controlli di integrità. Il precedente backup JSON conserva soltanto documenti e riferimenti.
- **Ingrediente della ricetta**: voce con identificativo, nome, quantità facoltativa e unità. Il nome normalizzato alimenta l’anagrafica personale; non implica un dizionario universale di sinonimi.
- **Passaggio**: istruzione ordinata, con ingredienti collegati e dosi parziali facoltative, foto, riferimento video e timer facoltativi.
- **Raccolta**: etichetta personale per raggruppare ricette, ad esempio “Da provare”. Una ricetta appartiene a una sola raccolta in questa versione.
- **Ricetta privata**: visibile soltanto al proprietario, anche quando il sito sarà condiviso.
- **Ricetta condivisa**: visibile agli utenti che hanno accesso al sito; non equivale a pubblicazione anonima su Internet.
- **Sessione cooking**: consultazione guidata dei passaggi, con fattore di ricalcolo e punto di ripresa conservati sul dispositivo.
- **Account Recipeek**: identità gestita da Supabase Auth, con indirizzo verificato e uno o più metodi di accesso che aprono lo stesso profilo e ricettario. Durante la transizione il profilo Sites viene riconosciuto automaticamente solo con due identità contemporaneamente verificate e lo stesso indirizzo; l’uguaglianza di email non verificata o proveniente da un form non prova il possesso. L’attivazione autonoma è distinta dall’accesso consentito dall’hosting.
- **Fonte**: link, autore, libro o altro riferimento di provenienza. Un riferimento non concede diritti di riutilizzo dei contenuti.
