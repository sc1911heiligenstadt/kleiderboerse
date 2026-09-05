// Kleiderbörse — Eltern-Seite OHNE Anmeldung.
//
// Diese Datei kennt bewusst KEIN Session-Token und liest nie localStorage. Der
// einzige Ausweis ist der geheime Schlüssel aus der URL (?t=…), den der Worker
// gegen meta.externToken der App-Datei prüft. Alle Aktionen heißen kbo-extern-*
// und laufen ohne Authorization-Header.
//
// ⚠️ Was hier ankommt, ist bereits vom Worker gefiltert: er liefert von einem
// Angebot nur die öffentlichen Felder aus. Name und E-Mail der anbietenden
// Familie verlassen den Worker nie in Richtung dieser Seite — das Ausblenden
// passiert serverseitig, nicht hier im Browser.

const GATEWAY_URL = "https://landingpage.michel-brunner.workers.dev";

const MAX_FOTOS = 3;
const FOTO_MAX_KANTE = 1200;   // längste Kante nach dem Verkleinern
const FOTO_JPEG_QUALITAET = 0.82;

let externToken = "";
let listen = { arten: [], groessen: [], zustaende: [] };
let angebote = [];
let filterArt = "";
let filterGroesse = "";
// Die im Formular ausgewählten Fotos: { blob, contentType, vorschauUrl }
let gewaehlteFotos = [];
let offenerSlot = -1;
let anfrageAngebotId = null;
let sendetGerade = false;

// ---------- Helfer ----------

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function el(id) { return document.getElementById(id); }

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : ((r & 0x3) | 0x8)).toString(16);
  });
}

async function externRequest(payload) {
  let resp;
  try {
    resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (_) {
    throw new Error("Keine Verbindung. Bitte Internet prüfen und noch einmal versuchen.");
  }
  if (!resp.ok) {
    let msg = "";
    try { const b = await resp.json(); msg = b && b.error ? b.error : ""; } catch (_) {}
    throw new Error(msg || "Es hat nicht geklappt (Fehler " + resp.status + ").");
  }
  return resp.json();
}

function zeigeFehlerseite(text) {
  el("sec-laedt").style.display = "none";
  el("sec-boerse").style.display = "none";
  el("sec-weg").style.display = "none";
  el("sec-fehler").style.display = "block";
  if (text) el("fehler-text").textContent = text;
}

// ---------- Fotos ----------

// Ein Handy-Foto hat schnell 4000 Pixel Kantenlänge und mehrere Megabyte. Für
// eine Börsen-Karte reichen 1200 Pixel; das spart Upload-Zeit im Mobilfunk und
// hält die Vereins-Nextcloud klein. Verkleinert wird IM BROWSER, bevor
// irgendetwas das Gerät verlässt.
function verkleinereBild(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width: w, height: h } = img;
      if (w > FOTO_MAX_KANTE || h > FOTO_MAX_KANTE) {
        const f = FOTO_MAX_KANTE / Math.max(w, h);
        w = Math.round(w * f);
        h = Math.round(h * f);
      }
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext("2d");
      // Weißer Grund: ein transparentes PNG würde sonst als schwarze Fläche
      // im JPEG landen.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      cv.toBlob((blob) => {
        if (!blob) { reject(new Error("Das Bild konnte nicht verarbeitet werden.")); return; }
        resolve({ blob, contentType: "image/jpeg" });
      }, "image/jpeg", FOTO_JPEG_QUALITAET);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Diese Datei ist kein Bild, das der Browser anzeigen kann."));
    };
    img.src = url;
  });
}

function blobZuBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      const komma = s.indexOf(",");
      resolve(komma >= 0 ? s.slice(komma + 1) : s);
    };
    r.onerror = () => reject(new Error("Das Bild konnte nicht gelesen werden."));
    r.readAsDataURL(blob);
  });
}

