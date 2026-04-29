# 🐋 Torpedo Timmy 2 — Wal-Rettungskommando

Pixel-Retro Side-Scroller. Die Bundeswehr hat geputscht, das Wal-Rettungskommando schleppt Timmy in Richtung Rand der flachen Erde.

## Lokal starten

Wegen des `<canvas>`-Bilderladens muss die Seite über einen kleinen HTTP-Server laufen (nicht per Doppelklick / `file://`):

```bash
# Python 3
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Oder einfach in den `assets/`-Ordner gehen und `index.html` per Live-Server / VS-Code-Extension öffnen.

## GitHub Pages

1. Repo erstellen, alles hochladen
2. Settings → Pages → Branch: `main`, Folder: `/ (root)`
3. Fertig — läuft auf `https://<user>.github.io/<repo>/`

## Assets austauschen

Die `assets/*.png` sind die Spielgrafiken. Wer bessere Alpha-Versionen hat: einfach im
`assets/`-Ordner die gleichnamigen Dateien überschreiben. Das Spiel lädt sie direkt — keine
Code-Änderung nötig.

| Datei | Verwendung |
|---|---|
| `Hintergrund.png` | Scrollender Ozean-Hintergrund (5483×1536) |
| `Wal.png` | Spieler — Wal-Rettungskommando + Timmy |
| `Schlachtkreuzer_MS_Merkel.png` | Mini-Boss (selten, 14 HP) |
| `zdfTraumschiff.png` | Mittlerer Tank (7 HP) |
| `KaptainAhab.png` | Mittel-zäh (5 HP) |
| `Japaner.png` | Mittel (3 HP) |
| `TerroristenBoat.png` | Kanonenfutter (2 HP, schnell) |
| `titanic.png` | Slow tank (8 HP) |

Gegner werden im Spiel automatisch horizontal gespiegelt (face-to-face mit dem Spieler) und
auf 50% verkleinert.

## Steuerung

- ⬆⬇⬅➡ / WASD — Bewegen
- ␣ Leertaste — Torpedo
- Sammle ❤ um Leben aufzufüllen
- 3 Leben, dann lustige Game-Over-Erniedrigung

## Code-Struktur

- `index.html` — Layout, Menü, Game-Over-Modal, CSS
- `game.js` — Komplette Spiellogik (Loop, Update, Render, Input, Audio)
- `assets/` — PNGs (austauschbar)

