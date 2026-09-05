// Kleiderbörse — interne Seite (angemeldete Nutzer).
//
// Der login-lose Eltern-Weg liegt in spieler.js und spricht eigene
// kbo-extern-*-Aktionen im Gateway an. Diese Datei sieht davon nichts außer dem
// Ergebnis: den Angeboten, die dort eingestellt wurden.
//
// ⚠️ Fotos liegen NIE in appData, sondern als Binärdateien im Unterordner
// dateien/ der App (dav-file-put/get/delete). In appData steht je Foto nur
// { id, contentType } — sonst würde die JSON mit jedem Angebot um Megabytes
// wachsen und jeder Save schöbe alles erneut durchs Netz.

let appData = { meta: {}, listen: {}, angebote: [] };
let currentUsername = null;
let currentIsAdmin = false;
let currentCanEdit = false;
let currentCanAdmin = false;
let currentVorname = null;
let currentNachname = null;

function canEdit() { return currentIsAdmin || currentCanEdit; }
function canAdmin() { return currentIsAdmin || currentCanAdmin; }

const STATUS_LABEL = { wartet: "Wartet auf Freigabe", frei: "In der Börse", vergeben: "Vergeben" };

let filterArt = "";
let filterGroesse = "";
let filterStatus = "frei";

// ---------- Helfer ----------

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("de-DE") + ", " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr";
}

function fmtDateKurz(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("de-DE");
}

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : ((r & 0x3) | 0x8)).toString(16);
  });
}

// 64 Hex-Zeichen aus dem Kryptozufall des Browsers. Der Worker prüft genau
// dieses Format (/^[0-9a-f]{64}$/), bevor er überhaupt eine Datei anfasst.
function neuerToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

