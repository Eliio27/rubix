# Cube Coach

Cube Coach ist eine Trainings-App für den echten 3×3-Zauberwürfel. Die App zeigt dir Situationen und Algorithmen, gedreht wird am echten Würfel. Der virtuelle 3D-Würfel ist nur eine Hilfsanimation.

- **Lernpfad (Anfängermethode):** Lektionen 0–7, von der Notation bis zu den gelben Kanten, mit Zug-für-Zug-Modus und Pfeil pro Zug
- **Drill:** Leitner-System mit 5 Boxen. Zwei Modi: «Am Würfel» (Setup-Scramble, Selbstbewertung) und «Erkennen» (4 Algorithmen zur Auswahl)
- **Timer:** gedrückt halten, bis die Zeit grün wird, loslassen startet. Optional 15 s Inspektion. Bestzeit, Ø5 und Ø12
- **CFOP-Sets:** PLL (21) und OLL (57) komplett, F2L (41) ist als Struktur vorbereitet. Dazu eine Übersicht aller Fälle mit Fortschrittsfarben
- Läuft komplett offline (Service Worker), ohne CDNs und ohne externe Requests. Der Fortschritt liegt in `localStorage` und lässt sich als JSON exportieren und importieren

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | die ganze App: HTML, CSS und JS inline. Script-Blöcke: `engine`, `render`, `cube3d`, `logic`, `data` (JSON mit Lektionen und Sets), `app` |
| `sw.js` | Service Worker (cache-first), Cache-Version in `CACHE_VERSION` |
| `manifest.webmanifest` | PWA-Manifest |
| `icons/` | `icon.svg`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` |
| `tests/engine.test.js` | Selbsttests für Engine, Daten und Logik |

## Tests

```sh
node tests/engine.test.js
```

Die Tests laden die Script-Blöcke direkt aus `index.html`. Sie prüfen unter anderem:

- Jeder Zug ergibt viermal ausgeführt wieder den Ausgangszustand, und Algorithmus + Inverse ergibt gelöst.
- Parser, Scramble und Superflip verhalten sich korrekt.
- Jedes PLL- und OLL-Alg löst seinen erzeugten Fall und lässt F2L intakt. Alle 21 bzw. 57 Fälle sind verschieden, die OLL-Gruppen passen zum Muster.
- Jeder Fall einer Lektion respektiert den Stand vor der Lektion (zum Beispiel bleibt das Kreuz beim Einsetzen der Ecken erhalten).
- Leitner-Logik, Ø5/Ø12 nach WCA und das Zeitformat stimmen.

Fallbilder werden nie von Hand gezeichnet. Die App wendet den invertierten Algorithmus auf einen gelösten Würfel an und zeichnet das Ergebnis, deshalb passen Bild und Algorithmus garantiert zusammen. Ein neuer Fall braucht darum im `data`-Block nur Name, Algorithmus und Texte.

Farbschema: Gelb oben, Grün vorne, Weiss unten, Orange rechts.

## Deploy auf GitHub Pages

1. Das Repository auf GitHub pushen (die Dateien liegen im Root).
2. Auf GitHub **Settings → Pages** öffnen.
3. Unter **Build and deployment** bei *Source* «Deploy from a branch» wählen, dann den Branch (z. B. `main`) und den Ordner `/ (root)` auswählen und **Save** klicken.
4. Nach ungefähr einer Minute läuft die App unter `https://<benutzer>.github.io/<repo>/`. Alle Pfade sind relativ, deshalb funktioniert sie auch in diesem Unterordner.
5. Auf dem Handy die Seite öffnen und **«Zum Home-Bildschirm hinzufügen»** bzw. **«App installieren»** wählen. Ab dem ersten Laden funktioniert die App offline.

**Updates:** Nach einer Änderung an `index.html` oder an den Icons die Konstante `CACHE_VERSION` in `sw.js` erhöhen (z. B. `cube-coach-v2`). Sonst liefert der Cache weiter die alte Version aus. Der neue Service Worker löscht beim Aktivieren die alten Caches, und die neue Version ist ab dem nächsten Öffnen aktiv.

Lokal testen (der Service Worker braucht `http://`, nicht `file://`):

```sh
npx http-server . -p 8080   # oder: python3 -m http.server 8080
```
