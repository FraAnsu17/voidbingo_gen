# Carousel Generator — Guida al Deploy su Vercel

App React per generare caroselli Instagram: colori personalizzati, font DM Sans,
preview live, download ZIP con le slide 1080×1080px pronte per IG.

---

## Struttura del progetto

```
carousel-app/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    └── App.jsx
```

---

## Come fare il deploy (una volta sola)

### Step 1 — Installa Node.js (se non ce l'hai)
Scarica e installa da https://nodejs.org (versione LTS consigliata).
Verifica con: `node -v`

### Step 2 — Crea un account GitHub (se non ce l'hai)
Vai su https://github.com e registrati gratuitamente.

### Step 3 — Carica il progetto su GitHub

1. Vai su https://github.com/new
2. Nome repo: `carousel-generator` (o quello che vuoi)
3. Lascia tutto il resto di default → clicca **Create repository**
4. Segui le istruzioni per caricare i file. Il modo più semplice:
   - Scarica **GitHub Desktop** da https://desktop.github.com
   - File → Add Local Repository → seleziona la cartella `carousel-app`
   - Scrivi un messaggio nel campo "Summary" (es. "primo upload")
   - Clicca **Commit to main** → poi **Push origin**

### Step 4 — Deploy su Vercel

1. Vai su https://vercel.com e clicca **Sign Up with GitHub**
2. Autorizza Vercel ad accedere ai tuoi repository
3. Clicca **Add New Project**
4. Seleziona il repo `carousel-generator`
5. Vercel rileva automaticamente che è un progetto Vite/React
6. Clicca **Deploy** — aspetta circa 1 minuto

Fatto! Vercel ti darà un URL del tipo:
`https://carousel-generator-xyz.vercel.app`

Questo URL funziona su qualsiasi dispositivo, anche iPhone.

---

## Come aggiornare l'app in futuro

Ogni volta che vuoi modificare qualcosa:
1. Modifica i file in locale
2. Su GitHub Desktop: Commit → Push
3. Vercel fa il rebuild automaticamente in ~1 minuto

---

## Sviluppo locale (opzionale)

Se vuoi vedere l'app in locale prima di pubblicarla:

```bash
# Entra nella cartella
cd carousel-app

# Installa le dipendenze (solo la prima volta)
npm install

# Avvia il server di sviluppo
npm run dev
```

Apri http://localhost:5173 nel browser.

---

## Note tecniche

- **Font:** DM Sans caricato da Google Fonts, disponibile sia nella UI che nel Canvas
  per la generazione delle immagini. Su iPhone/Mac, il sistema userà SF Pro
  tramite `-apple-system` come fallback nativo.
- **Immagini:** generate a 1080×1080px in formato JPEG 95%, formato quadrato
  nativo per i caroselli Instagram.
- **ZIP:** generato interamente in-browser con JSZip, nessun dato viene
  inviato a server esterni.
