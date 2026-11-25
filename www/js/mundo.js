/* Jarvis para Android 3.31 · doce habilidades nuevas:
   🎨 imágenes con Gemini (Nano Banana) · ▶️ resumir videos de YouTube · 🎤 notas de voz compartidas · 🚗 pico y placa y festivos ·
   🌧️ alertas de lluvia fuerte · 🧠 mapas mentales · 🎧 resumen en audio a dos voces · 📐 tutor por pasos con la cámara ·
   ❤️ Health Connect · 🎯 modo concentración · 📦 paquetes · 📅 garantías y vencimientos.
   Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L20 = window.JL20, V = window.JV, IA = window.JIA;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const R = (t, cls, spoken) => A.reply(t, cls || "tool", spoken);
  const cap = () => window.Capacitor;
  const native = () => !!(cap() && cap().isNativePlatform && cap().isNativePlatform());
  const plug = (n) => (native() && cap().Plugins && cap().Plugins[n]) || null;
  const aj = () => D.ajustes;
  const pick = (t, ops, sp) => X._vida ? X._vida.pick(t, ops, sp) : R(t);
  const docente = () => aj().docente === true;
  const hayIA = () => aj().proveedor === "local" || !!(((aj().claves || {})[aj().proveedor]) || "").trim();
  const claveGemini = () => (((aj().claves || {}).gemini) || "").trim();
  const nombresEst = () => [].concat(...(D.cursos || []).map((c) => c.estudiantes || [])).filter((n) => n && n.length > 3).map((n) => L20.norm(n));
  const sinNombres = (t) => { if (!docente()) return t; const ns = nombresEst(); return String(t).split("\n").filter((l) => !ns.some((n) => L20.norm(l).includes(n))).join("\n"); };
  const copiar = (t) => { try { navigator.clipboard.writeText(t).then(() => A.toast("Copiado."), () => A.toast("No pude copiar.")); } catch (e) { A.toast("No pude copiar."); } };
  const abrirUrl = (u) => { const W = plug("Ventana"); if (W && W.abrir) return W.abrir({ url: u }).catch(() => window.open(u, "_blank")); window.open(u, "_blank"); };
  const compartir = (o) => window.JN && window.JN.share ? window.JN.share(o).catch(() => {}) : null;
  const programar = (l) => X._vida && X._vida.programar ? X._vida.programar(l) : null;
  const cancelar = (base, n) => X._vida && X._vida.cancelar ? X._vida.cancelar(base, n) : null;
  const idNum = (s, base) => base + (parseInt(L20.norm(s).split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) >>> 0, 10) % 900) * 4;

  // ======================================================================== GEMINI (directo)
  const GEM = "https://generativelanguage.googleapis.com/v1beta";
  let modelosCache = null;
  async function modelos() {
    if (modelosCache) return modelosCache;
    const r = await fetch(`${GEM}/models?pageSize=200&key=${encodeURIComponent(claveGemini())}`);
    if (!r.ok) throw new Error("No pude ver los modelos de tu cuenta de Gemini.");
    modelosCache = ((await r.json()).models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => String(m.name).replace(/^models\//, ""));
    return modelosCache;
  }
  /** Una llamada a Gemini; con varios modelos, si uno no tiene cupo sigue con el siguiente. */
  async function gen(lista, body) {
    let err = null;
    for (const m of [].concat(lista).filter(Boolean).slice(0, 4)) {
      try {
        const res = await fetch(`${GEM}/models/${encodeURIComponent(m)}:generateContent`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": claveGemini() }, body: JSON.stringify(body) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) { err = new Error((j.error && j.error.message) || "HTTP " + res.status); if (res.status === 400 && /api key/i.test(err.message)) break; continue; }
        const parts = ((((j.candidates || [])[0] || {}).content || {}).parts || []).filter((p) => !p.thought);
        return { parts, texto: parts.map((p) => p.text || "").join("").trim(), modelo: m };
      } catch (e) { err = e; }
    }
    throw err || new Error("Gemini no respondió.");
  }
  const textoModelos = () => { const r = IA && IA.rotacion ? IA.rotacion("gemini") : []; return r.length ? r : ["gemini-flash-latest"]; };
  const sinGemini = (que) => R(`${que} usa Gemini: pon tu clave de Gemini en Ajustes${navigator.onLine ? "" : " (y necesitas internet)"}.`, "err");
  const listoGemini = () => claveGemini() && navigator.onLine;

  /** Escoger una foto: cámara (capture) o galería. */
  function foto(camara) {
    return new Promise((ok) => { const i = mk("input"); i.type = "file"; i.accept = "image/*"; if (camara) i.setAttribute("capture", "environment"); i.style.display = "none"; i.addEventListener("change", () => { ok(i.files && i.files[0]); i.remove(); }); document.body.append(i); i.click(); });
  }
  function achicar(file, max) {
    return new Promise((ok, no) => { const img = new Image(); img.onload = () => { const k = Math.min(1, (max || 1600) / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); ok(c.toDataURL("image/jpeg", 0.88)); }; img.onerror = () => no(new Error("No pude abrir la foto.")); img.src = URL.createObjectURL(file); });
  }

  // ======================================================================== 🎨 IMÁGENES
  let ultimaImg = null;
  async function imagen(it) {
    if (!listoGemini()) return sinGemini("Crear imágenes");
    let fuente = null;
    if (it.img === "editar") {
      fuente = ultimaImg;                                                     // (3.38: el creador de imágenes también la deja aquí)
      if (!fuente) { R("📷 Escoge la foto que quieres editar."); const f = await foto(false); if (!f) return; const u = await achicar(f, 1600); fuente = { mime: "image/jpeg", data: u.split(",")[1] }; }
    }
    A.setState("thinking"); A.toast("🎨 Creando la imagen…", 4000);
    let r;
    try {
      const lista = await modelos().catch(() => []);
      const m = L20.modeloImagen(lista);
      const parts = [{ text: it.prompt + (it.img === "crear" ? " (si hay texto en la imagen, que esté en español y bien escrito)" : "") }];
      if (fuente) parts.unshift({ inline_data: { mime_type: fuente.mime, data: fuente.data } });
      r = await gen([m].concat(lista.filter((x) => x !== m && /flash.*image/.test(x))), { contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } });
    } catch (e) { A.setState("idle"); return R("No pude crear la imagen: " + (e.message || e), "err"); }
    A.setState("idle");
    const p = r.parts.find((x) => (x.inlineData || x.inline_data) && /^image\//.test((x.inlineData || x.inline_data).mimeType || (x.inlineData || x.inline_data).mime_type || ""));
    if (!p) return R("🎨 Gemini no devolvió una imagen" + (r.texto ? ": " + r.texto : ". Prueba describiéndola de otra forma."), "err");
    const d = p.inlineData || p.inline_data, mime = d.mimeType || d.mime_type;
    ultimaImg = { mime, data: d.data };
    const { e } = A.add("assistant", `🎨 ${it.img === "editar" ? "Listo, así quedó" : "Aquí está"}${r.texto ? ": " + r.texto.slice(0, 200) : "."}`, "tool");
    const im = mk("img", "msg-img gen-img"); im.src = `data:${mime};base64,${d.data}`; im.alt = it.prompt.slice(0, 80); e.append(im);
    const box = mk("div", "doc-acts");
    [["💾 Guardar o compartir", () => compartir({ title: "Imagen de Jarvis", fileName: "jarvis-imagen.png", mime, base64: d.data })],
      ["✏️ Cambiarle algo", () => { $("#in-texto").value = "edita esta imagen: "; $("#in-texto").focus(); }]].forEach(([t, fn]) => { const b = mk("button", "chip", t); b.type = "button"; b.addEventListener("click", fn); box.append(b); });
    e.append(box);
    A.say("Aquí está la imagen.");
  }

  // ======================================================================== ▶️ YOUTUBE
  let ultimoVideo = null;
  async function youtube(it) {
    if (!listoGemini()) return sinGemini("Ver videos de YouTube");
    ultimoVideo = it.url;
    const q = it.yt === "resumen" ? L20.PROMPT_YT : it.yt === "quiz" ? "Hazme un quiz de 5 preguntas de selección múltiple sobre este video, con la respuesta correcta y una explicación corta." : it.yt === "clave" ? "Dame los momentos importantes del video con su minuto (mm:ss) y una línea de cada uno." : `Responde en español con base en este video: ${it.q}. Si sirve, di el minuto (mm:ss).`;
    A.setState("thinking"); A.toast("▶️ Viendo el video…", 5000);
    let r;
    try { r = await gen(textoModelos(), { contents: [{ role: "user", parts: [{ file_data: { file_uri: it.url } }, { text: q }] }], generationConfig: { mediaResolution: "MEDIA_RESOLUTION_LOW", temperature: 0.3 } }); }
    catch (e) { A.setState("idle"); return R("No pude ver el video: " + (e.message || e) + ". Si es privado o muy largo, Gemini no lo puede abrir.", "err"); }
    A.setState("idle");
    if (!r.texto) return R("Gemini no pudo resumir ese video.", "err");
    pick("▶️ " + r.texto, [["❓ Hazme un quiz del video", () => youtube({ yt: "quiz", url: it.url })], ["📋 Copiar", () => copiar(r.texto)], ["Abrir el video", () => abrirUrl(it.url)]], r.texto.split("\n").find((l) => l.trim().length > 20) || "Listo el resumen del video.");
  }

  // ======================================================================== 🎤 NOTAS DE VOZ COMPARTIDAS
  async function audio(base64, mime, nombre, forzarNube) {
    const P = plug("Dictado");
    const nube = listoGemini() && (!docente() || forzarNube) && aj().notasVoz !== "celular";
    let texto = "", como = "";
    A.setState("thinking");
    try {
      if (nube) { const r = await gen(textoModelos(), { contents: [{ role: "user", parts: [{ inline_data: { mime_type: L20.mimeAudio(mime, nombre), data: base64 } }, { text: L20.PROMPT_NOTA }] }], generationConfig: { temperature: 0.2 } }); texto = r.texto; como = "Gemini"; }
      else {
        const st = P ? await P.estado().catch(() => ({})) : {};
        if (!st.listo) {
          A.setState("idle");
          const ops = [["Descargar el dictado sin internet (Whisper)", () => A.dispatch("abre ajustes")]];
          if (docente() && listoGemini() && !forzarNube) ops.unshift(["No tiene nombres de estudiantes: usar Gemini", () => audio(base64, mime, nombre, true)]);
          return pick(docente() ? "🎤 En modo docente las notas de voz no van a la nube (pueden tener nombres de estudiantes) y el dictado sin internet (Whisper) no está descargado." : "🎤 Para pasar notas de voz a texto sin internet necesito el dictado sin internet (Whisper).", ops);
        }
        const r = await P.transcribirAudio({ base64, idioma: "es" }); texto = r.texto || ""; como = "Whisper, en el celular";
      }
    } catch (e) { A.setState("idle"); return R("No pude transcribir la nota de voz: " + (e.message || e), "err"); }
    A.setState("idle");
    if (!texto) return R("🎤 No entendí nada en esa nota de voz.");
    pick(`🎤 **Nota de voz** (${como}):\n\n${texto}`, [["📋 Copiar", () => copiar(texto)], ["✍️ Ayúdame a responderla", () => A.handle("Ayúdame a responder este mensaje de voz, cordial y en pocas líneas:\n\n" + texto, false)],
      ["📄 Guardar en Material", () => { (D.docs = D.docs || []).unshift({ id: window.JD.uid(), titulo: "Nota de voz · " + new Date().toLocaleDateString("es-CO"), md: texto, fecha: Date.now(), tipo: "nota" }); save(); A.toast("Guardada en Material."); }]], "Te transcribí la nota de voz. Está en la pantalla.");
  }

  // ======================================================================== 🚗 PICO Y PLACA Y FESTIVOS
  const PICO_ID = 792000;
  async function pico(it) {
    const p = aj().placa = aj().placa || {};
    if (it.pp === "placa") { p.digito = it.digito; if (it.ciudad) p.ciudad = it.ciudad; save(); if (aj().picoAvisos) avisosPico(); return R(`🚗 Listo: tu placa termina en ${it.digito}${p.ciudad ? ` (${(L20.CIUDADES[p.ciudad] || {}).nombre || p.ciudad})` : ""}.${p.ciudad ? " Pregúntame «¿tengo pico y placa mañana?»." : " ¿En qué ciudad manejas? Dime, por ejemplo, «vivo en Bogotá»."}`); }
    if (it.pp === "ciudad") { if (!it.ciudad) return R("¿En qué ciudad? Dime «vivo en Bogotá» o «vivo en Medellín».", "err"); p.ciudad = it.ciudad; save(); if (aj().picoAvisos) avisosPico(); return R(`🚗 Listo, ${(L20.CIUDADES[it.ciudad] || {}).nombre || it.ciudad}.${p.digito == null ? " ¿En qué número termina tu placa?" : ""}`); }
    if (it.pp === "avisar") {
      aj().picoAvisos = it.on; save();
      if (!it.on) { await cancelar(PICO_ID, 30); return R("Listo, ya no te aviso el pico y placa."); }
      if (p.digito == null || !p.ciudad) return R("Para avisarte necesito tu placa y tu ciudad: dime «mi placa termina en 5 y vivo en Bogotá».");
      if (!L20.CIUDADES[p.ciudad]) return R(`Todavía no tengo la rotación de ${p.ciudad} para avisarte sola (sí la de Bogotá y Medellín). Pregúntame «¿tengo pico y placa mañana?» y la busco en internet.`);
      const n = await avisosPico();
      return R(`🔔 Listo: la noche anterior (8 p. m.) te aviso cuando tengas pico y placa. En las próximas 3 semanas son ${n} días.`);
    }
    // consulta
    const dig = it.digito != null ? it.digito : p.digito;
    const ciudad = it.ciudad || p.ciudad;
    const d = new Date(it.fecha + "T12:00:00");
    if (dig == null || !ciudad) return R(`Para saberlo necesito ${dig == null ? "en qué número termina tu placa" : ""}${dig == null && !ciudad ? " y " : ""}${!ciudad ? "tu ciudad" : ""}: dime, por ejemplo, «mi placa termina en 5 y vivo en Bogotá».`);
    const r = L20.picoPlaca(ciudad, dig, d);
    if (r.conocida) return R(L20.picoTexto(r, dig, d, Date.now()));
    if (!hayIA() || !navigator.onLine) return R(`No tengo la rotación de ${ciudad} y sin internet no puedo buscarla.`, "err");
    A.setState("thinking");
    try {
      const t = await IA.chat({ system: "Respondes en español de Colombia, corto y preciso, con base en fuentes actuales.", messages: [{ role: "user", content: `¿Hay pico y placa para carros particulares en ${ciudad} el ${L20.fechaTxt(d, Date.now())} (${it.fecha}) para placas terminadas en ${dig}? Di sí o no, el horario y de dónde sale la información. Si no estás seguro, dilo.` }], buscar: true, stream: false, maxTokens: 400 });
      A.setState("idle"); return R("🚗 " + t);
    } catch (e) { A.setState("idle"); return R("No pude buscarlo: " + (e.message || e), "err"); }
  }
  async function avisosPico() {
    const p = aj().placa || {}; if (p.digito == null || !L20.CIUDADES[p.ciudad]) return 0;
    await cancelar(PICO_ID, 30);
    const dias = L20.diasConPico(p.ciudad, p.digito, Date.now(), 21);
    const c = L20.CIUDADES[p.ciudad];
    await programar(dias.map((f, k) => { const at = new Date(f + "T20:00:00"); at.setDate(at.getDate() - 1); return { id: PICO_ID + k, title: "🚗 Mañana tienes pico y placa", body: `${c.nombre}, placa terminada en ${p.digito}, ${c.horario}.`, schedule: { at, allowWhileIdle: true } }; }).filter((x) => x.schedule.at.getTime() > Date.now()));
    return dias.length;
  }
  function festivos(it) {
    const now = Date.now();
    if (it.fe === "dia") { const d = new Date(it.fecha + "T12:00:00"), f = L20.festivo(d); return R(f ? `🎉 Sí, ${L20.fechaTxt(d, now)} es festivo: **${f.nombre}**.` : `📅 No, ${L20.fechaTxt(d, now)} no es festivo${d.getDay() === 0 || d.getDay() === 6 ? " (pero es fin de semana)" : ""}.`); }
    if (it.fe === "proximo") {
      const l = L20.proximosFestivos(now, 6), f = it.puente ? l.find((x) => L20.esPuente(x.fecha)) || l[0] : l[0];
      const d = new Date(f.fecha + "T12:00:00"), n = Math.round((new Date(f.fecha + "T00:00:00") - new Date(new Date(now).setHours(0, 0, 0, 0))) / 864e5);
      return R(`🎉 El próximo ${it.puente ? "puente" : "festivo"} es **${L20.fechaTxt(d, now)}: ${f.nombre}**${n > 1 ? ` (faltan ${n} días)` : ""}.${L20.esPuente(f.fecha) ? " Es puente: sábado, domingo y " + (d.getDay() === 1 ? "lunes" : "viernes") + "." : ""}`);
    }
    const y = new Date(now).getFullYear();
    const l = L20.festivos(y).concat(L20.festivos(y + 1)).filter((x) => it.mes < 0 ? x.fecha.startsWith(String(y)) : +x.fecha.slice(5, 7) === it.mes + 1 && x.fecha >= `${y}-${String(new Date(now).getMonth() + 1).padStart(2, "0")}-01`).slice(0, it.mes < 0 ? 18 : 4);
    if (!l.length) return R(`📅 No hay festivos en ${L20.MESES[it.mes]}.`);
    return R("📅 **Festivos:**\n" + l.map((x) => `- ${L20.fechaTxt(new Date(x.fecha + "T12:00:00"), now)}: ${x.nombre}${L20.esPuente(x.fecha) ? " (puente)" : ""}`).join("\n"));
  }

  // ======================================================================== 🌧️ ALERTAS DE LLUVIA
  async function alertas(it) {
    const C = plug("Clima"); if (!C) return R("Las alertas de lluvia funcionan en el celular (la app instalada).", "err");
    if (!it.al) { await C.config({ on: false }).catch(() => {}); aj().alertasLluvia = false; save(); return R("Listo, quité las alertas de lluvia."); }
    const pos = X.posAprox ? await X.posAprox() : null;
    if (!pos) return R("Para avisarte de la lluvia necesito tu ubicación aproximada (el permiso de ubicación).", "err");
    await C.config({ on: true, lat: pos.lat, lng: pos.lng }).catch(() => {});
    aj().alertasLluvia = true; save();
    let ahora = ""; try { const r = await C.probar(); ahora = r.hay ? "\n\nAhora mismo: " + r.texto : "\n\nAhora mismo no viene lluvia fuerte."; } catch (e) { /* sin internet */ }
    return R(`🌧️ Listo: Android revisa el pronóstico cada 2 horas y te aviso si viene lluvia fuerte o tormenta en las próximas horas (de 6 a. m. a 9 p. m.). Jarvis no queda despierto para esto.${ahora}`);
  }

  // ======================================================================== 🧠 MAPAS MENTALES y 🎧 RESUMEN EN AUDIO
  function fuenteDe(it) {
    if (it.doc === "__ultimo") { const m = (D.chat || []).filter((x) => x.role === "assistant" && String(x.content || "").length > 80).slice(-1)[0]; return m ? { titulo: "lo anterior", texto: m.content } : null; }
    if (it.doc) { const q = L20.norm(it.doc); const d = (D.docs || []).find((x) => L20.norm(x.titulo).includes(q)) || (D.docs || []).find((x) => q.split(" ").every((w) => L20.norm(x.titulo + " " + (x.md || "").slice(0, 200)).includes(w))); return d ? { titulo: d.titulo, texto: d.md || "" } : null; }
    return null;
  }
  function svgAPng(svg, w, h) {
    return new Promise((ok, no) => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h); ok(c.toDataURL("image/png")); }; img.onerror = () => no(new Error("No pude dibujar el mapa.")); img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg))); });
  }
  async function mapa(it) {
    if (!hayIA()) return R("Para armar el mapa necesito la IA: pon tu clave en Ajustes.", "err");
    const f = fuenteDe(it);
    if ((it.doc) && !f) return R(`No encontré «${it.doc === "__ultimo" ? "lo anterior" : it.doc}» en Material.`, "err");
    const tema = f ? `el siguiente texto («${f.titulo}»):\n${sinNombres(f.texto).slice(0, 6000)}` : it.tema;
    A.setState("thinking");
    let m;
    try { m = L20.mapaValido(await IA.json({ system: "Organizas ideas en mapas mentales. Respondes solo JSON.", messages: [{ role: "user", content: L20.PROMPT_MAPA(tema, it.mm) }], maxTokens: 1200, temperature: 0.3 })); }
    catch (e) { A.setState("idle"); return R("No pude armar el mapa: " + (e.message || e), "err"); }
    A.setState("idle");
    if (!m) return R("La IA no devolvió un mapa que se pueda dibujar. Prueba con otro tema.", "err");
    const svg = L20.svgMapa(m);
    const { e } = A.add("assistant", `🧠 **${m.tema}**`, "tool");
    const caja = mk("div", "mapa-mental"); caja.innerHTML = svg; caja.querySelector("svg").setAttribute("style", "width:100%;height:auto;border-radius:12px"); e.append(caja);
    const vb = svg.match(/viewBox="0 0 (\d+) (\d+)"/), W = +vb[1], H = +vb[2];
    const box = mk("div", "doc-acts");
    [["💾 Guardar o compartir", async () => { try { const png = await svgAPng(svg, W, H); compartir({ title: m.tema, fileName: "mapa-mental.png", mime: "image/png", base64: png.split(",")[1] }); } catch (er) { A.toast(er.message); } }],
      ["📋 Copiar como lista", () => copiar(L20.mapaTexto(m).replace(/\*\*/g, ""))],
      ["📄 Guardar en Material", () => { (D.docs = D.docs || []).unshift({ id: window.JD.uid(), titulo: "Mapa mental: " + m.tema, md: L20.mapaTexto(m), fecha: Date.now(), tipo: "nota" }); save(); A.toast("Guardado en Material."); }]].forEach(([t, fn]) => { const b = mk("button", "chip", t); b.type = "button"; b.addEventListener("click", fn); box.append(b); });
    e.append(box);
    A.say(`Listo el mapa mental de ${m.tema}, con ${m.ramas.length} ideas principales.`);
  }
  async function podcast(it) {
    if (!hayIA()) return R("Para el resumen en audio necesito la IA: pon tu clave en Ajustes.", "err");
    const f = fuenteDe(it);
    if (it.doc && !f) return R(`No encontré «${it.doc === "__ultimo" ? "lo anterior" : it.doc}» en Material.`, "err");
    A.setState("thinking"); A.toast("🎧 Escribiendo el guion…", 4000);
    let g;
    try { g = L20.guionValido(await IA.json({ system: "Escribes guiones de audio claros y amenos. Respondes solo JSON.", messages: [{ role: "user", content: L20.PROMPT_GUION(it.tema, f ? sinNombres(f.texto).slice(0, 8000) : "") }], maxTokens: 3000, temperature: 0.7 })); }
    catch (e) { A.setState("idle"); return R("No pude escribir el guion: " + (e.message || e), "err"); }
    if (!g) { A.setState("idle"); return R("La IA no devolvió un guion. Prueba otra vez.", "err"); }
    const { e } = A.add("assistant", `🎧 **${g.titulo}** · resumen en audio con Ana y Luis`, "tool");
    const det = mk("details"); det.append(mk("summary", "", "Ver el guion")); const pre = mk("div", "hint"); pre.textContent = L20.guionTexto(g); det.append(pre); e.append(det);
    if (listoGemini()) {
      A.toast("🎧 Grabando las dos voces…", 6000);
      try {
        const lista = await modelos().catch(() => []);
        const m = L20.modeloTTS(lista);
        const r = await gen([m].concat(lista.filter((x) => /tts/.test(x) && x !== m)), L20.pedidoTTS(g));
        const p = r.parts.find((x) => x.inlineData || x.inline_data);
        if (!p) throw new Error("Gemini no devolvió el audio.");
        const d = p.inlineData || p.inline_data;
        const wav = L20.wavDePCM(d.data, L20.tasaDe(d.mimeType || d.mime_type));
        const au = mk("audio"); au.controls = true; au.src = "data:audio/wav;base64," + wav; au.style.width = "100%"; e.append(au);
        const b = mk("button", "chip", "💾 Guardar o compartir el audio"); b.type = "button"; b.addEventListener("click", () => compartir({ title: g.titulo, fileName: "resumen-en-audio.wav", mime: "audio/wav", base64: wav })); e.append(b);
        A.setState("idle"); A.toast("Listo: dale play.");
        try { au.play(); } catch (er) { /* el usuario le da play */ }
        return;
      } catch (er) { A.toast("No pude grabarlo con Gemini (" + (er.message || er) + "); lo leo con las voces del celular.", 4000); }
    }
    A.setState("idle");
    // sin Gemini: la voz neural del celular con dos voces, si está; si no, la voz normal
    const VN = plug("VozNeural"); const st = VN ? await VN.estado().catch(() => ({})) : {};
    if (st.listo) { for (const l of g.lineas) { try { const r = await VN.preparar({ texto: l.t, voz: l.quien === "Ana" ? "F1" : "M1", velocidad: 1, idioma: "es" }); await VN.reproducir({ id: r.id }); } catch (er) { break; } } return; }
    A.say(g.lineas.map((l) => l.t).join(" "));
  }

  // ======================================================================== 📐 TUTOR POR PASOS
  let tutor = null;
  async function tutorTurno(texto) {
    tutor.ultimo = Date.now();
    tutor.hist.push({ role: "user", content: texto });
    const msgs = tutor.hist.map((m, i) => i === 0 ? Object.assign({}, m, { image: tutor.img }) : m);
    A.setState("thinking");
    try {
      const t = await IA.chat({ system: L20.SISTEMA_TUTOR, messages: msgs, maxTokens: 600, stream: false, temperature: 0.4 });
      tutor.hist.push({ role: "assistant", content: t });
      A.setState("idle");
      return R("📐 " + t, "tool", t);
    } catch (e) { A.setState("idle"); return R(e.message || String(e), "err"); }
  }
  async function tutorEmpezar() {
    if (!hayIA()) return R("El tutor usa la IA: pon tu clave en Ajustes.", "err");
    R("📷 Tómale una foto al ejercicio (que se vea completo y con luz).");
    const f = await foto(true); if (!f) return;
    const u = await achicar(f, 1600);
    const ue = A.add("user", "📐 Ayúdame con este ejercicio"); const im = mk("img", "msg-img"); im.src = u; ue.e.prepend(im);
    tutor = { img: { mime: "image/jpeg", data: u.split(",")[1] }, hist: [], ultimo: Date.now() };
    await tutorTurno("Este es mi ejercicio. Ayúdame paso a paso, sin darme la respuesta de una vez.");
    A.toast("Responde con tu voz o escribiendo. «Ya entendí» para terminar.", 4000);
  }

  // ======================================================================== ❤️ SALUD
  async function salud(it) {
    const S = plug("Salud"); if (!S) return R("Health Connect funciona en el celular (la app instalada).", "err");
    let st = await S.estado().catch(() => ({ estado: "no" }));
    if (st.estado === "no") { S.conectar().catch(() => {}); return R("❤️ Este celular no tiene Health Connect (viene con Android 14 o más nuevo; en Android 9 a 13 se instala desde Play Store). Te abrí Play Store.", "err"); }
    if (it.sa === "conectar" || !st.permisos) {
      if (st.estado === "actualizar") { S.conectar().catch(() => {}); return R("❤️ Hay que instalar o actualizar Health Connect: te abrí Play Store. Después repíteme la pregunta."); }
      R("❤️ Android te va a preguntar qué datos de salud puede leer Jarvis (pasos, sueño y pulso). Solo lectura.");
      st = await S.conectar().catch(() => ({ permisos: 0 }));
      if (!st.permisos) return R("Sin permiso no puedo leer tus datos de salud. Si cambias de idea, di «conecta Health Connect».", "err");
      if (it.sa === "conectar") return R(`✅ Conectado (${st.permisos} de 3 permisos). Pregúntame «¿cómo dormí esta semana?» o «¿cuántos pasos llevo hoy?».`);
    }
    let r; try { r = await S.resumen({ dias: 7 }); } catch (e) { return R(e.message || String(e), "err"); }
    return R(L20.saludTexto(r, it, Date.now()));
  }
  /** Para «Mi día»: cómo dormiste anoche y los pasos de ayer (si lo activaste). */
  async function saludDia() {
    if (!aj().saludMiDia) return "";
    const S = plug("Salud"); if (!S) return "";
    try {
      const r = await S.resumen({ dias: 2 });
      const s = (r.sueno || []).map((x) => (x.fin - x.ini) / 60000).filter((m) => m > 60).pop();
      const ayer = new Date(); ayer.setDate(ayer.getDate() - 1); const k = ayer.toISOString().slice(0, 10);
      const p = (r.pasos || []).find((x) => x.dia === k);
      return [s ? `Anoche dormí ${Math.floor(s / 60)} h ${Math.round(s % 60)} min.` : "", p ? `Ayer caminé ${p.n} pasos.` : ""].filter(Boolean).join(" ");
    } catch (e) { return ""; }
  }

  // ======================================================================== 🎯 CONCENTRACIÓN
  const ENF_ID = 793001;
  async function enfoque(it) {
    if (it.en === "ver") return R(L20.enfoqueResumen(D.enfoque, Date.now()));
    const C = plug("Celular");
    if (it.en === "parar") {
      const a = aj().enfoqueActual; if (!a) return R("No estás en modo concentración.");
      const min = Math.max(1, Math.round((Date.now() - a.ini) / 60000));
      const s = (D.enfoque || []).find((x) => x.ini === a.ini); if (s) s.min = Math.min(s.min, min);
      aj().enfoqueActual = null; save();
      if (C && a.silencio) C.quitarSilencio().catch(() => {});
      cancelar(ENF_ID, 1); const b = $("#btn-tiempo-parar"); if (b) b.click();
      return R(`🎯 Listo: ${min} minutos de concentración. ${L20.enfoqueResumen(D.enfoque, Date.now())}`);
    }
    const min = Math.max(5, Math.min(240, it.min || 50));
    let silencio = false;
    if (C) { try { const r = await C.silencio({ quien: "favoritos", min, repetidas: true }); silencio = !!(r && r.permiso); } catch (e) { /* sin permiso */ } }
    const ini = Date.now();
    aj().enfoqueActual = { ini, min, silencio }; (D.enfoque = D.enfoque || []).push({ ini, min }); D.enfoque = D.enfoque.slice(-200); save();
    if (A.startTimer) A.startTimer(min * 60);
    programar([{ id: ENF_ID, title: "🎯 ¡Terminaste!", body: `${min} minutos de concentración. Descansa 5 minutos.`, schedule: { at: new Date(ini + min * 60000), allowWhileIdle: true } }]);
    return R(`🎯 **Modo concentración: ${min} minutos.** ${silencio ? "El celular queda en silencio (solo entran tus favoritos ⭐ y quien insista llamando)." : "Para silenciar el celular necesito el permiso de «No molestar» (di «silencia todo menos mi familia» una vez)."} Te aviso al terminar. Di «termina la concentración» para parar antes.`);
  }

  // ======================================================================== 📦 PAQUETES
  const AVISO_PAQ = "_Las transportadoras no tienen una consulta pública que Jarvis pueda revisar solo, así que no te aviso cuando cambie: te abro su página con la guía copiada (solo la pegas). Para que te lea lo que dice, llámame desde esa página y di «¿qué dice esta pantalla?»._";
  function abrirPaquete(p) { const e = L20.EMPRESAS[p.empresa]; copiar(p.guia); if (e) abrirUrl(e[1]); }
  async function paquete(it) {
    D.paquetes = D.paquetes || [];
    if (it.pq === "agregar") {
      const p = D.paquetes.find((x) => x.guia === it.guia) || { guia: it.guia, t: Date.now() };
      if (it.empresa) p.empresa = it.empresa;
      if (!D.paquetes.includes(p)) D.paquetes.unshift(p);
      D.paquetes = D.paquetes.slice(0, 20); save();
      if (!p.empresa) return pick(`📦 Guardé la guía **${p.guia}**. ¿De qué transportadora es?`, ["servientrega", "interrapidisimo", "coordinadora", "envia", "tcc", "deprisa", "4-72", "mercadolibre"].map((k) => [L20.EMPRESAS[k][0], () => { p.empresa = k; save(); abrirPaquete(p); R(`📦 Abrí ${L20.EMPRESAS[k][0]} y copié la guía ${p.guia}: pégala en el campo de búsqueda.\n\n${AVISO_PAQ}`); }]));
      abrirPaquete(p);
      return R(`📦 Guardé la guía **${p.guia}** de ${L20.EMPRESAS[p.empresa][0]}, abrí su página y copié la guía: pégala en el campo de búsqueda.\n\n${AVISO_PAQ}`);
    }
    if (it.pq === "borrar") { const q = L20.norm(it.q); const n0 = D.paquetes.length; D.paquetes = q ? D.paquetes.filter((p) => !(L20.norm(p.guia).includes(q) || L20.norm((L20.EMPRESAS[p.empresa] || [""])[0]).includes(q))) : D.paquetes.slice(1); save(); return R(n0 > D.paquetes.length ? "📦 Listo, lo quité de tus paquetes." : "No encontré ese paquete."); }
    if (!D.paquetes.length) return R("📦 No tienes paquetes guardados. Dime «rastrea el paquete 2045678912 de Servientrega».");
    return pick("📦 **Tus paquetes** (toca uno: abro la página y copio la guía):", D.paquetes.map((p) => [`${(L20.EMPRESAS[p.empresa] || ["¿?"])[0]} · ${p.guia}`, () => abrirPaquete(p)]));
  }

  // ======================================================================== 📅 GARANTÍAS Y VENCIMIENTOS
  const VEN_ID = 794000;
  async function avisosVenc(x) {
    const base = idNum(x.id, VEN_ID);
    await cancelar(base, 4);
    await programar(L20.avisosVenc(x, Date.now()).map((a, k) => ({ id: base + k, title: "📅 Vencimiento", body: a.texto, schedule: { at: new Date(a.at), allowWhileIdle: true } })));
  }
  async function vencimiento(it) {
    D.vencimientos = D.vencimientos || [];
    if (it.ve === "ver") return R(L20.vencLista(D.vencimientos, Date.now()));
    if (it.ve === "borrar") { const q = L20.norm(it.q); const x = D.vencimientos.find((v) => L20.norm(v.que).includes(q) || q.includes(L20.norm(v.que))); if (!x) return R("No encontré ese vencimiento."); D.vencimientos = D.vencimientos.filter((v) => v !== x); save(); await cancelar(idNum(x.id, VEN_ID), 4); return R(`📅 Quité «${x.que}».`); }
    if (it.ve === "foto") {
      if (!hayIA()) return R("Para leer la factura necesito la IA: pon tu clave en Ajustes.", "err");
      R("📷 Tómale una foto a la factura (que se vean el producto y la fecha).");
      const f = await foto(true); if (!f) return;
      const u = await achicar(f, 1600);
      const ue = A.add("user", "🧾 Guarda la garantía de esta factura"); const im = mk("img", "msg-img"); im.src = u; ue.e.prepend(im);
      A.setState("thinking");
      let j; try { j = await IA.json({ system: "Lees facturas con cuidado. Respondes solo JSON.", messages: [{ role: "user", content: L20.PROMPT_FACTURA, image: { mime: "image/jpeg", data: u.split(",")[1] } }], maxTokens: 300 }); } catch (e) { A.setState("idle"); return R(e.message || String(e), "err"); }
      A.setState("idle");
      if (!j || j.error || !j.producto) return R((j && j.error) || "No pude leer la factura. Prueba con más luz.", "err");
      const desde = /^\d{4}-\d{2}-\d{2}$/.test(j.fecha || "") ? new Date(j.fecha + "T12:00:00") : new Date();
      const meses = Math.max(1, Math.min(120, +j.garantia_meses || 12)); const fin = new Date(desde); fin.setMonth(fin.getMonth() + meses);
      const x = { id: window.JD.uid(), que: `Garantía de ${j.producto}${j.tienda ? " (" + j.tienda + ")" : ""}`, fecha: fin.toISOString().slice(0, 10), garantia: true, foto: u.length < 400000 ? u : "" };
      return pick(`🧾 Leí: **${j.producto}**${j.tienda ? " en " + j.tienda : ""}, comprado el ${desde.toLocaleDateString("es-CO")}, garantía de ${meses} meses → hasta el **${fin.toLocaleDateString("es-CO")}**. ¿La guardo?`,
        [["✅ Guardar", async () => { D.vencimientos.push(x); save(); await avisosVenc(x); R("📅 Guardada. Te aviso un mes, una semana y un día antes de que se venza."); }], ["Cancelar", () => {}]]);
    }
    const x = { id: window.JD.uid(), que: it.que, fecha: it.fecha, garantia: !!it.garantia };
    const viejo = D.vencimientos.find((v) => L20.norm(v.que) === L20.norm(x.que)); if (viejo) { D.vencimientos = D.vencimientos.filter((v) => v !== viejo); await cancelar(idNum(viejo.id, VEN_ID), 4); }
    D.vencimientos.push(x); save(); await avisosVenc(x);
    const n = L20.avisosVenc(x, Date.now()).length;
    return R(`📅 Listo: **${x.que}** vence el ${new Date(x.fecha + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}.${n ? " Te aviso " + (n >= 3 ? "un mes, una semana y un día antes" : "antes") + "." : " Ojo: esa fecha ya pasó."}`);
  }

  // ======================================================================== AJUSTES
  function seccion() {
    const box = $("#aj2"); if (!box || $("#aj-331")) return;
    const s = mk("div"); s.id = "aj-331";
    const chk = (cont, label, val, fn) => { const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = val; i.addEventListener("change", () => fn(i.checked)); l.append(i, document.createTextNode(" " + label)); cont.append(l); return i; };
    s.append(mk("h3", "sub", "Salud (Health Connect)"));
    const hs = mk("p", "hint", "Jarvis lee (solo lee) tus pasos, tu sueño y tu pulso de Health Connect: los que guardan el celular, tu reloj o apps como Fitbit y Samsung Health. Pregunta «¿cómo dormí esta semana?»."); s.append(hs);
    const S = plug("Salud");
    if (S) S.estado().then((r) => { hs.textContent += r.estado === "no" ? " Este celular no lo tiene todavía." : r.permisos ? ` ✅ Conectado (${r.permisos} de 3 permisos).` : ""; if (r.estado !== "no" && !r.permisos) { const b = mk("button", "btn small", "Conectar Health Connect"); b.type = "button"; b.addEventListener("click", () => salud({ sa: "conectar" })); hs.after(b); } }).catch(() => {});
    chk(s, "Contarme en «Mi día» cómo dormí y cuánto caminé ayer", !!aj().saludMiDia, (v) => { aj().saludMiDia = v; save(); });
    s.append(mk("h3", "sub", "Pico y placa y alertas de lluvia"));
    const p = aj().placa || {};
    const fila = mk("div", "row wrap");
    const dig = mk("select", "inp"); dig.append(new Option("Último número de la placa", "")); for (let k = 0; k <= 9; k++) dig.append(new Option(String(k), String(k)));
    dig.value = p.digito != null ? String(p.digito) : ""; dig.addEventListener("change", () => { (aj().placa = aj().placa || {}).digito = dig.value === "" ? null : +dig.value; save(); if (aj().picoAvisos) avisosPico(); });
    const ciu = mk("select", "inp"); [["", "Ciudad"], ["bogota", "Bogotá"], ["medellin", "Medellín y valle de Aburrá"]].forEach(([v, t]) => ciu.append(new Option(t, v)));
    ciu.value = L20.CIUDADES[p.ciudad] ? p.ciudad : ""; ciu.addEventListener("change", () => { (aj().placa = aj().placa || {}).ciudad = ciu.value || null; save(); if (aj().picoAvisos) avisosPico(); });
    fila.append(dig, ciu); s.append(fila);
    chk(s, "Avisarme la noche anterior cuando tenga pico y placa", !!aj().picoAvisos, (v) => pico({ pp: "avisar", on: v }));
    chk(s, "Avisarme si viene lluvia fuerte o tormenta (Android revisa cada 2 horas)", !!aj().alertasLluvia, (v) => alertas({ al: v }));
    s.append(mk("p", "hint", "Las reglas de pico y placa son las que publicaron las alcaldías de Bogotá y Medellín para el segundo semestre de 2026; las ciudades las cambian, así que Jarvis te avisa cuando la regla que conoce pueda estar vieja. Para otras ciudades, pregúntale y la busca en internet. Los festivos de Colombia los calcula Jarvis (Ley Emiliani)."));
    s.append(mk("h3", "sub", "Notas de voz compartidas"));
    const sn = mk("select", "inp"); [["auto", "Con Gemini si hay internet; si no, Whisper en el celular"], ["celular", "Siempre en el celular (Whisper)"]].forEach(([v, t]) => sn.append(new Option(t, v)));
    sn.value = aj().notasVoz || "auto"; sn.addEventListener("change", () => { aj().notasVoz = sn.value; save(); }); s.append(sn);
    s.append(mk("p", "hint", "En WhatsApp, mantén presionada la nota de voz › Compartir › Jarvis: te la paso a texto (y te ayudo a responderla). En modo docente no van a la nube sin preguntarte."));
    box.append(s);
  }

  // ======================================================================== ENGANCHES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings };
  X.intent = function (text) {
    if (tutor && Date.now() - tutor.ultimo < 30 * 60000) {
      const f = L20.tutorFin(text);
      if (f === "salir") return { a331: "tutor_fin" };
      if (f === "respuesta") return { a331: "tutor", texto: "Me rindo: muéstrame la solución completa paso a paso." };
      const t = L20.norm(text);
      if (!/^(?:jarvis\s+)?(?:pon|abre|llama|recuerdame|alarma|que hora|cancela|para|callate)\b/.test(t)) return { a331: "tutor", texto: text };
    }
    const yt = L20.ytIntent(text, ultimoVideo); if (yt) return { a331: "yt", it: yt };
    if (String(text).length > 160 || /\n/.test(text)) return base.intent(text);        // los textos largos (prompts internos, pantallas) no son órdenes de estas habilidades
    if (window.JL7 && window.JL7.habMatch && window.JL7.habMatch(text, D.misHab)) return base.intent(text);   // tus habilidades propias van primero
    const im = L20.imagenIntent(text); if (im) return { a331: "img", it: im };
    const pp = L20.picoIntent(text, Date.now()); if (pp) return { a331: pp.fe ? "fe" : "pp", it: pp };
    const al = L20.alertasIntent(text); if (al) return { a331: "al", it: al };
    const mm = L20.mapaIntent(text); if (mm) return { a331: "mapa", it: mm };
    const po = L20.audioResumenIntent(text); if (po) return { a331: "pod", it: po };
    if (L20.tutorIntent(text)) return { a331: "tutor_ini" };
    const sa = L20.saludIntent(text); if (sa) return { a331: "salud", it: sa };
    const en = L20.enfoqueIntent(text); if (en) return { a331: "enf", it: en };
    const pq = L20.paqueteIntent(text); if (pq) return { a331: "paq", it: pq };
    const ve = L20.vencIntent(text, Date.now()); if (ve) return { a331: "ven", it: ve };
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.a331) return base.run(it, text);
    switch (it.a331) {
      case "yt": return youtube(it.it);
      case "img": return imagen(it.it);
      case "pp": return pico(it.it);
      case "fe": return festivos(it.it);
      case "al": return alertas(it.it);
      case "mapa": return mapa(it.it);
      case "pod": return podcast(it.it);
      case "tutor_ini": return tutorEmpezar();
      case "tutor": return tutorTurno(it.texto);
      case "tutor_fin": tutor = null; return R("📐 ¡Muy bien! Cuando quieras otro ejercicio, dime «ayúdame con este ejercicio».");
      case "salud": return salud(it.it);
      case "enf": return enfoque(it.it);
      case "paq": return paquete(it.it);
      case "ven": return vencimiento(it.it);
    }
  };
  X.settings = function () {
    try { base.settings(); } catch (e) { console.error(e); }
    try { seccion(); if (X._mejoras && X._mejoras.ordenarAjustes) X._mejoras.ordenarAjustes(); } catch (e) { console.error(e); }
  };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    if (aj().picoAvisos) setTimeout(() => avisosPico().catch(() => {}), 6000);          // las próximas 3 semanas, cada vez que abres Jarvis
    if (aj().enfoqueActual && Date.now() > aj().enfoqueActual.ini + aj().enfoqueActual.min * 60000) { aj().enfoqueActual = null; save(); }
    const C = window.JL11 && window.JL11.CATALOGO;
    if (C && !C.some((x) => /Imágenes, videos/.test(x[0]))) C.push(["🎨 Imágenes, videos, salud y trámites", ["Haz una imagen de un volcán para mi clase", "Hazme un mapa mental de la fotosíntesis", "Haz un resumen en audio de la Revolución Francesa", "Ayúdame con este ejercicio paso a paso", "¿Tengo pico y placa mañana?", "¿Cuál es el próximo puente?", "Avísame si va a llover fuerte", "¿Cómo dormí esta semana?", "Necesito concentrarme 50 minutos", "Rastrea el paquete 2045678912 de Servientrega", "Mi SOAT vence el 15 de marzo", "¿Qué se me vence?"]]);
  };
  X._a331 = { ponerUltima: (d) => { if (d && d.data) ultimaImg = { mime: d.mime || "image/png", data: d.data }; }, imagen, youtube, audio, pico, festivos, alertas, mapa, podcast, tutorEmpezar, salud, saludDia, enfoque, paquete, vencimiento, estado: () => ({ tutor, ultimoVideo }) };
})();
