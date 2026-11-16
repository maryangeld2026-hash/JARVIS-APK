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

  // ======================================================================== 3.23: AJUSTES POR TEMAS
  // Arriba, tarjetas grandes por tema; al tocar una, solo se ven sus ajustes (con «‹ Ajustes» para volver). El buscador busca en todo.
  let tema = "";
  function organizar() {
    const sc = $("#ajustes .scroll"), L14 = window.JL14; if (!sc || !L14) return;
    const grupos = [...sc.querySelectorAll("details.aj-grupo")];
    grupos.forEach((d) => { if (!d.dataset.tema) { const sm = d.querySelector("summary"); d.dataset.tema = L14.temaDe(sm ? sm.textContent : ""); } });
    let home = $("#aj-home", sc);
    if (!home) {
      home = mk("div", "aj-home"); home.id = "aj-home";
      const bar = mk("div", "aj-volver"); bar.id = "aj-volver"; bar.hidden = true;
      const back = mk("button", "chip", "‹ Ajustes"); back.type = "button"; back.addEventListener("click", () => ver(""));
      bar.append(back, mk("b", "", "")); 
      const b = $("#aj-buscar", sc); (b ? b.after.bind(b) : sc.prepend.bind(sc))(home); home.after(bar);
      if (b) b.addEventListener("input", () => { if (b.value.trim()) { home.hidden = true; bar.hidden = true; } else ver(tema); });
      // si algo abre un grupo escondido (un botón de otra parte de la app), se muestra su tema
      sc.addEventListener("toggle", (ev) => { const d = ev.target; if (d.matches && d.matches("details.aj-grupo") && d.open && d.hidden && !(b && b.value.trim())) ver(abiertos(d)); }, true);
    }
    // lo más usado de «Voz y conversación» va primero
    const barV = $("#aj-volver", sc);
    if (barV) [...grupos].reverse().forEach((d) => { const sm = d.querySelector("summary"); if (sm && /^(?:Conversación|Formas de llamar)/.test(sm.textContent) && d.previousElementSibling !== barV && !d.dataset.arriba) { d.dataset.arriba = "1"; barV.after(d); } });
    home.textContent = "";
    const doc = D.ajustes.docente === true;
    L14.TEMAS.forEach(([k, ic, t, ex]) => {
      const n = grupos.filter((d) => d.dataset.tema === k).length;
      if (!n || (k === "docente" && !doc)) return;
      const c = mk("button", "aj-tema"); c.type = "button"; c.dataset.tema = k;
      c.append(mk("span", "aj-ic", ic), mk("b", "", t), mk("small", "", ex));
      c.addEventListener("click", () => ver(k));
      home.append(c);
    });
    ver(tema);
  }
  let abrirT = 0, abrirTema = "";
  function abiertos(d) { const ahora = Date.now(); const k = d.dataset.tema; const r = ahora - abrirT < 80 && abrirTema && abrirTema !== k ? "*" : k; abrirT = ahora; abrirTema = r === "*" ? "*" : k; return r; }
  function ver(k) {
    tema = k || "";
    const sc = $("#ajustes .scroll"), L14 = window.JL14; if (!sc || !L14) return;
    const home = $("#aj-home", sc), bar = $("#aj-volver", sc), b = $("#aj-buscar", sc);
    if (b && b.value.trim()) return;
    [...sc.querySelectorAll("details.aj-grupo")].forEach((d) => { d.hidden = !tema || (tema !== "*" && d.dataset.tema !== tema); });
    if (home) home.hidden = !!tema;
    if (bar) { bar.hidden = !tema; const t = L14.TEMAS.find((x) => x[0] === tema); $("b", bar).textContent = tema === "*" ? "Todos" : t ? t[1] + " " + t[2] : ""; }
    if (tema && tema !== "*") { const ds = [...sc.querySelectorAll(`details.aj-grupo[data-tema="${tema}"]`)]; if (ds.length === 1) ds[0].open = true; }
    sc.scrollTop = 0;
  }

  // ======================================================================== 3.23: FORMAS DE LLAMAR A JARVIS
  function formas(sec) {
    const L14 = window.JL14, T = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() ? window.Capacitor.Plugins.Telefono : null;
    sec.append(mk("h3", "sub", "Formas de llamar a Jarvis"));
    sec.append(mk("p", "hint", "Todas, menos decir «Jarvis», no gastan batería: Android solo avisa cuando las usas."));
    const lista = mk("div", "formas");
    L14.FORMAS.forEach(([k, t, como, bat]) => {
      const f = mk("div", "forma"); f.dataset.k = k;
      const cab = mk("div", "forma-h"); cab.append(mk("b", "", t), mk("span", "bat " + (bat === "nada" ? "b0" : bat === "muy poca" ? "b1" : "b2"), bat === "nada" ? "🔋 nada" : bat === "muy poca" ? "🔋 muy poca" : "🔋 media"));
      f.append(cab, mk("small", "", como));
      if (k === "volumen" && T && T.atajoVolumen) {
        const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.id = "atajo-vol"; i.checked = !!D.ajustes.atajoVolumen;
        i.addEventListener("change", async () => {
          D.ajustes.atajoVolumen = i.checked; save();
          try { const r = await T.atajoVolumen({ on: i.checked }); if (i.checked && !r.activo) { A.toast("Prende el control por voz de Jarvis (Accesibilidad) para que funcione.", 6000); if (T.abrirAccesibilidad) T.abrirAccesibilidad(); } else if (i.checked) A.toast("Listo: mantén presionado bajar volumen 1 segundo para llamarme.", 4500); } catch (e) { /* nada */ }
        });
        l.append(i, document.createTextNode(" Activar")); f.append(l);
      }
      if ((k === "asistente" || k === "audifonos") && T && T.ajustesAsistente) { const b = mk("button", "btn small", "Escoger Jarvis como asistente"); b.type = "button"; b.addEventListener("click", () => T.ajustesAsistente().catch(() => {})); f.append(b); }
      if (k === "palabra") { const b = mk("button", "btn small", "Configurar"); b.type = "button"; b.addEventListener("click", () => { const d = [...document.querySelectorAll("#ajustes details.aj-grupo")].find((x) => /segundo plano/i.test((x.querySelector("summary") || {}).textContent || "")); if (d) { ver("voz"); d.open = true; d.scrollIntoView({ block: "start" }); } }); f.append(b); }
      lista.append(f);
    });
    sec.append(lista);
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
    // 3.23: conversación
    const s2 = mk("div"); s2.id = "aj-323";
    s2.append(mk("h3", "sub", "Conversación"));
    const sm = mk("select", "inp"); sm.id = "aj-modoconv"; [["auto", "En tiempo real cuando se pueda (Gemini en vivo) · recomendado"], ["vivo", "Siempre en tiempo real"], ["normal", "Normal (pregunta y respuesta)"]].forEach(([k, t]) => sm.append(new Option(t, k)));
    sm.value = D.ajustes.modoConv || "auto"; sm.addEventListener("change", () => { D.ajustes.modoConv = sm.value; D.ajustes.vivoFallaT = 0; save(); }); s2.append(sm);
    s2.append(mk("p", "hint", "En tiempo real hablas como en una llamada: Jarvis contesta al instante, lo interrumpes cuando quieras, hace las órdenes de la app y busca en Google lo actual. Cuelga solo tras 45 s de silencio. Sin internet o sin clave de Gemini, usa la forma normal."));
    const chk = (label, val, fn) => { const l2 = mk("label", "lbl check"), i2 = mk("input"); i2.type = "checkbox"; i2.checked = val; i2.addEventListener("change", () => fn(i2.checked)); l2.append(i2, document.createTextNode(" " + label)); s2.append(l2); };
    chk("Buscar en Google cuando la pregunta es de actualidad (noticias, resultados, precios)", D.ajustes.buscarAuto !== false, (v) => { D.ajustes.buscarAuto = v; save(); });
    chk("Esperar más cuando hago pausas al hablar (más lento para responder)", !!D.ajustes.pausaLarga, (v) => { D.ajustes.pausaLarga = v; save(); });
    formas(s2);
    box.append(sec, s2);
  }

  // ======================================================================== ENGANCHES
  const base = { init: X.init, settings: X.settings };
  X.settings = function () {
    try { base.settings(); } catch (e) { console.error(e); }
    try { ajustes(); if (X._mejoras && X._mejoras.ordenarAjustes) X._mejoras.ordenarAjustes(); } catch (e) { console.error(e); }
    try { tema = ""; organizar(); } catch (e) { console.error(e); }
  };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    aplicarDiseno();
    // 3.23: cada vez que otro módulo ordena los Ajustes (algunos llegan después), se vuelven a repartir por temas
    if (X._mejoras && X._mejoras.ordenarAjustes && !X._mejoras.ordenarAjustes.__t) {
      const o = X._mejoras.ordenarAjustes;
      X._mejoras.ordenarAjustes = function () { o(); try { organizar(); } catch (e) { console.error(e); } };
      X._mejoras.ordenarAjustes.__t = true;
    }
    const top = $(".top"), st = $("#status");
    if (top && st && !$("#motor")) { chip = mk("span", "motor"); chip.id = "motor"; top.insertBefore(chip, st); }
    pintar();
    window.addEventListener("jarvis-ia", cambio);
    window.addEventListener("online", () => setTimeout(() => pintar(), 300));
    window.addEventListener("offline", () => setTimeout(() => pintar(), 300));
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { pintar(); aplicarDiseno(); } });
    setTimeout(() => pintar(), 3500);                                                    // cuando ya se sabe si hay IA del celular
  };
  X._n321 = { pintar, aplicarDiseno, organizar, ver };
})();
