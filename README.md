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

- **ein Kleidungsstück anbieten** — was es ist, Art, Größe, Zustand, Fotos und
  eine Bemerkung, dazu Vorname, Nachname und eine Kontaktmöglichkeit
  (E-Mail-Adresse oder Telefon);
- **sehen, was gerade da ist**, und danach fragen;
- melden, dass ein Stück **weg ist** und aus der Börse verschwinden kann.

**Die Verwaltungsseite** (`index.html`) läuft über den normalen Zugang des
Vereins:

| Reiter | Wofür |
|---|---|
| **Börse** | Was gerade in der Börse steht |
| **Freigabe** | Was von Eltern angeboten wurde und **auf Freigabe wartet** |
| **Anfragen** | Wer nach welchem Stück gefragt hat |
| **Einstellungen** | Auswahllisten (Art, Größen, Zustand), der Hinweistext für Eltern und der Eltern-Link |

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

Die Rechte gelten in drei Stufen: **Sehen** (Börse und Anfragen ansehen),
**Bearbeiten** (Angebote freigeben, Anfragen bearbeiten) und **Administrieren**
(Reiter *Einstellungen*: Auswahllisten, Hinweistext, Eltern-Link). Wer welche
Stufe hat, legt die Tools-Übersicht fest.

## Lokal starten

Über den Eintrag `kleiderboerse` in `E:\.claude\launch.json` — der Server läuft dann auf `http://localhost:8818/`.

## Technik

Vanilla JavaScript ohne Build-Schritt — die Dateien werden so ausgeliefert, wie sie im Repo liegen. Veröffentlicht über GitHub Pages. Die Daten liegen in der Vereins-Nextcloud; der Zugriff läuft ausschließlich über den Login-Worker der Tools-Übersicht, nie mit Zugangsdaten im Browser.

Die Eltern-Seite schreibt **ohne Login** — sie kennt dafür eng zugeschnittene
Aktionen im Worker und kann nichts anderes als anbieten und anfragen.

---

Ein Werkzeug des 1. SC 1911 Heiligenstadt. Alle Werkzeuge auf einen Blick: [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) · Erklärungen im [Toolbox Wiki](https://sc1911heiligenstadt.github.io/Vereinswiki/).