function tageSeit(iso) {
  if (!iso) return 0;
  const d = new Date(iso);
  if (isNaN(d)) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function externBasisUrl() {
  // Gleiche Ablage wie index.html, nur andere Datei — funktioniert lokal
  // (localhost:8818) genauso wie auf GitHub Pages.
  return location.href.replace(/[^/]*$/, "") + "spieler.html";
}

function externLink() {
  const t = appData.meta && appData.meta.externToken;
  return t ? externBasisUrl() + "?t=" + t : "";
}

// ---------- Datenschema ----------

function normalizeAppData(data) {
  const d = data && typeof data === "object" ? data : {};
  d.meta = d.meta && typeof d.meta === "object" ? d.meta : {};
  if (typeof d.meta.externToken !== "string") d.meta.externToken = "";
  if (typeof d.meta.hinweis !== "string") d.meta.hinweis = "";

  d.listen = d.listen && typeof d.listen === "object" ? d.listen : {};
  // Erstbefüllung aus config.js — nur, solange noch gar nichts gepflegt wurde.
  // Ein Administrator, der eine Liste leer räumt, bekommt sie NICHT wieder
  // vorbelegt: leer ist dann eine Entscheidung, kein fehlender Wert.
  if (!Array.isArray(d.listen.arten)) d.listen.arten = DEFAULT_ARTEN.slice();
  if (!Array.isArray(d.listen.groessen)) d.listen.groessen = DEFAULT_GROESSEN.slice();
  if (!Array.isArray(d.listen.zustaende)) d.listen.zustaende = DEFAULT_ZUSTAENDE.slice();

  if (!Array.isArray(d.angebote)) d.angebote = [];
  d.angebote.forEach((a) => {
    if (!a || typeof a !== "object") return;
    if (!Array.isArray(a.fotos)) a.fotos = [];
    if (!Array.isArray(a.anfragen)) a.anfragen = [];
    if (!a.anbieter || typeof a.anbieter !== "object") a.anbieter = {};
    if (!STATUS_LABEL[a.status]) a.status = "wartet";
  });
  return d;
}

// ---------- Speichern ----------

// In-Flight-Guard: läuft schon ein Save, wird der nächste angehängt statt mit
// dem alten ETag losgeschickt. Ohne das meldet die App "von einem anderen Gerät
// geändert", obwohl nur eine Person arbeitet.
let savePromise = Promise.resolve();

function saveWithConflictRetry(mutate) {
  const lauf = savePromise.then(async () => {
    mutate(appData);
    try {
      await gatewaySave(appData);
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
      const data = await gatewayLoad();
      appData = normalizeAppData(data);
      mutate(appData);
      await gatewaySave(appData);
    }
  });
  // Die Kette darf an einem Fehler nicht zerbrechen — sonst liefe kein
  // späterer Save mehr an. Der Fehler geht an den Aufrufer, die Kette selbst
  // wird beruhigt weitergereicht.
  savePromise = lauf.catch(() => {});
  return lauf;
}

// ---------- Fotos ----------

// id -> ObjectURL. Ein einmal geholtes Foto wird nicht bei jedem Neurendern
// erneut aus der Nextcloud gezogen. Die URLs bleiben bis zum Seitenwechsel
// bestehen; sie sind wenige Kilobyte pro Bild und ein revoke mitten im Render
// würde die gerade angezeigten Bilder schwärzen.
const fotoUrlCache = new Map();

async function fotoUrl(fotoId) {
  if (fotoUrlCache.has(fotoId)) return fotoUrlCache.get(fotoId);
  const blob = await gatewayFileBlob(fotoId);
  const url = URL.createObjectURL(blob);
  fotoUrlCache.set(fotoId, url);
  return url;
}

// Lädt die Bilder nach, die im gerade gerenderten Abschnitt noch leer sind.
// Läuft absichtlich nach dem Rendern und nicht davor: die Karten stehen sofort,
// die Bilder tropfen nach.
function ladeFotosNach(container) {
  container.querySelectorAll("img[data-foto-id]:not([data-geladen])").forEach(async (img) => {
    const id = img.dataset.fotoId;
    img.dataset.geladen = "1";
    try {
      img.src = await fotoUrl(id);
    } catch (_) {
      img.replaceWith(Object.assign(document.createElement("div"), {
        className: img.classList.contains("angebot-bild") ? "angebot-bild-leer" : "",
        textContent: "Foto nicht ladbar"
      }));
    }
  });
}

function zeigeFotoGross(url) {
  const box = document.createElement("div");
  box.className = "foto-lightbox";
  const img = document.createElement("img");
  img.src = url;
  box.appendChild(img);
  box.addEventListener("click", () => box.remove());
  document.body.appendChild(box);
}

// ---------- Rendern: eine Angebots-Karte ----------

function statusPille(a) {
  if (a.status === "frei" && tageSeit(a.freigegebenAm) > ANGEBOT_ALT_NACH_TAGEN) {
    return '<span class="status-pille status-alt">Steht seit ' + tageSeit(a.freigegebenAm) + " Tagen</span>";
  }
  return '<span class="status-pille status-' + a.status + '">' + escapeHtml(STATUS_LABEL[a.status]) + "</span>";
}

// mitAnbieter: nur in den Bearbeiter-Ansichten. Im Börsen-Tab bleibt der Name
// auch für Administratoren weg — die Börse ist die Ansicht ohne Kontaktdaten,
// wer sie braucht, geht in Freigabe oder Anfragen.
function angebotKarteHtml(a, aktionen, mitAnbieter) {
  const haupt = a.fotos[0];
  const weitere = a.fotos.slice(1);
  const bild = haupt
    ? '<img class="angebot-bild" data-foto-id="' + escapeHtml(haupt.id) + '" alt="' + escapeHtml(a.art) + '" />'
    : '<div class="angebot-bild-leer">kein Foto</div>';
  const thumbs = weitere.length
    ? '<div class="angebot-thumbs">' + weitere.map((f) =>
        '<img data-foto-id="' + escapeHtml(f.id) + '" alt="weiteres Foto" />').join("") + "</div>"
    : "";
  const anbieter = mitAnbieter
    ? '<div class="angebot-meta">Angeboten von ' + escapeHtml((a.anbieter.vorname || "") + " " + (a.anbieter.nachname || "")).trim() +
      " &middot; " + escapeHtml(a.anbieter.email || "ohne E-Mail") + "</div>"
    : "";
  const anfragenHinweis = (mitAnbieter && a.anfragen.length)
    ? '<div class="angebot-meta">' + a.anfragen.length + (a.anfragen.length === 1 ? " Anfrage" : " Anfragen") + "</div>"
    : "";
  return '<div class="angebot-karte" data-id="' + escapeHtml(a.id) + '">' +
    bild + thumbs +
    '<div class="angebot-body">' +
      '<div class="angebot-titel">' + escapeHtml(a.art || "Kleidungsstück") + "</div>" +
      '<div class="angebot-meta">Größe ' + escapeHtml(a.groesse || "?") + " &middot; " + escapeHtml(a.zustand || "") + "</div>" +
      '<div class="angebot-meta">' + statusPille(a) + "</div>" +
      (a.bemerkung ? '<div class="angebot-bemerkung">' + escapeHtml(a.bemerkung) + "</div>" : "") +
      anbieter + anfragenHinweis +
      '<div class="angebot-meta" style="margin-top:6px;">eingestellt ' + escapeHtml(fmtDateKurz(a.erstelltAm)) + "</div>" +
      (aktionen ? '<div class="angebot-actions">' + aktionen + "</div>" : "") +
    "</div></div>";
}

// ---------- Tab: Börse ----------

function fuelleFilterListen() {
  const setze = (sel, werte, aktuell) => {
    const el = document.getElementById(sel);
    if (!el) return;
    el.innerHTML = '<option value="">Alle</option>' +
      werte.map((w) => '<option value="' + escapeHtml(w) + '"' + (w === aktuell ? " selected" : "") + ">" + escapeHtml(w) + "</option>").join("");
  };
  setze("filter-art", appData.listen.arten, filterArt);
  setze("filter-groesse", appData.listen.groessen, filterGroesse);
}

function boerseAngebote() {
  return appData.angebote.filter((a) => {
    // "wartet" taucht in der Börse NIE auf — auch nicht unter "Alle". Was nicht
    // freigegeben ist, gehört ausschließlich in den Freigabe-Tab.
    if (a.status === "wartet") return false;
    if (filterStatus !== "alle" && a.status !== filterStatus) return false;
    if (filterArt && a.art !== filterArt) return false;
    if (filterGroesse && a.groesse !== filterGroesse) return false;
    return true;
  }).sort((x, y) => String(y.freigegebenAm || y.erstelltAm || "").localeCompare(String(x.freigegebenAm || x.erstelltAm || "")));
}

function renderBoerse() {
  const grid = document.getElementById("boerse-grid");
  const leer = document.getElementById("boerse-empty");
  const liste = boerseAngebote();
  leer.style.display = liste.length ? "none" : "block";
  grid.innerHTML = liste.map((a) => angebotKarteHtml(a, "", false)).join("");
  ladeFotosNach(grid);
}

// ---------- Tab: Freigabe ----------

function renderFreigabe() {
  const grid = document.getElementById("freigabe-grid");
  const leer = document.getElementById("freigabe-empty");
  const wartend = appData.angebote.filter((a) => a.status === "wartet")
    .sort((x, y) => String(x.erstelltAm || "").localeCompare(String(y.erstelltAm || "")));
  leer.style.display = wartend.length ? "none" : "block";
  grid.innerHTML = wartend.map((a) => angebotKarteHtml(a,
    '<button type="button" class="btn success small btn-freigeben">Freigeben</button>' +
    '<button type="button" class="btn danger small btn-ablehnen">Ablehnen</button>', true)).join("");
  ladeFotosNach(grid);

  const nav = document.getElementById("nav-freigabe");
  if (nav) nav.textContent = wartend.length ? "Freigabe (" + wartend.length + ")" : "Freigabe";

  const vgrid = document.getElementById("verwaltung-grid");
  const vleer = document.getElementById("verwaltung-empty");
  const drin = appData.angebote.filter((a) => a.status === "frei" || a.status === "vergeben")
    .sort((x, y) => String(y.freigegebenAm || "").localeCompare(String(x.freigegebenAm || "")));
  vleer.style.display = drin.length ? "none" : "block";
  vgrid.innerHTML = drin.map((a) => angebotKarteHtml(a,
    (a.status === "frei"
      ? '<button type="button" class="btn secondary small btn-vergeben">Als vergeben markieren</button>'
      : '<button type="button" class="btn success small btn-zurueck">Wieder in die Börse</button>') +
    '<button type="button" class="btn danger small btn-loeschen">Löschen</button>', true)).join("");
  ladeFotosNach(vgrid);
}

async function freigeben(id) {
  const a = appData.angebote.find((x) => x.id === id);
  if (!a || a.status !== "wartet") return;
  try {
    await saveWithConflictRetry((d) => {
      const t = d.angebote.find((x) => x.id === id);
      if (!t || t.status !== "wartet") return;
      t.status = "frei";
      t.freigegebenAm = new Date().toISOString();
      t.freigegebenVon = currentUsername;
    });
    renderAlles();
  } catch (e) {
    alert("Freigeben fehlgeschlagen: " + e.message);
  }
}

async function ablehnen(id) {
  const a = appData.angebote.find((x) => x.id === id);
  if (!a) return;
  if (!confirm("Dieses Angebot ablehnen? Die Fotos werden dabei gelöscht.")) return;
  // Erst die Fotos, dann der Eintrag: bricht der Datei-Teil ab, steht das
  // Angebot noch da und der Vorgang lässt sich wiederholen. Andersherum
  // blieben verwaiste Bilder in der Nextcloud liegen, auf die nichts mehr zeigt.
  const uebrig = await loescheFotos(a.fotos);
  try {
    await saveWithConflictRetry((d) => {
      d.angebote = d.angebote.filter((x) => x.id !== id);
    });
    renderAlles();
    meldeLiegengebliebeneFotos(uebrig, "Das Angebot wurde abgelehnt.");
  } catch (e) {
    alert("Ablehnen fehlgeschlagen: " + e.message);
  }
}

async function alsVergeben(id) {
  try {
    await saveWithConflictRetry((d) => {
      const t = d.angebote.find((x) => x.id === id);
      if (!t || t.status !== "frei") return;
      t.status = "vergeben";
      t.vergebenAm = new Date().toISOString();
      t.vergebenVon = currentUsername;
    });
    renderAlles();
  } catch (e) {
    alert("Speichern fehlgeschlagen: " + e.message);
  }
}

// Der Rückweg aus "vergeben". Eine Übergabe platzt, jemand klickt in der Mail
// versehentlich auf "ist weg" — ohne diesen Knopf bliebe nur Löschen, und das
// nimmt Fotos und Anfragen mit; die Familie müsste alles neu einstellen.
async function zurueckInDieBoerse(id) {
  const a = appData.angebote.find((x) => x.id === id);
  if (!a || a.status !== "vergeben") return;
  if (!confirm("Dieses Angebot wieder in die Börse stellen? Es ist danach wieder für alle Familien sichtbar.")) return;
  let gemacht = false;
  try {
    await saveWithConflictRetry((d) => {
      gemacht = false;
      const t = d.angebote.find((x) => x.id === id);
      if (!t || t.status !== "vergeben") return;
      t.status = "frei";
      // freigegebenAm bleibt stehen — daran hängt die Sortierung und die
      // Anzeige "steht schon lange in der Börse".
      delete t.vergebenAm;
      delete t.vergebenVon;
      gemacht = true;
    });
    renderAlles();
    if (!gemacht) {
      alert("Das Angebot steht nicht mehr auf „vergeben“ — jemand anderes war schneller. Die Liste zeigt jetzt den aktuellen Stand.");
    }
  } catch (e) {
    alert("Speichern fehlgeschlagen: " + e.message);
  }
}

async function loeschen(id) {
  const a = appData.angebote.find((x) => x.id === id);
  if (!a) return;
  if (!confirm("Dieses Angebot mit allen Fotos und Anfragen endgültig löschen?")) return;
  const uebrig = await loescheFotos(a.fotos);
  try {
    await saveWithConflictRetry((d) => {
      d.angebote = d.angebote.filter((x) => x.id !== id);
    });
    renderAlles();
    meldeLiegengebliebeneFotos(uebrig, "Das Angebot wurde gelöscht.");
  } catch (e) {
    alert("Löschen fehlgeschlagen: " + e.message);
  }
}

// Ein bereits fehlendes Foto ist kein Fehler — der Worker meldet 404 als Erfolg.
// Ein echter Netzfehler soll den Löschvorgang trotzdem nicht aufhalten.
//
// Was übrig bleibt, wird aber gemeldet: bis zur Bugjagd am 2026-08-30 stand hier
// ein leeres catch, und ein Foto, das in der Vereins-Cloud liegen blieb, war
// danach von nirgends mehr erreichbar — das Angebot dazu gab es ja nicht mehr.
// Rückgabe: Anzahl der Fotos, die liegen geblieben sind.
async function loescheFotos(fotos) {
  let liegengeblieben = 0;
  for (const f of (fotos || [])) {
    try { await gatewayFileDelete(f.id); } catch (_) { liegengeblieben++; }
    fotoUrlCache.delete(f.id);
  }
  return liegengeblieben;
}

// Erst melden, wenn der Eintrag wirklich weg ist — sonst stünde der Hinweis da,
// obwohl das Angebot samt Fotos noch existiert und der Vorgang wiederholbar ist.
function meldeLiegengebliebeneFotos(anzahl, vorgangGetan) {
  if (!anzahl) return;
  alert(vorgangGetan + " In der Vereins-Cloud liegen geblieben: " + anzahl
    + (anzahl === 1 ? " Foto." : " Fotos."));
}

// ---------- Tab: Anfragen ----------

function alleAnfragen() {
  const out = [];
  appData.angebote.forEach((a) => {
    (a.anfragen || []).forEach((q) => out.push({ angebot: a, anfrage: q }));
  });
  return out.sort((x, y) => String(y.anfrage.am || "").localeCompare(String(x.anfrage.am || "")));
}

function renderAnfragen() {
  const box = document.getElementById("anfragen-rows");
  const leer = document.getElementById("anfragen-empty");
  const liste = alleAnfragen();
  leer.style.display = liste.length ? "none" : "block";
  box.innerHTML = liste.map(({ angebot, anfrage }) => {
    const wer = escapeHtml(((anfrage.vorname || "") + " " + (anfrage.nachname || "")).trim() || "ohne Namen");
    const kontakt = [anfrage.email, anfrage.telefon].filter(Boolean).map(escapeHtml).join(" &middot; ");
    const anbieter = escapeHtml(((angebot.anbieter.vorname || "") + " " + (angebot.anbieter.nachname || "")).trim());
    return '<div class="meldung-row">' +
      "<div><strong>" + wer + "</strong> fragt nach: " +
        escapeHtml(angebot.art || "Kleidungsstück") + ", Größe " + escapeHtml(angebot.groesse || "?") +
        " " + statusPille(angebot) + "</div>" +
      '<div class="muted">Erreichbar: ' + (kontakt || "keine Angabe") + "</div>" +
      '<div class="muted">Angeboten von ' + (anbieter || "unbekannt") +
        " &middot; " + escapeHtml(angebot.anbieter.email || "ohne E-Mail") + "</div>" +
      (anfrage.nachricht ? '<div style="margin-top:6px; white-space:pre-line;">' + escapeHtml(anfrage.nachricht) + "</div>" : "") +
      '<div class="muted" style="margin-top:6px;">' + escapeHtml(fmtDate(anfrage.am)) + "</div>" +
      "</div>";
  }).join("");
}

// ---------- Tab: Einstellungen ----------

function renderEinstellungen() {
  const box = document.getElementById("extern-link-box");
  const link = externLink();
  box.textContent = link || "Noch kein Link erzeugt.";

  document.getElementById("f-hinweis").value = appData.meta.hinweis || "";

  renderChips("chips-arten", "arten");
  renderChips("chips-groessen", "groessen");
  renderChips("chips-zustaende", "zustaende");
}

function renderChips(elId, listenKey) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = (appData.listen[listenKey] || []).map((w) =>
    '<span class="listen-chip">' + escapeHtml(w) +
    '<button type="button" data-liste="' + listenKey + '" data-wert="' + escapeHtml(w) + '" title="Entfernen">&times;</button></span>'
  ).join("");
}

