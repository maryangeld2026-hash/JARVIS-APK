/* Jarvis para Android 3.29 · lo de PocketPal AI dentro de Jarvis:
   · Modelos GGUF (llama.cpp): catálogo de modelos que hablan español + buscador de Hugging Face + medir la velocidad.
   · Dictado sin internet con Whisper (whisper.cpp): reconoce tu voz dentro del celular.
   · Voz neural sin internet (Supertonic 3): una voz mucho más natural que la del celular, sin conexión.
   Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L18 = window.JL18, V = window.JV;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const R = (t, cls, spoken) => A.reply(t, cls || "tool", spoken);
  const cap = () => window.Capacitor;
  const native = () => !!(cap() && cap().isNativePlatform && cap().isNativePlatform());
  const plug = (n) => (native() && cap().Plugins && cap().Plugins[n]) || null;
  const aj = () => D.ajustes;
  const gb = (mb) => (mb / 1024).toFixed(1).replace(".", ",");
  const LANG = "es-CO";

  // ======================================================================== DICTADO SIN INTERNET (Whisper)
  let dictado = { listo: false }, ultimoOido = null;
  async function dictadoEstado() { const P = plug("Dictado"); if (!P) return dictado; try { dictado = (await P.estado()) || { listo: false }; } catch (e) { dictado = { listo: false }; } return dictado; }
  window.__whisperVoz = {
    usar(idioma) {
      if (!D || !dictado.listo || dictado.motor === false) return false;
      if (idioma && !/^es/i.test(idioma) && aj().dictadoWhisper !== "siempre") return false;
      return L18.usarAhora(aj().dictadoWhisper || "sin_internet", true, navigator.onLine);
    },
    async oir(onPartial, opts, onEstado) {
      const P = plug("Dictado");
      const h = await window.JON(P, "estado", (d) => { if (!d) return; if (onEstado) onEstado(d.s === "pensando" ? "listo" : d.s, d); if (d.s === "pensando" && onPartial) onPartial("…"); });
      try {
        const o = opts || {};
        const t0 = Date.now();
        const pista = ["Jarvis"].concat((aj().nombre || "").split(" ").slice(0, 1)).filter(Boolean).join(", ");
        const r = (await P.escuchar({ idioma: o.idioma || LANG, espera: o.espera || 9000, silencio: o.silencio || 1200, maximo: 15000, pista })) || {};
        ultimoOido = r;
        if (window.JDIAG) window.JDIAG.log("oyó", `${r.texto ? r.texto.length + " letras" : "nada"} · whisper · ${Date.now() - t0} ms`);
        return (r.texto || "").trim();
      } catch (e) {
        if (e && e.code === "permiso") throw new Error("Jarvis necesita permiso para usar el micrófono. Dáselo en Ajustes del teléfono › Apps › Jarvis › Permisos › Micrófono.");
        throw e;
      } finally { if (h && h.remove) h.remove(); }
    },
    parar() { const P = plug("Dictado"); if (P) P.detener().catch(() => {}); },
    ultimo: () => ultimoOido,
    refrescar: dictadoEstado,
  };

  // ======================================================================== VOZ NEURAL (Supertonic)
  let voz = { listo: false };
  async function vozEstado() { const P = plug("VozNeural"); if (!P) return voz; try { voz = (await P.estado()) || { listo: false }; } catch (e) { voz = { listo: false }; } return voz; }
  const neuralActiva = () => !!(D && voz.listo && L18.usarAhora(aj().vozNeural || "nunca", true, navigator.onLine));
  function instalarVoz() {
    const base = (X._x37 && X._x37.speaker) || null;
    const P = () => plug("VozNeural");
    const sp = {
      activo() { return neuralActiva() || !!(base && base.activo && base.activo()); },
      prepare(text) {
        if (neuralActiva() && P()) {
          return P().preparar({ texto: text, voz: aj().vozNeuralNombre || "M1", velocidad: +aj().velocidad || 1, idioma: "es", pasos: aj().ahorroActivo ? 4 : 6 })
            .then((r) => ({ neural: r.id })).catch(() => (base ? base.prepare(text) : null));
        }
        return base ? base.prepare(text) : null;
      },
      play(a) { if (a && a.neural) return P().reproducir({ id: a.neural }).catch(() => {}); return base ? base.play(a) : Promise.resolve(); },
      stop() { if (P()) P().parar().catch(() => {}); if (base && base.stop) base.stop(); },
    };
    if (V && V.setSpeaker) V.setSpeaker(sp);
  }

  // ======================================================================== MODELOS GGUF
  function agregarCatalogo() {
    const LOC = A.LOCALES; if (!LOC) return;
    const nuevos = L18.locales();
    Object.keys(nuevos).forEach((k) => { if (!LOC[k]) LOC[k] = nuevos[k]; });
  }
  async function bajarGguf(nombre, url, mb, st) {
    const P = plug("IALocal");
    if (!P) return A.toast("La IA del celular funciona en la app instalada (el APK).");
    if (!navigator.onLine) return A.toast("Para descargarlo necesitas internet (mejor wifi).", 5000);
    try {
      const mem = P.memoria ? await P.memoria() : null;
      if (mem && mem.discoMb < mb + 400) return A.toast(`No hay espacio: se necesitan ${gb(mb + 400)} GB libres y tienes ${gb(mem.discoMb)} GB.`, 7000);
      const c = L18.cabe(mb, mem && mem.totalMb);
      if (c === "no" && !confirm(`Este modelo (${gb(mb)} GB) es muy grande para la memoria de tu celular (${Math.round((mem.totalMb || 0) / 1024)} GB): puede cerrarse. ¿Descargarlo igual?`)) return;
    } catch (e) { /* sigue */ }
    if (!confirm(`Son ${gb(mb)} GB: descárgalo con wifi y con Jarvis abierto. Si se corta, sigue donde iba. ¿Empiezo?`)) return;
    const h = await window.JON(P, "progreso", (d) => { if (st) st.textContent = `Descargando ${nombre}… ${d.p >= 0 ? d.p + " % · " : ""}${d.mb} MB`; });
    try {
      await P.descargar({ url, nombre });
      A.toast(`Listo: ${nombre} quedó descargado y en uso. Funciona sin internet.`, 6000);
      if (!aj().respaldo && aj().proveedor !== "local") { aj().respaldo = "local"; save(); }
      if (window.__gemmaVoz) window.__gemmaVoz.refrescar();
    } catch (e) { A.toast("No se pudo descargar: " + (e.message || e), 7000); }
    finally { if (h && h.remove) h.remove(); if (st) st.textContent = ""; }
  }
  async function buscarHF(q, box, st) {
    box.textContent = ""; st.textContent = "Buscando en Hugging Face…";
    try {
      const r = await fetch(L18.urlBuscar(q, 12));
      const l = L18.repos(await r.json());
      st.textContent = l.length ? `${l.length} repositorios con modelos GGUF. Toca uno para ver sus archivos.` : "No encontré modelos GGUF con ese nombre.";
      l.forEach((x) => {
        const f = mk("div", "local-fila");
        f.append(mk("span", "", `${x.repo} · ⬇️ ${x.descargas.toLocaleString("es-CO")}`));
        const b = mk("button", "chip", "Ver"); b.type = "button";
        b.addEventListener("click", () => verArchivos(x.repo, f, st));
        f.append(b); box.append(f);
      });
    } catch (e) { st.textContent = "No pude buscar: " + (e.message || e); }
  }
  async function verArchivos(repo, fila, st) {
    const sub = fila.querySelector(".gguf-arch") || mk("div", "gguf-arch"); sub.textContent = "Cargando…"; fila.append(sub);
    try {
      const r = await fetch(L18.urlArbol(repo));
      const l = L18.archivosGguf(await r.json());
      const rec = L18.recomendado(l);
      sub.textContent = "";
      if (!l.length) { sub.textContent = "Este repositorio no tiene archivos GGUF para conversar."; return; }
      l.forEach((a) => {
        const b = mk("button", "chip" + (rec && rec.archivo === a.archivo ? " on" : ""), `${a.cuant || a.archivo} · ${gb(a.mb)} GB${rec && rec.archivo === a.archivo ? " ⭐" : ""}`); b.type = "button";
        b.title = a.archivo;
        b.addEventListener("click", () => bajarGguf(a.archivo.split("/").pop(), L18.urlArchivo(repo, a.archivo), a.mb, st));
        sub.append(b);
      });
      sub.append(mk("p", "hint", "⭐ = la recomendada (Q4_K_M: buen equilibrio entre calidad y tamaño). Los modelos «Instruct» o «it» son los que conversan."));
    } catch (e) { sub.textContent = "No pude ver los archivos: " + (e.message || e); }
  }
  async function medirVelocidad(st) {
    const P = plug("IALocal"); if (!P || !P.velocidad) return R("Eso funciona en la app instalada (el APK).", "err");
    if (st) st.textContent = "Midiendo… (unos segundos)";
    try { const r = await P.velocidad(); const t = L18.velocidadTexto(r); if (st) st.textContent = t; return t; }
    catch (e) { if (st) st.textContent = e.message || String(e); throw e; }
  }

  // ======================================================================== AJUSTES
  function seccion() {
    const box = $("#aj2"); if (!box || $("#aj-329")) return;
    const s = mk("div"); s.id = "aj-329";
    // --- GGUF
    s.append(mk("h3", "sub", "Modelos GGUF en el celular"));
    s.append(mk("p", "hint", "Cualquier modelo GGUF de Hugging Face (Gemma, Qwen, Llama, Phi, Mistral, LFM…) corre dentro del celular con llama.cpp, como en PocketPal AI. Se escogen y se usan igual que la IA del celular (Ajustes › IA de respaldo)."));
    const st = mk("p", "hint"); st.id = "gg-st";
    const cat = mk("div", "doc-acts");
    L18.CATALOGO.forEach(([k, repo, archivo, mb, , nombre]) => { const b = mk("button", "chip", nombre.split(" (")[0] + ` · ${gb(mb)} GB`); b.type = "button"; b.addEventListener("click", () => bajarGguf(archivo, L18.urlArchivo(repo, archivo), mb, st)); cat.append(b); });
    s.append(mk("p", "hint", "Recomendados (tocar = descargar):"), cat);
    const fb = mk("form", "pm-fila"); fb.autocomplete = "off";
    const q = mk("input", "inp"); q.placeholder = "Buscar en Hugging Face: llama, qwen, phi…"; q.id = "gg-q";
    const bb = mk("button", "btn small", "🔎 Buscar"); bb.type = "submit";
    const bv = mk("button", "btn small", "⚡ Velocidad"); bv.type = "button";
    fb.append(q, bb, bv); s.append(fb, st);
    const res = mk("div", "local-lista"); res.id = "gg-res"; s.append(res);
    fb.addEventListener("submit", (e) => { e.preventDefault(); if (q.value.trim()) buscarHF(q.value.trim(), res, st); });
    bv.addEventListener("click", () => medirVelocidad(st).catch(() => {}));
    // --- Whisper
    s.append(mk("h3", "sub", "Dictado sin internet (Whisper)"));
    const ds = mk("p", "hint", "Whisper reconoce tu voz dentro del celular: sin internet y sin mandar tu voz a ningún lado."); s.append(ds);
    const dm = mk("select", "inp"); [["sin_internet", "Usarlo cuando no hay internet"], ["siempre", "Usarlo siempre"], ["nunca", "No usarlo"]].forEach(([k, t]) => dm.append(new Option(t, k)));
    dm.value = aj().dictadoWhisper || "sin_internet"; dm.addEventListener("change", () => { aj().dictadoWhisper = dm.value; save(); }); s.append(dm);
    const da = mk("div", "doc-acts"); s.append(da);
    const pintarD = async () => {
      await dictadoEstado(); da.textContent = "";
      ds.textContent = dictado.listo ? `✓ Descargado: ${dictado.nombre} (${dictado.mb} MB). Whisper reconoce tu voz dentro del celular.` : "Whisper reconoce tu voz dentro del celular: sin internet y sin mandar tu voz a ningún lado. Descárgalo una vez.";
      const P = plug("Dictado");
      const bt = (t, fn, on) => { const b = mk("button", "chip" + (on ? " on" : ""), t); b.type = "button"; b.addEventListener("click", fn); da.append(b); };
      bt(dictado.listo ? "Cambiar a «base» (82 MB, rápido)" : "⬇️ Descargar «base» (82 MB, rápido)", () => bajarDictado("base", ds, pintarD), !dictado.listo);
      bt("⬇️ «small» (264 MB, entiende mejor)", () => bajarDictado("small", ds, pintarD));
      if (dictado.listo && P) bt("🗑 Borrar", async () => { await P.borrar().catch(() => {}); pintarD(); });
    };
    pintarD();
    // --- Voz neural
    s.append(mk("h3", "sub", "Voz neural sin internet (Supertonic)"));
    const vs = mk("p", "hint"); s.append(vs);
    const vm = mk("select", "inp"); [["nunca", "No: la voz de siempre"], ["siempre", "Usarla siempre"], ["sin_internet", "Usarla cuando no hay internet"]].forEach(([k, t]) => vm.append(new Option(t, k)));
    vm.value = aj().vozNeural || "nunca"; vm.addEventListener("change", () => { aj().vozNeural = vm.value; save(); if (vm.value !== "nunca") probarVoz(); });
    const vn = mk("select", "inp"); L18.VOCES.forEach(([k, t]) => vn.append(new Option("Voz: " + t, k)));
    vn.value = aj().vozNeuralNombre || "M1"; vn.addEventListener("change", () => { aj().vozNeuralNombre = vn.value; save(); probarVoz(); });
    s.append(vm, vn);
    const va = mk("div", "doc-acts"); s.append(va);
    const pintarV = async () => {
      await vozEstado(); va.textContent = "";
      vs.textContent = voz.listo ? `✓ Descargada (${voz.mb} MB). 31 idiomas, en español con acento neutro; suena como asistente (volumen propio en Android 17).` : "Una voz mucho más natural que la del celular, generada dentro del celular (sin internet). Pesa unos 400 MB.";
      const P = plug("VozNeural");
      const bt = (t, fn, on) => { const b = mk("button", "chip" + (on ? " on" : ""), t); b.type = "button"; b.addEventListener("click", fn); va.append(b); };
      if (!voz.listo) bt("⬇️ Descargar la voz neural", () => bajarVoz(vs, pintarV), true);
      else { bt("🔊 Probar", () => probarVoz(true)); if (P) bt("🗑 Borrar", async () => { await P.borrar().catch(() => {}); pintarV(); }); }
    };
    pintarV();
    s.append(mk("p", "hint", "Basado en PocketPal AI (MIT): llama.cpp y whisper.cpp (MIT), Supertonic 3 (código MIT, modelo OpenRAIL-M)."));
    box.append(s);
  }
  async function bajarDictado(t, st, luego) {
    const P = plug("Dictado"); if (!P) return A.toast("Funciona en la app instalada (el APK).");
    if (!navigator.onLine) return A.toast("Para descargarlo necesitas internet.", 4000);
    const h = await window.JON(P, "progreso", (d) => { st.textContent = `Descargando Whisper ${t}… ${d.p >= 0 ? d.p + " %" : d.mb + " MB"}`; });
    try { await P.descargar({ tamano: t }); A.toast("Listo: el dictado sin internet quedó descargado.", 5000); if (!aj().dictadoWhisper) { aj().dictadoWhisper = "sin_internet"; save(); } }
    catch (e) { A.toast("No se pudo descargar: " + (e.message || e), 7000); }
    finally { if (h && h.remove) h.remove(); luego(); }
  }
  async function bajarVoz(st, luego) {
    const P = plug("VozNeural"); if (!P) return A.toast("Funciona en la app instalada (el APK).");
    if (!navigator.onLine) return A.toast("Para descargarla necesitas internet (mejor wifi).", 4000);
    if (!confirm("Son unos 400 MB: descárgala con wifi. ¿Empiezo?")) return;
    const h = await window.JON(P, "progreso", (d) => { st.textContent = `Descargando la voz neural… ${d.p} %`; });
    try { await P.descargar(); A.toast("Listo: la voz neural quedó descargada.", 5000); if (!aj().vozNeural || aj().vozNeural === "nunca") { aj().vozNeural = "siempre"; save(); const s = $("#aj-329 select:nth-of-type(2)"); if (s) s.value = "siempre"; } await vozEstado(); probarVoz(); }
    catch (e) { A.toast("No se pudo descargar: " + (e.message || e), 7000); }
    finally { if (h && h.remove) h.remove(); luego(); }
  }
  function probarVoz(forzar) {
    if (!voz.listo) return;
    const antes = aj().vozNeural;
    if (forzar && (!antes || antes === "nunca")) aj().vozNeural = "siempre";
    V.hush(); V.say("Hola. Así sueno con la voz neural, generada dentro del celular.");
    if (forzar) setTimeout(() => { aj().vozNeural = antes; }, 300);
  }

  // ======================================================================== ÓRDENES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings };
  X.intent = function (text) {
    const it = L18.motoresIntent(text); if (it) return Object.assign({ t329: 1 }, it);
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.t329) return base.run(it, text);
    if (it.mo === "velocidad") { try { return R("⚡ " + await medirVelocidad(null)); } catch (e) { return R(e.message || String(e), "err"); } }
    if (it.mo === "voz") {
      await vozEstado();
      if (it.on && !voz.listo) return R("Primero descarga la voz neural en Ajustes › Voz › «Voz neural sin internet» (unos 400 MB).");
      aj().vozNeural = it.on ? "siempre" : "nunca"; save();
      return R(it.on ? "Listo: ahora hablo con la voz neural, generada dentro del celular." : "Listo: vuelvo a la voz de siempre.");
    }
    if (it.mo === "dictado") {
      await dictadoEstado();
      if (!dictado.listo) return R("Primero descarga el dictado sin internet en Ajustes › Voz › «Dictado sin internet (Whisper)» (82 MB).");
      aj().dictadoWhisper = "siempre"; save();
      return R("Listo: ahora reconozco tu voz dentro del celular, con Whisper.");
    }
    if (it.mo === "buscar") {
      const btn = $("#btn-ajustes"); if (btn) btn.click();
      setTimeout(() => { const i = $("#gg-q"); if (!i) return; const d = i.closest("details"); if (d) d.open = true; i.value = it.q; i.form.dispatchEvent(new Event("submit", { cancelable: true })); i.scrollIntoView({ block: "center" }); }, 500);
      return R(`Busco «${it.q}» en Hugging Face (modelos GGUF).`);
    }
  };
  X.settings = function () {
    try { base.settings(); } catch (e) { console.error(e); }
    try { seccion(); if (X._mejoras && X._mejoras.ordenarAjustes) X._mejoras.ordenarAjustes(); } catch (e) { console.error(e); }
  };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    agregarCatalogo();
    instalarVoz();
    setTimeout(() => { dictadoEstado(); vozEstado(); }, 2500);
    const C = window.JL11 && window.JL11.CATALOGO;
    if (C && !C.some((x) => /GGUF/.test(x[0]))) C.push(["🧩 IA del celular (GGUF, Whisper, voz neural)", ["Busca modelos GGUF de Llama", "Mide la velocidad de la IA del celular", "Usa la voz neural", "Activa el dictado sin internet"]]);
  };
  X._motores = { dictadoEstado, vozEstado, medirVelocidad, buscarHF, instalarVoz };
})();
