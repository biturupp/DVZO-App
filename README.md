# DVZO-App

Web-App (PWA) des Oldtimerbetriebs DVZO für Fahrgastzählungen, Fahrpläne und Dienstpläne.
Sie läuft im Browser auf iPhone und Android und lässt sich über «Zum Home-Bildschirm» wie eine App installieren.

## Module

| Modul | Inhalt |
| --- | --- |
| Linien (a) | Linien und Haltestellen per Tipp auf die Landeskarte oder per Koordinaten (WGS84, LV95, LV03). Radius pro Haltestelle (Standard 200 m). |
| Fahrpläne (b) | Kurse pro Linie und Richtung, Kopieren im Takt. |
| Dienstplan (c) | Dienste pro Fahrer/in und Fahrzeug mit Linienfahrten, Anfahrt, Pausen, Linienwechsel, Tanken, Putzen und Rückfahrt. Überschneidungen werden markiert. |
| Fahrt (d–f) | Aktueller Dienst, Erinnerung vor jeder Abfahrt (Ton und Vibration), Fahrplanlage in ± Minuten, automatische Haltestellenerkennung per GPS im Radius, Zählung Ein-/Aussteigende nach Erwachsenen und Kindern, «Fahrzeug leeren» am Ende der Strecke. |
| Auswertung | Zählungen nach Linie und Zeitraum, nach Haltestelle und nach Kurs, Export als CSV. |

## Technik

- React 18, TypeScript, Vite, `vite-plugin-pwa` (offlinefähig, installierbar)
- Karte: Leaflet mit der Landeskarte von swisstopo (Kacheln werden für Funklöcher zwischengespeichert)
- Daten: IndexedDB auf dem Gerät (Dexie). Zählungen haben ein `synced`-Feld für die spätere Server-Synchronisation.
- Anmeldung: im Moment lokal mit PIN (Testbetrieb). `src/auth/AuthContext.tsx` ist die einzige Stelle, die für einen Server (z. B. Supabase) ausgetauscht wird.
- Fachlogik ohne Oberfläche in `src/domain/` (GPS-Radius, Fahrplanlage, Besetzung, Erinnerungen), mit Tests.

```
src/
  domain/      Typen und reine Fachlogik (+ Tests)
  data/        lokale Datenbank, Beispieldaten
  auth/        Anmeldung
  features/    drive (Fahrt), lines, timetable, duties, reports
  ui/          Karte, Ton, Meldungen
```

## Entwickeln

```bash
npm install
npm run dev        # Entwicklungsserver
npm test           # Tests
npm run build      # Typprüfung und Produktions-Build nach dist/
```

Zum Testen am Schreibtisch laufen Uhr und GPS simuliert (Bereich «Uhr, GPS und Test-Simulation» in der Fahreransicht).
Mit `VITE_DEFAULT_REALTIME=1` startet die App mit echter Uhrzeit und echtem GPS.

Testzugänge: Disposition 1234, Anna Keller 1111, Marco Brunner 2222. Linien und Koordinaten sind Platzhalter.

## Hinweis zum GPS

Eine Web-App erhält auf dem iPhone nur GPS-Positionen, solange der Bildschirm eingeschaltet ist.
Die App hält den Bildschirm während der Fahrt wach («Ton und Bildschirm aktivieren»).
Falls später Hintergrund-Ortung nötig ist, kann dieselbe App mit Capacitor als App-Store-App verpackt werden.

## Nächste Schritte

1. Server für Anmeldung und gemeinsame Daten (Vorschlag: Supabase, Region Europa) und Synchronisation der Zählungen
2. Echte DVZO-Linien, Haltestellen und Fahrpläne erfassen
3. Hosting der Web-App (z. B. Netlify, Vercel oder GitHub Pages)
