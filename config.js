const APP_VERSION = "1.0";

// Wie lange ein freigegebenes Angebot in der Börse steht, bevor die Verwaltung
// es in der Liste als "alt" markiert bekommt. Nur eine Anzeige-Hilfe — es wird
// nichts automatisch gelöscht.
const ANGEBOT_ALT_NACH_TAGEN = 90;

// Vorbelegung der Auswahllisten beim allerersten Start. Danach pflegen
// Administratoren sie im Reiter "Einstellungen"; diese Konstanten werden dann
// nicht mehr angefasst.
const DEFAULT_ARTEN = [
  "Trikot", "Trainingsanzug", "Trainingsjacke", "Trainingshose",
  "Regenjacke", "Winterjacke", "Sporthose", "Stutzen",
  "Fußballschuhe", "Hallenschuhe", "Torwarthandschuhe",
  "Sporttasche", "Rucksack", "Sonstiges"
];

const DEFAULT_GROESSEN = [
  "104", "116", "128", "140", "152", "164", "176",
  "XS", "S", "M", "L", "XL", "XXL",
  "Schuh 28", "Schuh 30", "Schuh 32", "Schuh 34", "Schuh 36",
  "Schuh 38", "Schuh 40", "Schuh 42", "Schuh 44", "Schuh 46"
];

const DEFAULT_ZUSTAENDE = ["neuwertig", "gut erhalten", "gebraucht"];

const APP_CHANGELOG = [
  {
    version: "1.0",
    groups: [
      {
        title: "Was die Kleiderbörse ist",
        items: [
          "Eltern geben Vereinskleidung, aus der ihr Kind herausgewachsen ist, an andere Familien weiter — kostenlos.",
          "Alles läuft über einen Link. Wer etwas anbieten oder etwas suchen will, braucht kein Vereinskonto und kein Passwort.",
          "Verkauft wird hier nichts. Es gibt kein Preisfeld — jedes Teil wird verschenkt."
        ]
      },
      {
        title: "Ein Teil anbieten",
        items: [
          "Zu jedem Teil gehören ein bis drei Fotos, die Art des Kleidungsstücks, die Größe und der Zustand. Eine Bemerkung ist freiwillig.",
          "Art, Größe und Zustand kommen aus festen Listen, damit sich die Börse später filtern lässt. Frei getippte Schreibweisen fänden sonst nie zusammen.",
          "Die Fotos werden schon im Browser auf eine handliche Größe gerechnet, bevor sie hochgeladen werden — ein Handy-Foto muss dafür nicht in voller Auflösung durchs Netz.",
          "Angeben muss man Vorname, Nachname und E-Mail-Adresse. Diese Angaben stehen nie in der Börse; sie dienen nur dazu, eine Anfrage zustellen zu können."
        ]
      },
      {
        title: "Freigabe",
        items: [
          "Ein neu eingestelltes Teil ist zunächst für niemanden sichtbar. Es liegt im Reiter „Freigabe“ und wartet dort auf einen Bearbeiter.",
          "Erst nach der Freigabe erscheint es in der Börse. So landet kein ungeprüftes Foto auf einer Seite des Vereins.",
          "Wird ein Angebot abgelehnt, werden seine Fotos mit gelöscht — sie bleiben nicht in der Vereins-Nextcloud liegen."
        ]
      },
      {
        title: "Anfragen",
        items: [
          "In der Börse steht zu jedem Teil nur Foto, Art, Größe, Zustand und Bemerkung. Weder Name noch Kontakt der anbietenden Familie ist zu sehen.",
          "Wer ein Teil haben möchte, hinterlässt seinen Namen und wie er erreichbar ist. Die Anfrage geht als E-Mail direkt an die anbietende Familie.",
          "Jede Anfrage steht zusätzlich im Reiter „Anfragen“, damit ein Bearbeiter nachfassen kann, wenn nichts passiert.",
          "Die Kontaktdaten des Anfragenden bekommt nur die anbietende Familie und die Vereins-Verwaltung zu sehen — nie die Börse."
        ]
      },
      {
        title: "Wie ein Teil wieder verschwindet",
        items: [
          "Jedes Angebot hat einen eigenen geheimen Link. Er steht in jeder E-Mail an die anbietende Familie.",
          "Ein Klick darauf nimmt das Teil aus der Börse — ohne Anmeldung, ohne Umweg über den Verein.",
          "Ein Bearbeiter kann jedes Angebot ebenfalls jederzeit als vergeben markieren oder ganz löschen.",
          "Angebote, die länger als drei Monate stehen, werden in der Verwaltung als alt gekennzeichnet. Gelöscht wird nichts von allein."
        ]
      },
      {
        title: "Wer darf was",
        items: [
          "Sehen: die freigegebenen Angebote und die Reiter Börse und Info. Kontaktdaten sind auch auf dieser Stufe nicht sichtbar.",
          "Bearbeiten: freigeben, ablehnen, als vergeben markieren, löschen und die Anfragen einsehen.",
          "Administrieren: die Auswahllisten pflegen und den Eltern-Link erzeugen oder zurückziehen.",
          "Der Reiter „Info“ ist für alle sichtbar."
        ]
      },
      {
        title: "Daten & Speicherung",
        items: [
          "Gespeichert wird in der Vereins-Nextcloud über die zentrale Anmeldung der Tools-Übersicht — ein eigenes Passwort braucht es nicht.",
          "Die Fotos liegen als einzelne Bilddateien daneben, nicht in der Datenliste selbst.",
          "Der Eltern-Link enthält einen geheimen Schlüssel. Er lässt sich in den Einstellungen zurückziehen; danach führt der alte Link ins Leere."
        ]
      }
    ]
  }
];
