# Supabase einrichten (einmalig)

1. **Tabellen anlegen:** In Supabase links **SQL Editor** → «New query». Den ganzen Inhalt von
   [`migrations/20261101000000_init.sql`](migrations/20261101000000_init.sql) hineinkopieren und **Run** klicken.
   Ergebnis: «Success. No rows returned».

2. **Eigenes Konto anlegen:** **Authentication → Users → Add user → Create new user**.
   E-Mail und Passwort eingeben, «Auto Confirm User» anhaken.

3. **Sich selbst zur Disposition machen:** Im SQL Editor eine neue Abfrage öffnen («+» / «New query»), Folgendes einfügen, E-Mail anpassen, **Run**. Ergebnis: «1 row affected».

   ```sql
   insert into public.profiles (id, name, role)
   select id, 'Beat', 'admin' from auth.users where email = 'deine@email.ch'
   on conflict (id) do update set role = 'admin', name = excluded.name;
   ```

4. **Adresse der App eintragen** (sobald Netlify läuft): **Authentication → URL Configuration**,
   bei «Site URL» die Netlify-Adresse eintragen, z. B. `https://dvzo-app.netlify.app`.
   Sonst führen Einladungs- und Passwort-Links ins Leere.

5. **Benutzer einladen:** in der App unter **Administration → Benutzerverwaltung** (siehe unten).
   Sie bekommen eine E-Mail, legen ihr Passwort fest und erscheinen danach im Dienstplan.

## Zugriffsregeln

| Wer | darf |
| --- | --- |
| Administration (`admin`) | alles, inklusive Benutzerverwaltung |
| Disposition (`dispo`) | Linien, Fahrpläne, Fahrzeuge, Dienstpläne und alle Zählungen lesen und bearbeiten; Sofortnachrichten senden |
| Fahrer/in (`fahrer`) | Linien, Fahrpläne, Fahrzeuge lesen; eigene Dienste lesen; auf eigenen Diensten zählen; eigene Zählungen vom selben Tag löschen |

## Benutzerverwaltung in der App (einmalig einrichten)

Anlegen, Einladen und Löschen von Konten braucht den geheimen **service_role**-Schlüssel von Supabase.
Er gehört nur in Netlify, nie in den Code, in eine Nachricht oder an andere Personen.

1. In Supabase: **Project Settings → API Keys**. Den **service_role**-Schlüssel (bzw. «secret key») kopieren.
2. In Netlify: **Project configuration → Environment variables → Add a variable**.
   - Key: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: den kopierten Schlüssel einfügen, «Contains secret values» anhaken
   - Scopes: mindestens **Functions**
3. In Netlify: **Deploys → Trigger deploy → Deploy project**, damit die Funktion den Schlüssel erhält.

**E-Mail-Versand:** Ohne eigenen Versand verschickt Supabase nur an Mitglieder des Supabase-Teams und
nur wenige E-Mails pro Stunde. Für echte Einladungen unter **Authentication → Emails → SMTP Settings**
einen Versand einrichten (z. B. ein E-Mail-Konto des Vereins oder einen Dienst wie Brevo oder Resend).
Unter **Authentication → Emails → Templates** lassen sich die Texte der Einladung («Invite user») und
des Passwort-Links («Reset password») auf Deutsch anpassen.

## Spätere Änderungen an der Datenbank

Neue Dateien in `migrations/` jeweils einmal im SQL Editor ausführen (neue Abfrage, Inhalt einfügen, **Run**),
und zwar **bevor** die zugehörige Änderung gemergt wird. Bisher:

| Datei | Inhalt |
| --- | --- |
| `20261101000000_init.sql` | Grundschema |
| `20261101200000_ankunftszeiten.sql` | Ankunftszeiten pro Haltestelle |
| `20261101210000_fahrtag_intervalle.sql` | Fahrtag-Intervalle, Kursnummer und Intervall pro Kurs |
| `20261102000000_rollen_nachrichten.sql` | Rollen Fahrer/in, Disposition, Administration; Sofortnachrichten |
| `20261102100000_fahrzeuge.sql` | Fahrzeugstammdaten (Halter, Marke, Typ, Kontrollschild, Prüfung, aktiv) |