// Welches Feld eines Angebots hängt an welcher Liste? Wird gebraucht, um zu
// prüfen, ob ein Eintrag noch in Gebrauch ist.
const LISTE_FELD = { arten: "art", groessen: "groesse", zustaende: "zustand" };

function listenFehler(msg) {
  const el = document.getElementById("listen-error");
  el.style.display = msg ? "block" : "none";
  el.textContent = msg || "";
}

async function listeHinzufuegen(listenKey, inputId) {
  const input = document.getElementById(inputId);
  const wert = input.value.trim();
  listenFehler("");
  if (!wert) return;
  if ((appData.listen[listenKey] || []).includes(wert)) {
    listenFehler("„" + wert + "“ steht schon in der Liste.");
    return;
  }
  try {
    await saveWithConflictRetry((d) => {
      if (!d.listen[listenKey].includes(wert)) d.listen[listenKey].push(wert);
    });
    input.value = "";
    renderEinstellungen();
    fuelleFilterListen();
  } catch (e) {
    listenFehler("Speichern fehlgeschlagen: " + e.message);
  }
}

async function listeEntfernen(listenKey, wert) {
  listenFehler("");
  const feld = LISTE_FELD[listenKey];
  const inGebrauch = appData.angebote.filter((a) => a[feld] === wert).length;
  if (inGebrauch) {
    // Sonst stünde bei bestehenden Angeboten ein Wert, den die Auswahlliste
    // nicht mehr kennt — und der Filter fände sie nie wieder.
    listenFehler("„" + wert + "“ ist noch bei " + inGebrauch + " Angebot(en) in Gebrauch und kann nicht entfernt werden.");
    return;
  }
  try {
    await saveWithConflictRetry((d) => {
      d.listen[listenKey] = d.listen[listenKey].filter((x) => x !== wert);
    });
    renderEinstellungen();
    fuelleFilterListen();
  } catch (e) {
    listenFehler("Speichern fehlgeschlagen: " + e.message);
  }
}

