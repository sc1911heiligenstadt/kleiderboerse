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
          "Verkauft wird hier nichts. Es gibt kein Preisfeld — jedes Teil wird verschenkt.",
          "Nicht zu verwechseln mit der Kleiderbestellung: dort wird neue Vereinskleidung beim Lieferanten bestellt, hier wandert gebrauchte von Familie zu Familie."
        ]
      },
      {
        title: "Ein Teil anbieten",
        items: [
          "Zu jedem Teil gehören ein bis drei Fotos, die Art des Kleidungsstücks, die Größe und der Zustand. Eine Bemerkung ist freiwillig.",
          "Art, Größe und Zustand kommen aus festen Listen, damit sich die Börse filtern lässt. Frei getippte Schreibweisen fänden sonst nie zusammen.",
          "Die Fotos werden schon im Browser auf eine handliche Größe gerechnet, bevor sie hochgeladen werden — ein Handy-Foto muss dafür nicht in voller Auflösung durchs Netz.",
          "Angeben muss man Vorname, Nachname und E-Mail-Adresse. Diese Angaben stehen nie in der Börse; sie dienen nur dazu, eine Anfrage zustellen zu können.",
          "Über der Eingabe steht ein Hinweistext, den der Verein in den Einstellungen pflegt."
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
        title: "Was in der Börse steht",
        items: [
          "In der Börse steht zu jedem Teil nur Foto, Art, Größe, Zustand und Bemerkung. Weder Name noch Kontakt der anbietenden Familie ist zu sehen.",
          "Die Liste lässt sich nach Art, Größe und Status filtern — von sich aus stehen dort die Stücke, die gerade zu haben sind; vergebene lassen sich dazuschalten.",
          "Dieselbe Übersicht sehen die Eltern über ihren Link, ohne Anmeldung."
        ]
      },
      {
        title: "Anfragen",
        items: [
          "Wer ein Teil haben möchte, hinterlässt Vorname, Nachname und E-Mail-Adresse; Telefonnummer und eine Nachricht sind freiwillig. Die Anfrage geht als E-Mail direkt an die anbietende Familie.",
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
          "Beim Ablehnen und beim Löschen gehen die Fotos aus der Vereins-Cloud mit. Bleibt dabei eines liegen, sagt die App ausdrücklich, wie viele es sind — sonst wäre das Angebot weg und niemand käme mehr an die Bilder heran.",
          "Angebote, die länger als drei Monate stehen, werden in der Verwaltung als alt gekennzeichnet. Gelöscht wird nichts von allein."
        ]
      },
      {
        title: "Wer darf was",
        items: [
          "Sehen: die freigegebenen Angebote und die Reiter Börse und Info. Kontaktdaten sind auch auf dieser Stufe nicht sichtbar.",
          "Bearbeiten: freigeben, ablehnen, als vergeben markieren, löschen und die Anfragen einsehen.",
          "Administrieren: die Auswahllisten und den Hinweistext pflegen und den Eltern-Link erzeugen oder zurückziehen.",
          "Der Reiter „Info“ ist für alle sichtbar."
        ]
      },
      {
        title: "Daten und Speicherung",
        items: [
          "Gespeichert wird in der Vereins-Nextcloud über die zentrale Anmeldung der Tools-Übersicht — ein eigenes Passwort braucht es nicht.",
          "Die Fotos liegen als einzelne Bilddateien daneben, nicht in der Datenliste selbst.",
          "Der Eltern-Link enthält einen geheimen Schlüssel. Er lässt sich in den Einstellungen zurückziehen; danach führt der alte Link ins Leere.",
          "Beide Formulare auf der Eltern-Seite tragen ihre eigene Datenschutz-Information: wer verantwortlich ist — mit vollständiger Anschrift —, wie lange die Angaben bleiben und wo man sich beschweren kann. Die Angaben zu einem Angebot bleiben, bis das Angebot gelöscht wird; danach sind sie mit weg, denn das Löschen nimmt Fotos und Anfragen mit.",
          "Endet die Anmeldung, während die Verwaltungsseite offen ist, wird der Bildschirm geräumt: Angebote, ein groß geöffnetes Foto und der eigene Name oben rechts verschwinden, und jeder Weg führt auf den Anmelde-Hinweis."
        ]
      },
      {
        title: "Bedienung am Handy",
        items: [
          "Die Reiterleiste bricht am Handy um, statt seitlich aus dem Bild zu laufen — auch die hinteren Reiter sind auf schmalen Bildschirmen erreichbar.",
          "Knöpfe, die etwas wegnehmen — „Ablehnen“, „Löschen“ und „Link zurückziehen“ — sind rot, wie in allen anderen Vereins-Tools auch."
        ]
      }
    ]
  }
];
