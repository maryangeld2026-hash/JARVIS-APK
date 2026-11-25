/* Jarvis para Android 3.36 · la pantalla, más ordenada (sin quitar nada):
   panel del micrófono más compacto · «Callar» solo cuando Jarvis habla · «En vivo» junto a «Seguir» ·
   en Ajustes, los tres grupos de respaldo en uno y los grupos repetidos juntos.
   El resto del rediseño está en css/v336.css. Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // ======================================================================== PANEL DEL MICRÓFONO
  /** Fila de arriba: [Seguir] — micrófono — [En vivo] (que se vuelve «Callar» mientras Jarvis piensa o habla).
      Fila de abajo: [adjuntar][escribir][enviar]. */
  function panel() {
    const fila = $(".dock-row"), vivo = $("#btn-live"), seguir = $("#btn-conv"), callar = $("#btn-callar");
    if (!fila || !seguir || !callar) return;
    let izq = $(".dock-izq", fila), der = $(".dock-der", fila);
    if (!izq) { izq = mk("div", "dock-izq"); fila.insertBefore(izq, seguir); izq.append(seguir); }
    if (!der) { der = mk("div", "dock-der"); fila.insertBefore(der, callar); der.append(callar); }
    if (vivo && vivo.parentNode !== der) der.append(vivo);
    const inp = $("#in-texto"); if (inp) inp.placeholder = "Escribe aquí…";
  }

  /** «Callar» se ve mientras Jarvis piensa o habla, y unos segundos después de cada mensaje (para callarlo antes de que empiece). */
  let ultimo = 0;
  function callarVisible() {
    const V = window.JV, st = document.body.dataset.state;
    const on = st === "thinking" || st === "speaking" || !!(V && V.isSpeaking && V.isSpeaking()) || Date.now() - ultimo < 6000;
    if (document.body.classList.contains("puede-callar") !== on) document.body.classList.toggle("puede-callar", on);
  }

  // ======================================================================== AJUSTES: GRUPOS JUNTOS
  const tit = (d) => ((d && d.querySelector("summary")) || {}).textContent || "";
  function pasar(desde, hacia, sub) {
    if (sub) hacia.append(mk("h4", "aj-sub", sub));
    [...desde.childNodes].forEach((n) => { if (!(n.nodeType === 1 && n.tagName === "SUMMARY")) hacia.append(n); });
    desde.remove();
  }
  /** → true si cambió algo (entonces se vuelven a contar los grupos de cada tema). */
  function unir() {
    const sc = $("#ajustes .scroll"); if (!sc) return false;
    let cambio = false;
    const gs = () => [...sc.querySelectorAll("details.aj-grupo")];
    // 1) los tres respaldos (el principal, el gratis en la nube y DeepSeek) en uno solo: «Si la IA principal falla»
    // (cada módulo pone su grupo en momentos distintos: se van uniendo a medida que aparecen)
    const prin = gs().find((d) => /^(?:IA de respaldo|Si la IA principal falla)/.test(tit(d)));
    const gratis = gs().find((d) => /^Respaldo gratis en la nube/.test(tit(d)));
    const ds = gs().find((d) => /^Segunda IA en la nube/.test(tit(d)));
    if (prin && (gratis || ds)) {
      if (!prin.dataset.unido) {
        prin.dataset.unido = "1";
        const resto = [...prin.childNodes].filter((n) => !(n.nodeType === 1 && n.tagName === "SUMMARY"));
        prin.querySelector("summary").textContent = "Si la IA principal falla (respaldo)";
        const intro = mk("p", "hint", "Cuando la IA principal no responde, Jarvis prueba en orden: los respaldos de aquí y, al final, la IA del celular."); intro.dataset.r = "intro";
        const h = mk("h4", "aj-sub", "Tu respaldo y la IA del celular (sin internet)"); h.dataset.r = "tuyo";
        prin.append(intro, h); resto.forEach((n) => prin.append(n));
      }
      if (gratis) {   // va primero, después de la explicación
        const h = mk("h4", "aj-sub", "Gratis en la nube (Groq, OpenRouter, Numes…)"), antes = prin.querySelector('[data-r="tuyo"]');
        prin.insertBefore(h, antes); [...gratis.childNodes].forEach((n) => { if (!(n.nodeType === 1 && n.tagName === "SUMMARY")) prin.insertBefore(n, antes); }); gratis.remove();
      }
      if (ds) pasar(ds, prin, "DeepSeek (de pago, barata)");
      cambio = true;
    }
    // 2) grupos con el mismo nombre (dos módulos que ponían «Memoria»): quedan en uno
    const vistos = {};
    gs().forEach((d) => { const k = tit(d).trim().toLowerCase(); if (!k) return; if (vistos[k] && vistos[k] !== d) { pasar(d, vistos[k], ""); cambio = true; } else vistos[k] = d; });
    return cambio;
  }

  // ======================================================================== ENGANCHES
  const base = { init: X.init, settings: X.settings };
  X.settings = function () { try { base.settings(); } catch (e) { console.error(e); } };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    const M = X._mejoras;
    if (M && M.ordenarAjustes && !M.ordenarAjustes.u336) {
      const prev = M.ordenarAjustes;
      M.ordenarAjustes = function () { prev(); try { if (unir()) prev(); } catch (e) { console.error(e); } };
      M.ordenarAjustes.u336 = true;
    }
    panel(); setTimeout(panel, 1500);
    const ch = $("#chat"); if (ch) new MutationObserver((ms) => { const n = ms.reduce((k, m) => k + [...m.addedNodes].filter((x) => x.classList && x.classList.contains("msg")).length, 0); if (n > 0 && n <= 2) { ultimo = Date.now(); callarVisible(); } }).observe(ch, { childList: true });   // (al redibujar todo el chat no cuenta)
    new MutationObserver(callarVisible).observe(document.body, { attributes: true, attributeFilter: ["data-state"] });
    if (window.JEVERY) window.JEVERY(400, callarVisible);   // (se detiene sola con Jarvis fuera de la pantalla)
    // las sugerencias del inicio salen del HUD, que arranca después del primer dibujo
    if (!(D.chat || []).length && A.renderChat) { try { A.renderChat(); } catch (e) { console.error(e); } }
  };
  X._interfaz = { panel, unir };
})();