async function linkErzeugen() {
  if (appData.meta.externToken &&
      !confirm("Es gibt bereits einen Eltern-Link. Ein neuer macht den alten sofort ungültig. Trotzdem erzeugen?")) return;
  const t = neuerToken();
  try {
    await saveWithConflictRetry((d) => { d.meta.externToken = t; });
    renderEinstellungen();
  } catch (e) {
    alert("Link erzeugen fehlgeschlagen: " + e.message);
  }
}

async function linkWiderrufen() {
  if (!appData.meta.externToken) return;
  if (!confirm("Den Eltern-Link zurückziehen? Wer ihn hat, kommt danach nicht mehr in die Börse.")) return;
  try {
    // Der Token wird gelöscht, kein Widerruf-Flag gesetzt: so gibt es nur eine
    // Wahrheit darüber, ob ein Link gilt — nämlich, ob einer da ist.
    await saveWithConflictRetry((d) => { d.meta.externToken = ""; });
    renderEinstellungen();
  } catch (e) {
    alert("Zurückziehen fehlgeschlagen: " + e.message);
  }
}

async function linkKopieren() {
  const link = externLink();
  if (!link) { alert("Es gibt noch keinen Link."); return; }
  try {
    await navigator.clipboard.writeText(link);
    alert("Link kopiert.");
  } catch (_) {
    // Ältere iOS-Browser und jede Seite ohne HTTPS haben keine Zwischenablage.
    prompt("Link von Hand kopieren:", link);
  }
}