function renderFotoSlots() {
  const box = el("foto-slots");
  const anzahl = Math.min(gewaehlteFotos.length + 1, MAX_FOTOS);
  let html = "";
  for (let i = 0; i < anzahl; i++) {
    const f = gewaehlteFotos[i];
    if (f) {
      html += '<div class="foto-slot" data-slot="' + i + '">' +
              '<img src="' + f.vorschauUrl + '" alt="Foto ' + (i + 1) + '" />' +
              '<button type="button" class="foto-weg" data-weg="' + i + '" title="Foto entfernen">&times;</button></div>';
    } else {
      html += '<div class="foto-slot" data-slot="' + i + '">+</div>';
    }
  }
  box.innerHTML = html;
}

// ---------- Börse rendern ----------

function fuelleAuswahl(selId, werte, mitAlle) {
  const s = el(selId);
  if (!s) return;
  s.innerHTML = (mitAlle ? '<option value="">Alle</option>' : '<option value="">Bitte wählen</option>') +
    werte.map((w) => '<option value="' + escapeHtml(w) + '">' + escapeHtml(w) + "</option>").join("");
}

function sichtbareAngebote() {
  return angebote.filter((a) => {
    if (filterArt && a.art !== filterArt) return false;
    if (filterGroesse && a.groesse !== filterGroesse) return false;
    return true;
  });
}

function renderBoerse() {
  const grid = el("boerse-grid");
  const leer = el("boerse-empty");
  const liste = sichtbareAngebote();
  leer.style.display = liste.length ? "none" : "block";
  grid.innerHTML = liste.map((a) => {
    const haupt = (a.fotos || [])[0];
    const weitere = (a.fotos || []).slice(1);
    const bild = haupt
      ? '<img class="angebot-bild" data-foto="' + escapeHtml(haupt) + '" data-angebot="' + escapeHtml(a.id) + '" alt="' + escapeHtml(a.art) + '" />'
      : '<div class="angebot-bild-leer">kein Foto</div>';
    const thumbs = weitere.length
      ? '<div class="angebot-thumbs">' + weitere.map((fid) =>
          '<img data-foto="' + escapeHtml(fid) + '" data-angebot="' + escapeHtml(a.id) + '" alt="weiteres Foto" />').join("") + "</div>"
      : "";
    return '<div class="angebot-karte" data-id="' + escapeHtml(a.id) + '">' + bild + thumbs +
      '<div class="angebot-body">' +
        '<div class="angebot-titel">' + escapeHtml(a.art || "Kleidungsstück") + "</div>" +
        '<div class="angebot-meta">Größe ' + escapeHtml(a.groesse || "?") + " &middot; " + escapeHtml(a.zustand || "") + "</div>" +
        (a.bemerkung ? '<div class="angebot-bemerkung">' + escapeHtml(a.bemerkung) + "</div>" : "") +
        '<div class="angebot-actions">' +
          '<button type="button" class="btn success small btn-will-ich">Das möchte ich</button>' +
        "</div>" +
      "</div></div>";
  }).join("");
  ladeFotosNach(grid);
}

// Fotos einzeln nachladen. Der Worker liefert sie nur für freigegebene
// Angebote aus und nur zu einem gültigen Link — deshalb ein POST mit Token
// statt einer raten-baren Bild-URL.
const fotoUrlCache = new Map();

async function holeFotoUrl(angebotId, fotoId) {
  const key = angebotId + "/" + fotoId;
  if (fotoUrlCache.has(key)) return fotoUrlCache.get(key);
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "kbo-extern-foto-get", token: externToken, angebotId, fotoId })
  });
  if (!resp.ok) throw new Error("Foto nicht ladbar");
  const url = URL.createObjectURL(await resp.blob());
  fotoUrlCache.set(key, url);
  return url;
}

