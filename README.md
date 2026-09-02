# 👕 Kleiderbörse

Vereinskleidung, aus der ein Kind herausgewachsen ist, an andere Familien
weitergeben — **kostenlos und ohne Vereinskonto**. Eltern bieten über einen
Link an, was weg kann, und sehen zugleich, was gerade da ist. Der Verein gibt
frei, was in die Börse darf, und vermittelt die Anfragen.

**➡️ [Kleiderbörse öffnen](https://sc1911heiligenstadt.github.io/kleiderboerse/)**
· [Eltern-Seite](https://sc1911heiligenstadt.github.io/kleiderboerse/spieler.html)

## Zwei Seiten

**Die Eltern-Seite** (`spieler.html`) braucht **keinen Login**. Über den
Eltern-Link kommt man direkt hinein und kann dort

- **ein Kleidungsstück anbieten** — Art, Größe, Zustand, ein bis drei Fotos und
  eine Bemerkung, dazu Vorname, Nachname und E-Mail-Adresse. Diese Angaben
  stehen nie in der Börse; sie dienen nur der Zustellung einer Anfrage;
- **sehen, was gerade da ist** — filterbar nach Art, Größe und Status — und
  danach fragen (Vorname, Nachname, E-Mail; Telefon und Nachricht freiwillig);
- melden, dass ein Stück **weg ist** und aus der Börse verschwinden kann.

Die Fotos werden schon im Browser verkleinert, bevor sie hochgeladen werden.

**Die Verwaltungsseite** (`index.html`) läuft über den normalen Zugang des
Vereins:

| Reiter | Wofür |
|---|---|
| **Börse** | Was gerade in der Börse steht, filterbar nach Art, Größe und Status — bewusst **ohne** Anbieternamen |
| **Freigabe** | Was von Eltern angeboten wurde und **auf Freigabe wartet**; hier wird freigegeben, abgelehnt, als vergeben markiert und gelöscht |
| **Anfragen** | Wer nach welchem Stück gefragt hat, mit Kontaktdaten zum Nachfassen |
| **Einstellungen** | Auswahllisten (Art, Größen, Zustand), der Hinweistext für Eltern und der Eltern-Link |
| **Info** | Was die App kann, die Änderungen und der Datenschutzhinweis — für alle sichtbar |

Angebote, die länger als drei Monate stehen, werden in der Verwaltung als **alt**
gekennzeichnet. Gelöscht wird nichts von allein.

## Warum die Freigabe dazwischen liegt

Angeboten wird ohne Login — deshalb geht nichts ungeprüft in die Börse. Ein
neues Angebot landet zuerst unter **Freigabe** und erscheint erst danach für
alle. So bleibt die Börse offen für Eltern, ohne offen für alles zu sein.

## Wichtig: nicht die Kleiderbestellung

Hier geht es um **gebrauchte** Kleidung von Familie zu Familie. Neue
Vereinskleidung wird über die
[Kleiderbestellung](https://sc1911heiligenstadt.github.io/kleiderbestellung/)
bestellt — anderes Werkzeug, anderer Zweck.

## Zugang

Die Eltern-Seite ist **ohne Anmeldung** erreichbar. Für die Verwaltungsseite
läuft die Anmeldung über die [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/).

Die Rechte gelten in drei Stufen: **Sehen** (Reiter *Börse* und *Info* — ohne
Kontaktdaten), **Bearbeiten** (zusätzlich *Freigabe* und *Anfragen*: freigeben,
ablehnen, als vergeben markieren, löschen und Kontaktdaten einsehen) und
**Administrieren** (zusätzlich *Einstellungen*: Auswahllisten, Hinweistext,
Eltern-Link erzeugen und zurückziehen). Wer welche Stufe hat, legt die
Tools-Übersicht fest.

Ein gelöschtes oder abgelehntes Angebot nimmt seine Fotos und Anfragen mit. Bleibt
dabei ein Foto liegen, sagt die App ausdrücklich, wie viele.

## Lokal starten

Über den Eintrag `kleiderboerse` in `E:\.claude\launch.json` — der Server läuft dann auf `http://localhost:8818/`.

## Technik

Vanilla JavaScript ohne Build-Schritt — die Dateien werden so ausgeliefert, wie sie im Repo liegen. Veröffentlicht über GitHub Pages. Die Daten liegen in der Vereins-Nextcloud; der Zugriff läuft ausschließlich über den Login-Worker der Tools-Übersicht, nie mit Zugangsdaten im Browser.

Die Eltern-Seite schreibt **ohne Login** — sie kennt dafür eng zugeschnittene
Aktionen im Worker und kann nichts anderes als anbieten und anfragen.

---

Ein Werkzeug des 1. SC 1911 Heiligenstadt. Alle Werkzeuge auf einen Blick: [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) · Erklärungen im [Toolbox Wiki](https://sc1911heiligenstadt.github.io/Vereinswiki/).