async function hinweisSpeichern() {
  const wert = document.getElementById("f-hinweis").value.trim().slice(0, 1000);
  try {
    await saveWithConflictRetry((d) => { d.meta.hinweis = wert; });
    alert("Hinweis gespeichert.");
  } catch (e) {
    alert("Speichern fehlgeschlagen: " + e.message);
  }
}

// ---------- Changelog / Kopf ----------

function renderChangelog() {
  const list = document.getElementById("changelog-list");
  list.innerHTML = APP_CHANGELOG.map((entry) => `
    <div class="changelog-entry">
      <span class="cv">Version ${escapeHtml(entry.version)}</span>
      ${entry.groups.map((g) => `
        <div class="changelog-group">
          <div class="cg-title">${escapeHtml(g.title)}</div>
          <ul class="cg-items">${g.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
        </div>
      `).join("")}
    </div>
  `).join("");
}

function renderHeaderUser() {
  const el = document.getElementById("header-user");
  if (!el) return;
  if (!currentUsername) { el.textContent = ""; return; }
  const name = (currentVorname || currentNachname)
    ? `${currentVorname || ""} ${currentNachname || ""}`.trim()
    : currentUsername;
  el.textContent = "👤 " + name + (currentIsAdmin ? " (Admin)" : "");
}

function activateTab(name) {
  document.querySelectorAll("nav button[data-tab]").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-section").forEach((s) => s.classList.remove("active"));
  document.querySelector(`nav button[data-tab="${name}"]`).classList.add("active");
  document.getElementById("tab-" + name).classList.add("active");
}

function setupTabs() {
  document.querySelectorAll("nav button[data-tab]").forEach((b) => {
    b.addEventListener("click", () => activateTab(b.dataset.tab));
  });
}

// Geteiltes Flotten-Muster: .editor-only hängt am Bearbeiten-Recht,
// .admin-only am Administrieren-Recht. Der Info-Reiter trägt keine der beiden
// Klassen und bleibt deshalb immer sichtbar.
function applyAdminVisibility() {
  document.querySelectorAll(".editor-only").forEach((el) => {
    el.style.display = canEdit() ? "" : "none";
  });
  document.querySelectorAll(".admin-only").forEach((el) => {
    el.style.display = canAdmin() ? "" : "none";
  });
}

function renderAlles() {
  if (bildschirmGeraeumt) return;
  fuelleFilterListen();
  renderBoerse();
  if (canEdit()) { renderFreigabe(); renderAnfragen(); }
  if (canAdmin()) renderEinstellungen();
}

// ---------- Start ----------

function startApp() {
  appLaeuft = true;
  document.getElementById("connect-screen").style.display = "none";
  document.getElementById("app-shell").style.display = "block";
}

// ---------- Sitzungsverlust: räumen, nicht nur verstecken ----------

// ⚠️ Verstecken ist nicht Räumen. Fällt die Sitzung weg, WÄHREND die App
// offen ist, steht bereits alles auf dem Bildschirm. display:none macht das
// unsichtbar, nicht weg -- Namen, Nummern und ausgefüllte Formularfelder sind
// im Seitenquelltext weiter lesbar.
//
// ⚠️ Über die CONTAINER räumen, nie über eine Id-Liste. Eine Liste veraltet
// lautlos: wer später ein Feld ergänzt, müsste daran denken, und genau das eine
// bliebe stehen.
//
// ⚠️ Dialoge, Druckbereich und Bild-Lightbox stehen NEBEN der Hülle, nicht
// darin -- ihr innerHTML erwischt sie nicht. Ein offener Dialog ist dabei der
// schlimmste Fall: er steht nicht nur gespeichert, sondern SICHTBAR da.
//
// Wegwerfen ist gefahrlos: zurück in die App geht es ausschließlich über ein
// Neuladen der Seite. Wer sich neu anmeldet, bekommt sie ohnehin frisch.
let bildschirmGeraeumt = false;

// Vor dem ersten Aufbau gibt es nichts zu räumen -- und wer gar nicht angemeldet
// ist, soll nicht "Sitzung abgelaufen" lesen. Gesetzt wird das erst, wenn die
// Hülle wirklich sichtbar wird.
let appLaeuft = false;

function raeumeBildschirm() {
  bildschirmGeraeumt = true;
  const huelle = document.getElementById("app-shell");
  if (huelle) huelle.innerHTML = "";
  // ⚠️ #header-user steht in vier Apps im Seitenkopf und damit NEBEN der
  // Hülle -- der Name des Angemeldeten blieb dort nach dem Sitzungsverlust
  // stehen. Der Rest des Kopfes (Titel, Logo, Zurück-Link) bleibt absichtlich:
  // ohne ihn stünde man vor einer weißen Seite ohne Weg zurück.
  document.querySelectorAll(".modal-overlay, .overlay, #print-area, .foto-lightbox, #header-user").forEach((el) => {
    el.innerHTML = "";
    el.classList.add("hidden");
    el.style.display = "none";
  });
}

// ⚠️ Gerufen aus db.js -- an der EINEN Stelle, an der die 401 ankommt. Sonst
// müsste jeder einzelne Fehlerweg daran denken, und einer vergisst es.
function raeumeBeiSitzungsverlust() {
  if (!appLaeuft) return;
  showConnectScreen("Die Sitzung ist abgelaufen. Bitte über die Tools-Übersicht neu anmelden.");
}

function showConnectScreen(errorMsg) {
  raeumeBildschirm();
  document.getElementById("connect-screen").style.display = "block";
  document.getElementById("app-shell").style.display = "none";
  const err = document.getElementById("cloud-error");
  err.style.display = errorMsg ? "block" : "none";
  err.textContent = errorMsg || "";
}

async function init() {
  document.getElementById("version-badge-2").textContent = "v" + APP_VERSION;
  renderChangelog();
  setupTabs();

  document.getElementById("filter-art").addEventListener("change", (e) => { filterArt = e.target.value; renderBoerse(); });
  document.getElementById("filter-groesse").addEventListener("change", (e) => { filterGroesse = e.target.value; renderBoerse(); });
  document.getElementById("filter-status").addEventListener("change", (e) => { filterStatus = e.target.value; renderBoerse(); });

  // Ein Klick auf ein Bild öffnet es groß — in jedem Raster gleich.
  document.querySelectorAll(".angebot-grid").forEach((grid) => {
    grid.addEventListener("click", (e) => {
      const img = e.target.closest("img[data-foto-id]");
      if (img && img.src) zeigeFotoGross(img.src);
    });
  });

  document.getElementById("freigabe-grid").addEventListener("click", (e) => {
    const karte = e.target.closest(".angebot-karte");
    if (!karte) return;
    if (e.target.closest(".btn-freigeben")) freigeben(karte.dataset.id);
    else if (e.target.closest(".btn-ablehnen")) ablehnen(karte.dataset.id);
  });
  document.getElementById("verwaltung-grid").addEventListener("click", (e) => {
    const karte = e.target.closest(".angebot-karte");
    if (!karte) return;
    if (e.target.closest(".btn-vergeben")) alsVergeben(karte.dataset.id);
    else if (e.target.closest(".btn-zurueck")) zurueckInDieBoerse(karte.dataset.id);
    else if (e.target.closest(".btn-loeschen")) loeschen(karte.dataset.id);
  });

  document.getElementById("btn-link-erzeugen").addEventListener("click", linkErzeugen);
  document.getElementById("btn-link-widerrufen").addEventListener("click", linkWiderrufen);
  document.getElementById("btn-link-kopieren").addEventListener("click", linkKopieren);
  document.getElementById("btn-hinweis-speichern").addEventListener("click", hinweisSpeichern);
  document.getElementById("btn-add-art").addEventListener("click", () => listeHinzufuegen("arten", "neu-art"));
  document.getElementById("btn-add-groesse").addEventListener("click", () => listeHinzufuegen("groessen", "neu-groesse"));
  document.getElementById("btn-add-zustand").addEventListener("click", () => listeHinzufuegen("zustaende", "neu-zustand"));
  ["chips-arten", "chips-groessen", "chips-zustaende"].forEach((id) => {
    document.getElementById(id).addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-liste]");
      if (btn) listeEntfernen(btn.dataset.liste, btn.dataset.wert);
    });
  });

  if (!getSessionToken()) {
    showConnectScreen();
    return;
  }

  try {
    // Nacheinander statt Promise.all: dav-load liefert das "me" gratis mit, der
    // zweite Aufruf kostet damit gar keinen Request mehr.
    const data = await gatewayLoad();
    const me = await fetchMe();
    currentUsername = me.username;
    currentIsAdmin = !!me.isAdmin;
    currentCanEdit = !!me.canEdit;
    currentCanAdmin = !!me.canAdmin;
    currentVorname = me.vorname || null;
    currentNachname = me.nachname || null;
    appData = normalizeAppData(data);

    applyAdminVisibility();
    startApp();
    renderHeaderUser();
    renderAlles();
  } catch (e) {
    if (e instanceof NotLoggedInError) {
      showConnectScreen();
    } else {
      showConnectScreen("Fehler beim Laden: " + e.message);
    }
  }
}

window.addEventListener("DOMContentLoaded", () => { init(); });
