# 0002 — Quote foto, ciclo di vita e metadati

Data: 17 ottobre 2026. Stato: implementato.

## Scelta

Ogni utente ha 250.000.000 byte e 500 file, comprese prenotazioni e foto inutilizzate. La prenotazione D1 precede la scrittura R2 ed è una singola istruzione condizionale: richieste parallele non possono superare la quota. Il file diventa leggibile/collegabile solo in stato `ready`. Un guasto conserva la prenotazione finché la cancellazione R2 non è confermata.

Le finestre UTC per utente consentono 300 richieste API al minuto e 30 tentativi di upload all’ora. I contatori sono persistenti e atomici in D1; il superamento restituisce 429 e Retry-After. Non sostituiscono protezioni infrastrutturali contro traffico non autenticato o abusi distribuiti.

La pulizia esamina soltanto file dell’utente senza riferimenti in copertine/passaggi, conservati per almeno 24 ore dall’ultimo distacco/caricamento. Ogni upload e il pulsante nelle impostazioni elaborano al massimo 10 file. Prima di cancellare R2, D1 passa il file a `deleting`: trigger sulle ricette impediscono nuovi collegamenti dopo questa transizione, anche fra controllo API e salvataggio. Se il salvataggio precede la transizione, il file referenziato non viene reclamato. Le cancellazioni fallite vengono ritentate. Non viene introdotto un job periodico esterno.

L’editor decodifica la foto nel browser, applica l’orientamento e ricodifica un JPEG con lato massimo 2048 pixel, sfondo bianco per le trasparenze. Il server applica un filtro indipendente dei contenitori JPEG/PNG/WebP statici, limita byte/dimensioni ed elimina metadati personali, commenti, EXIF originale, XMP e profili incorporati. Conserva solo un tag di orientamento ricostruito quando necessario. Il controllo non equivale a decodifica completa o antivirus. Le vecchie foto vengono filtrate anche in lettura; gli originali nel bucket privato non sono riscritti in massa.

## Migrazione e conseguenze

La migrazione 0001 aggiunge colonne con default costanti, tabella rate limit, indici e trigger, senza riscrivere i documenti ricetta. I file precedenti ricevono una stima conservativa di 6 MB, aggiornata alla dimensione R2 alla lettura. Chi è già oltre quota conserva le ricette; nuovi upload richiedono spazio libero.

Un editor rimasto aperto oltre 24 ore con foto mai salvate può doverle caricare nuovamente. Foto ancora presenti in qualunque ricetta dell’utente non vengono cancellate. Le eliminazioni sono definitive; il backup JSON continua a non includere i file foto. La pulizia si basa sull’anagrafica upload: non esegue una scansione globale del bucket per oggetti storici privi di riga D1.

I limiti sono valori iniziali per uso personale/amici. Si potranno aumentare dopo misure di costo e uso reale, senza indebolire prenotazioni e controlli concorrenti.
