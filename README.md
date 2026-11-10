# Mathe-Dorf 🏘️

Ein Rechenspiel für die Grundschule. Auf der Landkarte liegen erhöht kleine
Siedlungen, durch Wege verbunden — Plus-Minus-Hof, Mal-Dorf, Teil-Dorf,
Tausender-Stadt, Marktplatz, Rätsel-Berg und in der Mitte die Schule.
In jeder Siedlung steht für jede Aufgabenart ein Haus. In der Schule liegt der
Lernzettel der nächsten Klassenarbeit; jedes Thema darauf führt direkt zur passenden
Übung. Für gelöste Aufgaben gibt es Sticker, und mit genug Stickern ziehen nach und
nach Tiere auf die Inseln.

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

React 19, TypeScript, Vite.

- `src/App.tsx` — die Spiele und das Umschalten zwischen den Ansichten
- `src/world/` — Karte, Siedlungen, Schule: `games.ts` (alle Spiele), `towns.ts`
  (Inseln als Text-Gitter), `exams.ts` (Lernzettel der Klassenarbeiten), `route.ts`
  (Adressen wie `#/dorf/mal`, damit die Zurück-Taste funktioniert)
- `src/iso/` — zeichnet isometrische Szenen aus Kacheln
- `src/index.css` — Styling

Eine neue Klassenarbeit: Eintrag oben in `src/world/exams.ts` ergänzen.

## Grafik

Die Inseln sind aus [Kenney Sketch Town](https://kenney.nl) gebaut (CC0, siehe
`src/assets/sketchtown/License.txt`). Danke, Kenney!
