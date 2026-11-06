/* Jarvis para Android 3.21 · el núcleo: quién responde (nube o celular) a la vista, cambio automático, y el diseño «Cristal».
   · Una etiqueta arriba dice si responde la nube (Gemini u otra) o la IA del celular, y avisa cuando cambia sola.
   · Ajustes › Diseño: Cristal (con desenfoque), Cristal ligero (sin desenfoque, gasta menos) o Clásico.
   Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const IA = window.JIA;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();

  // ======================================================================== DISEÑO
  function aplicarDiseno() {
    const d = D.ajustes.diseno || "cristal", css = $("#css-cristal");
    if (css) css.disabled = d === "clasico";
    document.body.classList.toggle("cr-ligero", d === "ligero" || (d === "cristal" && !!D.ajustes.ahorroActivo));
  }

  // ======================================================================== QUIÉN RESPONDE
  let chip = null, primera = true;
  const nombreNube = () => { try { const p = (window.JL.PROVIDERS[D.ajustes.proveedor] || {}).nombre || "Nube"; return p.replace(/^Google /, "").replace(/ \(.*$/, ""); } catch (e) { return "Nube"; } };
  function pintar(modo) {
    if (!chip) return;
    const m = modo || (IA && IA.plan ? (IA.plan()[0] === "local" ? "local" : navigator.onLine ? "nube" : "sin") : "nube");
    chip.dataset.m = m;
    chip.textContent = m === "local" ? "LOCAL" : m === "sin" ? "SIN RED" : "NUBE";
    chip.title = m === "local" ? "Responde la IA del celular (sin internet)" : m === "sin" ? "Sin internet y sin IA del celular" : "Responde la IA en la nube (" + nombreNube() + ")";
    chip.setAttribute("aria-label", chip.title);
  }
  function cambio(ev) {
    const d = (ev && ev.detail) || {};
    pintar(d.modo);
    if (primera) { primera = false; if (d.modo === "nube") return; }
    if (D.ajustes.iaAuto === false) return;
    if (d.modo === "local") A.toast("📱 Sin internet o conexión lenta: sigo con la IA del celular.", 3500);
    else if (d.modo === "nube") A.toast("☁ Volvió la conexión: respondo con " + nombreNube() + ".", 3000);
    else if (d.modo === "sin") A.toast("⚠ Sin internet. Las órdenes de la app siguen funcionando; para conversar sin internet descarga la IA del celular.", 5000);
  }

  // ======================================================================== AJUSTES
  function ajustes() {
    const box = $("#aj2"); if (!box || $("#aj-321")) return;
    const sec = mk("div"); sec.id = "aj-321";
    sec.append(mk("h3", "sub", "Diseño y rapidez"));
    const sd = mk("select", "inp"); [["cristal", "Cristal (vidrio con desenfoque)"], ["ligero", "Cristal ligero (sin desenfoque: más fluido y gasta menos)"], ["clasico", "Clásico"]].forEach(([k, t]) => sd.append(new Option(t, k)));
    sd.value = D.ajustes.diseno || "cristal"; sd.addEventListener("change", () => { D.ajustes.diseno = sd.value; save(); aplicarDiseno(); }); sec.append(sd);
    const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = D.ajustes.iaAuto !== false;
    i.addEventListener("change", () => { D.ajustes.iaAuto = i.checked; save(); pintar(); });
    l.append(i, document.createTextNode(" Cambiar solo entre la nube y la IA del celular (sin internet, conexión lenta, falla o se acabó el cupo)")); sec.append(l);
    sec.append(mk("p", "hint", "Si tienes una IA del celular descargada, Jarvis la usa sola cuando la nube no puede, aunque no la hayas puesto de respaldo, y vuelve a la nube cuando regresa la conexión."));
    box.append(sec);
  }

  // ======================================================================== ENGANCHES
  const base = { init: X.init, settings: X.settings };
  X.settings = function () {
    try { base.settings(); } catch (e) { console.error(e); }
    try { ajustes(); if (X._mejoras && X._mejoras.ordenarAjustes) X._mejoras.ordenarAjustes(); } catch (e) { console.error(e); }
  };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    aplicarDiseno();
    const top = $(".top"), st = $("#status");
    if (top && st && !$("#motor")) { chip = mk("span", "motor"); chip.id = "motor"; top.insertBefore(chip, st); }
    pintar();
    window.addEventListener("jarvis-ia", cambio);
    window.addEventListener("online", () => setTimeout(() => pintar(), 300));
    window.addEventListener("offline", () => setTimeout(() => pintar(), 300));
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { pintar(); aplicarDiseno(); } });
    setTimeout(() => pintar(), 3500);                                                    // cuando ya se sabe si hay IA del celular
  };
  X._n321 = { pintar, aplicarDiseno };
})();
