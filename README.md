# Mathe-Dorf 🏘️

Ein Rechenspiel für die Grundschule. Auf einer Dorfkarte steht für jede Aufgabenart
ein Haus — Plus, Minus, Einmaleins, Division, Zahlenmauer und einiges mehr. Für
gelöste Aufgaben gibt es Sticker, und mit genug Stickern ziehen nach und nach Tiere
ins Dorf ein.

Läuft komplett im Browser. Kein Server, kein Konto, keine Datensammlung — der
Spielstand liegt im `localStorage` des jeweiligen Geräts.

## Entwicklung

```bash
npm install
npm run dev      # Entwicklungsserver
npm run build    # Produktionsbuild nach dist/
npm run lint
```

## Veröffentlichen

Jeder Push auf `main` baut die App und veröffentlicht sie über GitHub Actions auf
GitHub Pages (siehe `.github/workflows/deploy.yml`). Der Basispfad `/mathemagic/`
in `vite.config.ts` muss zum Repository-Namen passen.

## Technik

React 19, TypeScript, Vite. Die gesamte App steckt in `src/App.tsx`, das Styling in
`src/index.css`.