function ladeFotosNach(container) {
  container.querySelectorAll("img[data-foto]:not([data-geladen])").forEach(async (img) => {
    img.dataset.geladen = "1";
    try {
      img.src = await holeFotoUrl(img.dataset.angebot, img.dataset.foto);
    } catch (_) {
      img.remove();
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

// ---------- Angebot abschicken ----------

function formFehler(msg) {
  const e = el("form-error");
  e.style.display = msg ? "block" : "none";
  e.textContent = msg || "";
}

async function angebotAbschicken() {
  if (sendetGerade) return;
  formFehler("");

  const art = el("f-art").value;
  const groesse = el("f-groesse").value;
  const zustand = el("f-zustand").value;
  const bemerkung = el("f-bemerkung").value.trim();
  const vorname = el("f-vorname").value.trim();
  const nachname = el("f-nachname").value.trim();
  const email = el("f-email").value.trim();

  if (!gewaehlteFotos.length) { formFehler("Bitte mindestens ein Foto auswählen."); return; }
  if (!art) { formFehler("Bitte auswählen, was es ist."); return; }
  if (!groesse) { formFehler("Bitte die Größe auswählen."); return; }
  if (!zustand) { formFehler("Bitte den Zustand auswählen."); return; }
  if (!vorname || !nachname) { formFehler("Bitte Vorname und Nachname angeben."); return; }
  // Absichtlich nur eine grobe Form-Prüfung: ohne brauchbare Adresse käme keine
  // Anfrage an, mit einer strengen Regel fielen gültige Adressen durch.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { formFehler("Bitte eine gültige E-Mail-Adresse angeben."); return; }

  sendetGerade = true;
  const btn = el("btn-anbieten");
  btn.disabled = true;
  btn.textContent = "Wird hochgeladen …";

  try {
    // Erst die Bilddateien, dann der Eintrag. Bricht es dazwischen ab, liegt
    // höchstens eine Bilddatei ohne Angebot in der Nextcloud — kein halbes
    // Angebot ohne Bilder, das ein Bearbeiter freigeben könnte.
    const fotoMeta = [];
    for (let i = 0; i < gewaehlteFotos.length; i++) {
      const f = gewaehlteFotos[i];
      btn.textContent = "Foto " + (i + 1) + " von " + gewaehlteFotos.length + " …";
      const id = uuid();
      await externRequest({
        action: "kbo-extern-foto-put",
        token: externToken,
        id,
        contentType: f.contentType,
        dataBase64: await blobZuBase64(f.blob)
      });
      fotoMeta.push({ id, contentType: f.contentType });
    }

    btn.textContent = "Angebot wird gespeichert …";
    await externRequest({
      action: "kbo-extern-anbieten",
      token: externToken,
      art, groesse, zustand, bemerkung,
      vorname, nachname, email,
      fotos: fotoMeta
    });

    formularZuruecksetzen();
    alert("Danke! Dein Angebot wurde übermittelt. Der Verein sieht es sich an und stellt es dann in die Börse.");
    zeigeAnsicht("boerse");
  } catch (e) {
    formFehler(e.message);
  } finally {
    sendetGerade = false;
    btn.disabled = false;
    btn.textContent = "Angebot abschicken";
  }
}

function formularZuruecksetzen() {
  gewaehlteFotos.forEach((f) => URL.revokeObjectURL(f.vorschauUrl));
  gewaehlteFotos = [];
  renderFotoSlots();
  ["f-bemerkung"].forEach((id) => { el(id).value = ""; });
  el("f-art").value = "";
  el("f-groesse").value = "";
  el("f-zustand").value = "";
  // Name und E-Mail bleiben absichtlich stehen: wer ein Teil einstellt, stellt
  // oft gleich das nächste ein.
  formFehler("");
}

// ---------- Anfrage ----------

function anfrageOeffnen(angebotId) {
  const a = angebote.find((x) => x.id === angebotId);
  if (!a) return;
  anfrageAngebotId = angebotId;
  el("anfrage-titel").textContent = (a.art || "Kleidungsstück") + ", Größe " + (a.groesse || "?");
  el("anfrage-error").style.display = "none";
  el("anfrage-overlay").style.display = "flex";
}

function anfrageSchliessen() {
  el("anfrage-overlay").style.display = "none";
  anfrageAngebotId = null;
}

async function anfrageSenden() {
  if (sendetGerade || !anfrageAngebotId) return;
  const fehler = el("anfrage-error");
  fehler.style.display = "none";

  const vorname = el("q-vorname").value.trim();
  const nachname = el("q-nachname").value.trim();
  const email = el("q-email").value.trim();
  const telefon = el("q-telefon").value.trim();
  const nachricht = el("q-nachricht").value.trim();

  const zeige = (m) => { fehler.style.display = "block"; fehler.textContent = m; };
  if (!vorname || !nachname) { zeige("Bitte Vorname und Nachname angeben."); return; }
  if (!email && !telefon) { zeige("Bitte eine E-Mail-Adresse oder eine Telefonnummer angeben."); return; }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { zeige("Diese E-Mail-Adresse sieht nicht richtig aus."); return; }

  sendetGerade = true;
  const btn = el("btn-anfrage-senden");
  btn.disabled = true;
  btn.textContent = "Wird gesendet …";
  try {
    await externRequest({
      action: "kbo-extern-anfragen",
      token: externToken,
      angebotId: anfrageAngebotId,
      vorname, nachname, email, telefon, nachricht
    });
    anfrageSchliessen();
    ["q-nachricht"].forEach((id) => { el(id).value = ""; });
    alert("Deine Anfrage ist unterwegs. Die anbietende Familie meldet sich bei dir.");
  } catch (e) {
    zeige(e.message);
  } finally {
    sendetGerade = false;
    btn.disabled = false;
    btn.textContent = "Anfrage senden";
  }
}

// ---------- Ansicht umschalten ----------

function zeigeAnsicht(welche) {
  el("ansicht-boerse").style.display = welche === "boerse" ? "" : "none";
  el("ansicht-formular").style.display = welche === "formular" ? "" : "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- „Ist weg“-Link aus der E-Mail ----------

async function wegModus(wegToken) {
  el("sec-laedt").style.display = "none";
  el("sec-weg").style.display = "block";

  // Diese Seite kennt nur den ?weg=-Schlüssel, nicht den Börsen-Schlüssel ?t=.
  // Ein Link zurück würde deshalb auf spieler.html OHNE Parameter zeigen — und
  // dort meldet init() "Dieser Link ist unvollständig oder nicht mehr gültig".
  // Also gar nicht navigieren, sondern den Abschnitt mit einem Satz schließen.
  function abschliessen(satz) {
    el("weg-status").textContent = satz + " Du kannst dieses Fenster jetzt schließen.";
    el("btn-weg-bestaetigen").style.display = "none";
    el("btn-weg-abbrechen").style.display = "none";
  }

  el("btn-weg-abbrechen").addEventListener("click", () => {
    abschliessen("Alles klar — das Angebot bleibt in der Börse.");
  });

  el("btn-weg-bestaetigen").addEventListener("click", async () => {
    const btn = el("btn-weg-bestaetigen");
    btn.disabled = true;
    btn.textContent = "Einen Moment …";
    try {
      await externRequest({ action: "kbo-extern-weg", wegToken });
      abschliessen("Erledigt – das Kleidungsstück steht nicht mehr in der Börse. Danke!");
    } catch (e) {
      el("weg-status").textContent = e.message;
      btn.disabled = false;
      btn.textContent = "Ja, es ist vergeben";
    }
  });

  try {
    const body = await externRequest({ action: "kbo-extern-weg-info", wegToken });
    el("weg-info").textContent = body.beschreibung
      ? "Es geht um: " + body.beschreibung
      : "Dieses Angebot wird aus der Börse genommen.";
    if (body.schonWeg) {
      abschliessen("Dieses Kleidungsstück steht bereits nicht mehr in der Börse.");
    }
  } catch (e) {
    el("weg-info").textContent = "";
    el("weg-status").textContent = e.message;
    el("btn-weg-bestaetigen").style.display = "none";
    el("btn-weg-abbrechen").style.display = "none";
  }
}

// ---------- Start ----------

async function init() {
  const params = new URLSearchParams(location.search);
  const wegToken = params.get("weg") || "";
  externToken = params.get("t") || "";

  if (wegToken) {
    if (!/^[0-9a-f]{32,64}$/.test(wegToken)) {
      zeigeFehlerseite("Dieser Link ist unvollständig. Bitte ihn aus der E-Mail noch einmal ganz öffnen.");
      return;
    }
    await wegModus(wegToken);
    return;
  }

  if (!/^[0-9a-f]{64}$/.test(externToken)) {
    zeigeFehlerseite("Dieser Link ist unvollständig oder nicht mehr gültig. Bitte beim Verein nach dem aktuellen Link fragen.");
    return;
  }

  try {
    const body = await externRequest({ action: "kbo-extern-start", token: externToken });
    listen = body.listen || { arten: [], groessen: [], zustaende: [] };
    angebote = Array.isArray(body.angebote) ? body.angebote : [];

    if (body.hinweis) {
      el("hinweis-text").textContent = body.hinweis;
      el("hinweis-karte").style.display = "block";
    }

    fuelleAuswahl("filter-art", listen.arten, true);
    fuelleAuswahl("filter-groesse", listen.groessen, true);
    fuelleAuswahl("f-art", listen.arten, false);
    fuelleAuswahl("f-groesse", listen.groessen, false);
    fuelleAuswahl("f-zustand", listen.zustaende, false);

    el("sec-laedt").style.display = "none";
    // Auch die Fehlerseite ausdruecklich wegnehmen: sonst stuenden bei einem
    // spaeteren zweiten Anlauf beide Abschnitte untereinander.
    el("sec-fehler").style.display = "none";
    el("sec-boerse").style.display = "block";
    renderFotoSlots();
    renderBoerse();
  } catch (e) {
    zeigeFehlerseite(e.message);
    return;
  }

  el("btn-zeige-boerse").addEventListener("click", () => zeigeAnsicht("boerse"));
  el("btn-zeige-formular").addEventListener("click", () => zeigeAnsicht("formular"));

  el("filter-art").addEventListener("change", (e) => { filterArt = e.target.value; renderBoerse(); });
  el("filter-groesse").addEventListener("change", (e) => { filterGroesse = e.target.value; renderBoerse(); });

  el("boerse-grid").addEventListener("click", (e) => {
    if (e.target.closest(".btn-will-ich")) {
      const karte = e.target.closest(".angebot-karte");
      if (karte) anfrageOeffnen(karte.dataset.id);
      return;
    }
    const img = e.target.closest("img[data-foto]");
    if (img && img.src) zeigeFotoGross(img.src);
  });

  // Foto-Auswahl: ein verstecktes file-input, das je Slot geöffnet wird.
  el("foto-slots").addEventListener("click", (e) => {
    const weg = e.target.closest("button[data-weg]");
    if (weg) {
      const i = Number(weg.dataset.weg);
      URL.revokeObjectURL(gewaehlteFotos[i].vorschauUrl);
      gewaehlteFotos.splice(i, 1);
      renderFotoSlots();
      return;
    }
    const slot = e.target.closest(".foto-slot");
    if (!slot) return;
    offenerSlot = Number(slot.dataset.slot);
    el("foto-input").value = "";  // damit dieselbe Datei erneut wählbar bleibt
    el("foto-input").click();
  });

  el("foto-input").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    formFehler("");
    try {
      const { blob, contentType } = await verkleinereBild(file);
      const eintrag = { blob, contentType, vorschauUrl: URL.createObjectURL(blob) };
      if (offenerSlot >= 0 && offenerSlot < gewaehlteFotos.length) {
        URL.revokeObjectURL(gewaehlteFotos[offenerSlot].vorschauUrl);
        gewaehlteFotos[offenerSlot] = eintrag;
      } else if (gewaehlteFotos.length < MAX_FOTOS) {
        gewaehlteFotos.push(eintrag);
      }
      renderFotoSlots();
    } catch (err) {
      formFehler(err.message);
    }
  });

  el("btn-anbieten").addEventListener("click", angebotAbschicken);
  el("btn-anfrage-senden").addEventListener("click", anfrageSenden);
  el("btn-anfrage-abbrechen").addEventListener("click", anfrageSchliessen);
}

window.addEventListener("DOMContentLoaded", () => { init(); });
