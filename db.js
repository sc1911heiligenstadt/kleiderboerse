// Persistenz über das zentrale ToolsUebersicht-Login-Gateway.
// Adaptiert aus E:\materialbedarf\db.js (gleiches Gateway-Muster), erweitert um
// die Datei-Endpunkte aus E:\Vereinswiki\db.js — die Kleiderbörse legt Fotos als
// Binärdateien im Unterordner dateien/ ab, nicht als base64 in der JSON.
//
// ⚠️ Diese Datei ist NUR für die INTERNE Seite (index.html, angemeldete Nutzer).
// Der login-lose Eltern-Weg (spieler.html) spricht eigene kbo-extern-*-Aktionen
// an und liegt in spieler.js — dort gibt es bewusst kein Session-Token.
const GATEWAY_URL = "https://landingpage.michel-brunner.workers.dev";
const TOKEN_STORAGE_KEY = "tu_session_token";
const GATEWAY_APP_ID = "kleiderboerse";

class NotLoggedInError extends Error {
  constructor(message) {
    super(message || "Nicht angemeldet");
    this.name = "NotLoggedInError";
  }
}

class ConflictError extends Error {
  constructor(message) {
    super(message || "Daten wurden zwischenzeitlich von einem anderen Gerät geändert");
    this.name = "ConflictError";
  }
}

// ETag des zuletzt geladenen/geschriebenen Stands. Wird bei dav-save mitgeschickt,
// damit der Worker Konflikte (anderes Gerät hat inzwischen gespeichert) erkennt.
let gatewayRev = null;

function getSessionToken() {
  try { return localStorage.getItem(TOKEN_STORAGE_KEY); } catch (_) { return null; }
}

async function gatewayRequest(payload) {
  const token = getSessionToken();
  if (!token) { if (typeof raeumeBeiSitzungsverlust === "function") raeumeBeiSitzungsverlust(); throw new NotLoggedInError(); }
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify(payload)
  });
  if (resp.status === 401) { if (typeof raeumeBeiSitzungsverlust === "function") raeumeBeiSitzungsverlust(); throw new NotLoggedInError("Sitzung abgelaufen"); }
  if (resp.status === 403) throw new Error("Kein Zugriff auf dieses Tool.");
  if (resp.status === 409) throw new ConflictError();
  if (!resp.ok) {
    let msg = "";
    try { const b = await resp.json(); msg = b && b.error ? b.error : ""; } catch (_) {}
    throw new Error(msg || `Gateway-Fehler (HTTP ${resp.status})`);
  }
  return resp.json();
}

// Das "me" aus der letzten dav-load-Antwort. Der Worker legt es bei, weil er
// nutzer.json und die Rechte-Datei fuer diesen Request ohnehin gelesen hat --
// der erste fetchMe() nach dem Laden kommt damit ohne eigenen Roundtrip aus.
let gatewayMe = null;

async function gatewayLoad() {
  const body = await gatewayRequest({ action: "dav-load", app: GATEWAY_APP_ID });
  gatewayRev = typeof body.rev === "string" ? body.rev : null;
  gatewayMe = (body.me && typeof body.me === "object") ? body.me : null;
  return body.data; // Objekt oder null (Datei noch nicht vorhanden)
}

async function gatewaySave(dataObj) {
  const payload = { action: "dav-save", app: GATEWAY_APP_ID, data: dataObj };
  if (gatewayRev) payload.rev = gatewayRev;
  const body = await gatewayRequest(payload);
  gatewayRev = typeof body.rev === "string" ? body.rev : null;
}

// Ein Foto löschen (beim Löschen eines Angebots durch einen Bearbeiter).
// 204/404 gelten serverseitig beide als Erfolg — ein bereits fehlendes Foto ist
// kein Fehler beim Aufräumen.
async function gatewayFileDelete(id) {
  await gatewayRequest({ action: "dav-file-delete", app: GATEWAY_APP_ID, id });
}

// Ein Foto als Blob holen (für die Freigabe-Ansicht der internen Seite).
// dav-file-get liefert rohe Bytes (kein JSON), daher eigener fetch statt gatewayRequest.
async function gatewayFileBlob(id) {
  const token = getSessionToken();
  if (!token) { if (typeof raeumeBeiSitzungsverlust === "function") raeumeBeiSitzungsverlust(); throw new NotLoggedInError(); }
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ action: "dav-file-get", app: GATEWAY_APP_ID, id })
  });
  if (resp.status === 401) { if (typeof raeumeBeiSitzungsverlust === "function") raeumeBeiSitzungsverlust(); throw new NotLoggedInError("Sitzung abgelaufen"); }
  if (resp.status === 403) throw new Error("Kein Zugriff auf dieses Tool.");
  if (!resp.ok) throw new Error("Foto konnte nicht geladen werden.");
  return resp.blob();
}

// Liefert {username, isAdmin, groupIds, vorname, nachname, mannschaften, canEdit, canAdmin}.
async function fetchMe() {
  // Genau EINMAL aus dem letzten dav-load bedienen, danach wieder echt fragen:
  // ein spaeterer Aufruf will den aktuellen Stand (etwa nach einem Rechte-
  // wechsel), nicht eine beliebig alte Kopie.
  if (gatewayMe) { const me = gatewayMe; gatewayMe = null; return me; }
  return gatewayRequest({ action: "me", app: GATEWAY_APP_ID });
}
