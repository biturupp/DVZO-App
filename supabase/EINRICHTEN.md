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

5. **Fahrer/innen einladen:** **Authentication → Users → Invite user**. Sie bekommen eine E-Mail,
   legen ihr Passwort fest und erscheinen danach im Dienstplan.

## Zugriffsregeln

| Wer | darf |
| --- | --- |
| Disposition (`admin`) | alles lesen und bearbeiten |
| Fahrer/in | Linien, Fahrpläne, Fahrzeuge lesen; eigene Dienste lesen; auf eigenen Diensten zählen; eigene Zählungen vom selben Tag löschen |
