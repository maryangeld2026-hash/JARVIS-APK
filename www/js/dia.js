/* Jarvis para Android 3.34 · asistente del día a día:
   🗓️ organizar el día · ⚠️ choques en la agenda · 🚗 hora de salir · 📰 temas que sigo · 🍳 ¿qué cocino con esto? · ✈️ modo viaje ·
   🔔 alertas de precio · 📊 hojas de cálculo por voz (Excel y Google Sheets) · 📄 Google Docs y Notion · 👥 no perder el contacto ·
   🌙 rutina de sueño. Lo que tiene que pasar con Jarvis cerrado lo hace Android (RutinaPlugin): Jarvis no queda despierto.
   Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L22 = window.JL22, IA = window.JIA;
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
  const hayIA = () => aj().proveedor === "local" || !!(((aj().claves || {})[aj().proveedor]) || "").trim();
  const enLinea = () => navigator.onLine && hayIA();
  const claveGemini = () => (((aj().claves || {}).gemini) || "").trim();
  const programar = (l) => X._vida && X._vida.programar ? X._vida.programar(l) : null;
  const cancelar = (base, n) => X._vida && X._vida.cancelar ? X._vida.cancelar(base, n) : null;
  const abrirUrl = (u) => { const W = plug("Ventana"); if (W && W.abrir) return W.abrir({ url: u }).catch(() => window.open(u, "_blank")); window.open(u, "_blank"); };
  const compartir = (o) => window.JN && window.JN.share ? window.JN.share(o).catch(() => {}) : null;
  const hoyIso = () => L22.iso(new Date());
  const idDe = (s, base, n) => base + (Math.abs([...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % (n || 200)) * 4;
  async function eventos(desde, hasta) { const C = plug("Calendario"); if (!C) return []; try { return ((await C.eventos({ desde, hasta })) || {}).lista || []; } catch (e) { return []; } }
  const dia = (iso) => { const a = new Date(iso + "T00:00:00").getTime(); return [a, a + 864e5]; };
  function foto() { return new Promise((ok) => { const i = mk("input"); i.type = "file"; i.accept = "image/*"; i.setAttribute("capture", "environment"); i.style.display = "none"; i.addEventListener("change", () => { ok(i.files && i.files[0]); i.remove(); }); document.body.append(i); i.click(); }); }
  function achicar(file) { return new Promise((ok, no) => { const img = new Image(); img.onload = () => { const k = Math.min(1, 1400 / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); ok(c.toDataURL("image/jpeg", 0.85)); }; img.onerror = () => no(new Error("No pude abrir la foto.")); img.src = URL.createObjectURL(file); }); }
  /** Las órdenes que tienen que seguir aunque Jarvis esté cerrado, para Android. */
  function rutina() {
    const P = plug("Rutina"); if (!P) return;
    const rot = IA && IA.rotacion ? IA.rotacion("gemini") : [];
    const nube = (D.temas || []).length || (D.precios || []).length;
    P.config({ temas: (D.temas || []).map((x) => x.q), precios: (D.precios || []).map((x) => ({ q: x.q, max: x.max })), key: nube ? claveGemini() : "", modelo: rot[0] || "",
      choques: !!aj().choquesNoche, sueno: { on: !!aj().suenoOn, hora: aj().suenoHora || "22:00", ajustar: aj().suenoAjustar !== false } }).catch(() => {});
  }

  // ======================================================================== 🗓️ ORGANIZAR EL DÍA
  async function organizar(it) {
    let tareas = it.tareas || [], parte = it.parte || "dia";
    const plan = D.planDia && D.planDia.fecha === hoyIso() ? D.planDia : null;
    if (it.od === "replan") {
      if (!plan) return R("Hoy no hemos organizado el día. Dime, por ejemplo: «organiza mi tarde: llamar al banco, mercado 1 hora y estudiar 2 horas».");
      tareas = plan.bloques.filter((b) => b.fin > Date.now()).map((b) => ({ t: b.t, min: Math.round((b.fin - b.ini) / 60000) })).concat(plan.sobran || []);
      parte = "dia";
    }
    if (!tareas.length) return R("🗓️ ¿Qué tienes que hacer? Dímelo así: «organiza mi tarde: llamar al banco, hacer mercado 1 hora y estudiar 2 horas». Si no me dices cuánto dura algo, le doy media hora.");
    const [a, b] = dia(hoyIso());
    const ev = await eventos(a, b);
    const p = L22.planDia(ev, tareas, Date.now(), parte);
    D.planDia = { fecha: hoyIso(), bloques: p.bloques, sobran: p.sobran, agendado: false }; save();
    const ops = [];
    if (p.bloques.length && plug("Calendario")) ops.push(["📅 Agendarlo en mi calendario", async () => {
      const C = plug("Calendario"); let n = 0;
      for (const x of p.bloques) { try { await C.crear({ titulo: "🎯 " + x.t, inicio: x.ini, fin: x.fin, descripcion: "Organizado por Jarvis" }); n++; } catch (e) { /* sigue */ } }
      D.planDia.agendado = true; save(); R(`📅 Listo: agendé ${n} bloque${n === 1 ? "" : "s"} en tu calendario. Si algo se corre, dime «reorganiza mi día».`);
    }]);
    if (p.sobran.length) ops.push(["Pásalo para mañana", () => { (D.recordatorios = D.recordatorios || []); p.sobran.forEach((x) => A.dispatch(`recuérdame ${x.t.charAt(0).toLowerCase() + x.t.slice(1)} mañana a las 9 de la mañana`)); }]);
    return pick(L22.planTexto(p, ev), ops, p.bloques.length ? `Te organicé ${p.bloques.length} cosas. Están en la pantalla.` : "No alcanzó el tiempo.");
  }

  // ======================================================================== ⚠️ CHOQUES
  async function choques(it) {
    const [a, b] = dia(it.fecha);
    const ev = await eventos(a, b);
    if (!plug("Calendario")) return R("Para revisar la agenda necesito el calendario del celular (la app instalada).", "err");
    const c = L22.conflictos(ev);
    const ops = aj().choquesNoche ? [] : [["🔔 Avisarme cada noche", () => { aj().choquesNoche = true; save(); rutina(); A.toast("Listo: cada noche a las 8 reviso tu agenda de mañana."); }]];
    return ops.length ? pick(L22.conflictosTexto(c), ops) : R(L22.conflictosTexto(c));
  }

  // ======================================================================== 🚗 HORA DE SALIR
  const SAL_ID = 795000;
  async function trayecto(e) {
    const pos = X.posAprox ? await X.posAprox() : null;
    if (!pos || !enLinea()) return null;
    const hora = L22.hhmm(e.inicio - 40 * 60000);
    try {
      const t = await IA.chat({ system: "Respondes solo con el dato pedido.", messages: [{ role: "user", content: L22.PROMPT_TRAYECTO(`${pos.lat.toFixed(3)},${pos.lng.toFixed(3)}`, e.lugar, aj().salirModo || "carro", hora) }], stream: false, maxTokens: 60, mapas: pos });
      return L22.minutosDe(t);
    } catch (er) { return null; }
  }
  /** Calcula y programa los avisos de las citas con dirección de hoy y mañana temprano. */
  async function calcularSalidas(forzar) {
    if (!aj().horaSalir || (!forzar && Date.now() - (aj().salirCalc || 0) < 3 * 3600e3)) return [];
    aj().salirCalc = Date.now(); save();
    const ev = (await eventos(Date.now(), Date.now() + 20 * 3600e3)).filter((e) => !e.todoElDia && e.lugar && e.inicio > Date.now() + 20 * 60000).slice(0, 6);
    await cancelar(SAL_ID, 6);
    const out = [];
    for (let k = 0; k < ev.length; k++) {
      const min = await trayecto(ev[k]); if (!min) continue;
      const at = L22.horaSalida(ev[k].inicio, min);
      out.push({ e: ev[k], min, at });
      if (at > Date.now()) await programar([{ id: SAL_ID + k, title: "🚗 Hora de salir", body: `Sal ya para «${ev[k].titulo}» (${L22.hhmm(ev[k].inicio)}): unos ${min} min de trayecto${aj().salirModo && aj().salirModo !== "carro" ? " en " + aj().salirModo : ""}.`, schedule: { at: new Date(at), allowWhileIdle: true } }]);
    }
    return out;
  }
  async function salir(it) {
    if (it.hs === "off") { aj().horaSalir = false; save(); await cancelar(SAL_ID, 6); return R("Listo, ya no te aviso la hora de salir."); }
    if (it.hs === "on") {
      aj().horaSalir = true; save();
      const l = await calcularSalidas(true);
      return R(`🚗 Listo: para las citas de tu calendario que tengan dirección, te aviso cuándo salir (el trayecto lo estima Gemini con Google Maps según la hora; no es el tráfico exacto en vivo).${l.length ? "\n\nHoy:\n" + l.map((x) => `- «${x.e.titulo}» a las ${L22.hhmm(x.e.inicio)}: sal a las **${L22.hhmm(x.at)}** (unos ${x.min} min)`).join("\n") : "\n\nHoy no veo citas con dirección."}`);
    }
    const q = L22.norm(it.q);
    const ev = (await eventos(Date.now(), Date.now() + 2 * 864e5)).filter((e) => !e.todoElDia && L22.norm(e.titulo + " " + (e.lugar || "")).includes(q.split(" ").filter((w) => w.length > 3)[0] || q));
    if (!ev.length) return R(`No encontré «${it.q}» en tu calendario de hoy y mañana.`);
    const e = ev[0];
    if (!e.lugar) return R(`«${e.titulo}» es a las ${L22.hhmm(e.inicio)}, pero no tiene dirección en el calendario: agrégasela y te digo cuándo salir.`);
    A.setState("thinking"); const min = await trayecto(e); A.setState("idle");
    if (!min) return R("No pude estimar el trayecto ahora (necesito internet, Gemini y tu ubicación).", "err");
    return R(`🚗 Para «${e.titulo}» (${L22.hhmm(e.inicio)}, ${e.lugar}): sal a las **${L22.hhmm(L22.horaSalida(e.inicio, min))}**. Son unos ${min} min, más 10 de colchón.`);
  }

  // ======================================================================== 📰 TEMAS QUE SIGO
  async function temas(it) {
    D.temas = D.temas || [];
    if (it.te === "seguir") {
      if (D.temas.some((x) => L22.norm(x.q) === L22.norm(it.q))) return R(`Ya sigo «${it.q}».`);
      if (D.temas.length >= 6) return R("Ya sigo 6 temas (el máximo, para que el resumen sea corto). Quita uno con «deja de seguir …».");
      D.temas.push({ q: it.q, t: Date.now() }); save(); rutina();
      return R(`📰 Listo: sigo «${it.q}».${claveGemini() ? " Cada mañana, antes de que te levantes, Android le pide a Gemini lo nuevo (buscando en internet) y te deja el resumen: «resumen de mis temas»." : " Para el resumen de cada mañana necesito tu clave de Gemini."} Temas: ${D.temas.map((x) => x.q).join(", ")}.`);
    }
    if (it.te === "quitar") { const n0 = D.temas.length; D.temas = D.temas.filter((x) => !L22.norm(x.q).includes(L22.norm(it.q).replace(/^(?:el |la |los |las |del? )/, ""))); save(); rutina(); return R(n0 > D.temas.length ? "Listo, ya no lo sigo." : "No seguía ese tema."); }
    if (it.te === "ver" || !D.temas.length) return R(D.temas.length ? `📰 Sigo: ${D.temas.map((x) => x.q).join(", ")}. Di «resumen de mis temas».` : "📰 No sigues ningún tema. Di, por ejemplo, «sígueme el tema del dólar».");
    const P = plug("Rutina");
    if (P) { try { const b = await P.brief(); if (b.texto && new Date(b.t).toDateString() === new Date().toDateString()) return R("📰 " + b.texto); } catch (e) { /* lo hago ahora */ } }
    if (!enLinea()) return R("Hoy no hay resumen listo y sin internet no puedo buscarlo.", "err");
    A.setState("thinking"); A.toast("📰 Buscando lo nuevo de tus temas…", 4000);
    try { const t = await IA.chat({ system: "Resumes noticias con fuentes, en español de Colombia, de forma neutral.", messages: [{ role: "user", content: L22.PROMPT_TEMAS(D.temas.map((x) => x.q), new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })) }], buscar: true, stream: false, maxTokens: 1500 }); A.setState("idle"); return R("📰 " + t); }
    catch (e) { A.setState("idle"); return R(e.message || String(e), "err"); }
  }
  async function temasDia() { const P = plug("Rutina"); if (!P || !(D.temas || []).length) return ""; try { const b = await P.brief(); return b.texto && new Date(b.t).toDateString() === new Date().toDateString() ? "Resumen de mis temas: " + b.texto.slice(0, 1200) : ""; } catch (e) { return ""; } }

  // ======================================================================== 🍳 ¿QUÉ COCINO?
  async function cocina(it) {
    if (!hayIA()) return R("Para eso necesito la IA: pon tu clave en Ajustes.", "err");
    let msg = { role: "user", content: L22.PROMPT_COCINA(it.ingredientes || "") };
    if (it.co === "foto") {
      R("📷 Tómale una foto a tu nevera o alacena (abierta y con luz).");
      const f = await foto(); if (!f) return;
      const u = await achicar(f); const ue = A.add("user", "🍳 ¿Qué cocino con esto?"); const im = mk("img", "msg-img"); im.src = u; ue.e.prepend(im);
      msg = Object.assign(msg, { image: { mime: "image/jpeg", data: u.split(",")[1] } });
    }
    A.setState("thinking");
    let r; try { r = L22.recetasValidas(await IA.json({ system: "Eres un cocinero casero colombiano práctico. Respondes solo JSON.", messages: [msg], maxTokens: 900, temperature: 0.5 })); } catch (e) { A.setState("idle"); return R(e.message || String(e), "err"); }
    A.setState("idle");
    if (!r) return R("No se me ocurrió nada con eso. Prueba con otra foto o dime qué tienes.", "err");
    const txt = (r.veo.length ? `🧺 Veo: ${r.veo.join(", ")}.\n\n` : "") + "🍳 **Puedes preparar:**\n" + r.recetas.map((x) => `- **${x.nombre}** (${x.minutos} min)${x.falta.length ? ` · te falta: ${x.falta.join(", ")}` : ""}`).join("\n");
    return pick(txt, r.recetas.map((x) => [`👩‍🍳 Cocinemos ${x.nombre}`, () => A.dispatch("cocinemos " + x.nombre)]), `Puedes preparar ${r.recetas.map((x) => x.nombre).join(", ")}.`);
  }

  // ======================================================================== ✈️ MODO VIAJE
  const VUE_ID = 796000;
  async function viaje(it) {
    D.viajes = (D.viajes || []).filter((v) => !v.fecha || v.fecha >= L22.iso(new Date(Date.now() - 2 * 864e5)));
    if (it.vu === "agregar") {
      if (!it.fecha) return R(`✈️ ¿Qué día sale el vuelo ${it.vuelo}? Dime, por ejemplo, «mi vuelo es el ${it.vuelo} el 15 de diciembre a las 6 de la mañana».`);
      const v = { vuelo: it.vuelo, fecha: it.fecha, hora: it.hora, destino: it.destino, t: Date.now() };
      D.viajes = D.viajes.filter((x) => !(x.vuelo === v.vuelo && x.fecha === v.fecha)).concat([v]); save();
      const av = L22.avisosVuelo(v, Date.now()), base = idDe(v.vuelo + v.fecha, VUE_ID, 100);
      await cancelar(base, 3);
      await programar(av.map((a, k) => ({ id: base + k, title: "✈️ Tu viaje", body: a.texto, schedule: { at: new Date(a.at), allowWhileIdle: true } })));
      const ops = [["¿Cómo va el vuelo?", () => viaje({ vu: "estado" })]];
      if (v.destino) ops.push([`🧳 Lista para empacar (${v.destino})`, () => viaje({ vu: "maleta", destino: v.destino, dias: 3 })]);
      return pick(`✈️ Guardé el vuelo **${v.vuelo}** del ${new Date(v.fecha + "T12:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}${v.hora ? ` a las ${L22.hhmm(new Date(v.fecha + "T00:00:00").setHours(v.hora[0], v.hora[1]))}` : ""}${v.destino ? " a " + v.destino : ""}. ${av.length ? "Te aviso para el check-in y cuándo salir al aeropuerto." : ""}`, ops);
    }
    if (it.vu === "ver") return R(D.viajes.length ? "✈️ **Tus viajes:**\n" + D.viajes.map((v) => `- ${v.vuelo} · ${v.fecha}${v.destino ? " · " + v.destino : ""}`).join("\n") : "✈️ No tienes viajes guardados. Di «mi vuelo es el AV123 mañana a las 6 de la mañana».");
    if (it.vu === "estado") {
      const v = D.viajes.slice().sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
      if (!v) return R("No tengo tu vuelo guardado. Dime «mi vuelo es el AV123 mañana a las 6 de la mañana».");
      if (!enLinea()) return R("Sin internet no puedo revisar el vuelo.", "err");
      A.setState("thinking");
      try { const t = await IA.chat({ system: "Respondes corto, en español de Colombia, con la fuente.", messages: [{ role: "user", content: `Busca el estado del vuelo ${v.vuelo} del ${v.fecha}: hora de salida programada y estimada, si va retrasado o cancelado, terminal o puerta si se sabe. Di de dónde sale la información y que la confirme con la aerolínea.` }], buscar: true, stream: false, maxTokens: 400 }); A.setState("idle"); return R("✈️ " + t); }
      catch (e) { A.setState("idle"); return R(e.message || String(e), "err"); }
    }
    // maleta
    if (!hayIA()) return R("Para la lista necesito la IA.", "err");
    A.setState("thinking");
    let clima = "";
    try {
      const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(it.destino)}&count=1&language=es&format=json`)).json();
      const p = (g.results || [])[0];
      if (p) { const w = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`)).json(); const d = w.daily || {}; if (d.temperature_2m_max) clima = `máximas de ${Math.round(Math.max(...d.temperature_2m_max))} °C, mínimas de ${Math.round(Math.min(...d.temperature_2m_min))} °C, lluvia hasta ${Math.max(...d.precipitation_probability_max)} %`; }
    } catch (e) { /* sin clima */ }
    let j; try { j = await IA.json({ system: "Respondes solo JSON.", messages: [{ role: "user", content: L22.PROMPT_MALETA(it.destino, it.dias, clima) }], maxTokens: 600 }); } catch (e) { A.setState("idle"); return R(e.message || String(e), "err"); }
    A.setState("idle");
    const items = ((j && j.items) || []).map(String).filter(Boolean).slice(0, 25);
    if (!items.length) return R("No pude armar la lista.", "err");
    D.listas = D.listas || {}; const k = "maleta"; D.listas[k] = { nombre: k, items: items.map((t) => ({ t, hecho: false })) }; save();
    return R(`🧳 **Para ${it.destino} (${it.dias} días)**${clima ? ` · ${clima}` : ""}:\n` + items.map((t) => `- ${t}`).join("\n") + "\n\nQuedó en tu lista «maleta»: tacha lo que empaques con «ya empaqué el cargador». Para el cambio de moneda: «¿cuánto son 100 dólares?».");
  }

  // ======================================================================== 🔔 ALERTAS DE PRECIO
  async function precios(it) {
    D.precios = D.precios || [];
    if (it.pr === "agregar") {
      D.precios = D.precios.filter((x) => L22.norm(x.q) !== L22.norm(it.q)).concat([{ q: it.q, max: it.max, t: Date.now() }]).slice(-8); save(); rutina();
      return R(`🔔 Listo: cada mañana Android le pide a Gemini el precio más bajo de **${it.q}** en tiendas de Colombia y te aviso si baja de **${L22.cop(it.max)}**.${claveGemini() ? "" : " (Necesito tu clave de Gemini.)"} Es un estimado de internet: confírmalo en la tienda antes de comprar.`);
    }
    if (it.pr === "quitar") { const n0 = D.precios.length; D.precios = D.precios.filter((x) => !L22.norm(x.q).includes(L22.norm(it.q))); save(); rutina(); return R(n0 > D.precios.length ? "Listo, quité esa alerta." : "No tenía esa alerta."); }
    if (it.pr === "ahora") {
      if (!enLinea()) return R("Sin internet no puedo buscar el precio.", "err");
      A.setState("thinking");
      try { const t = await IA.chat({ system: "Buscas precios en Colombia y respondes en el formato pedido.", messages: [{ role: "user", content: L22.PROMPT_PRECIO(it.q) }], buscar: true, stream: false, maxTokens: 200 }); A.setState("idle"); const p = L22.precioDe(t); return R(p.precio ? `🏷️ ${it.q}: lo más barato que encontré hoy es **${L22.cop(p.precio)}**${p.tienda ? " en " + p.tienda : ""}. Confírmalo en la tienda.` : `No encontré el precio de ${it.q}.`); }
      catch (e) { A.setState("idle"); return R(e.message || String(e), "err"); }
    }
    if (!D.precios.length) return R("🔔 No tienes alertas de precio. Di «avísame cuando los AirPods bajen de 900 mil».");
    let info = []; const P = plug("Rutina"); if (P) { try { info = (await P.precios()).lista || []; } catch (e) { /* nada */ } }
    return R("🔔 **Tus alertas de precio:**\n" + D.precios.map((x) => { const i = info.find((y) => L22.norm(y.q) === L22.norm(x.q)) || {}; return `- **${x.q}** · avisar bajo ${L22.cop(x.max)}${i.precio ? ` · último: ${L22.cop(i.precio)}${i.tienda ? " (" + i.tienda + ")" : ""}` : " · aún sin revisar"}`; }).join("\n"));
  }

  // ======================================================================== 📊 HOJAS DE CÁLCULO
  function cargarXlsx() { return window.XLSX ? Promise.resolve(window.XLSX) : new Promise((ok, no) => { const s = document.createElement("script"); s.src = "vendor/xlsx.mini.min.js"; s.onload = () => ok(window.XLSX); s.onerror = () => no(new Error("No pude cargar Excel.")); document.head.append(s); }); }
  async function hojaGoogle(nombre, h) {
    const gf = X._ && X._.gfetch; if (!gf) throw new Error("Conecta Google en Ajustes › Google.");
    const titulo = `${nombre[0].toUpperCase() + nombre.slice(1)} (Jarvis)`;
    if (h.driveId) {
      try { await gf(`https://www.googleapis.com/upload/drive/v3/files/${h.driveId}?uploadType=media`, { method: "PATCH", headers: { "Content-Type": "text/csv; charset=UTF-8" }, body: L22.csv(h) }); return h.driveId; }
      catch (e) { /* la borraron: se crea otra */ }
    }
    const mp = L22.multipart({ name: titulo, mimeType: "application/vnd.google-apps.spreadsheet" }, "text/csv", L22.csv(h));
    const r = await gf("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${mp.borde}` }, body: mp.cuerpo });
    h.driveId = r.id; save(); return r.id;
  }
  async function hoja(it) {
    D.hojas = D.hojas || {};
    if (it.hj === "lista") { const k = Object.keys(D.hojas); return R(k.length ? "📊 **Tus hojas:** " + k.map((n) => `${n} (${D.hojas[n].filas.length} filas, ${L22.cop(L22.totales(D.hojas[n]).total)})`).join(" · ") : "📊 No tienes hojas. Di «anota en mi hoja de ventas: 3 arepas, 15 mil»."); }
    const h = D.hojas[it.hoja];
    if (it.hj === "anotar") {
      const x = D.hojas[it.hoja] = D.hojas[it.hoja] || { filas: [], t: Date.now() };
      x.filas.push([hoyIso(), it.fila.cantidad, it.fila.desc, it.fila.valor]); save();
      const tt = L22.totales(x);
      if (x.driveId && aj().hojasAuto) hojaGoogle(it.hoja, x).catch(() => {});
      return R(`📊 Anotado en **${it.hoja}**: ${it.fila.cantidad} × ${it.fila.desc}${it.fila.valor ? " · " + L22.cop(it.fila.valor) : ""}. Hoy llevas ${L22.cop(tt.hoy)} (${x.filas.filter((r) => r[0] === hoyIso()).length} filas).`);
    }
    if (!h) return R(`No tengo una hoja de «${it.hoja}». Empiézala con «anota en mi hoja de ${it.hoja}: …».`, "err");
    if (it.hj === "total") { const tt = L22.totales(h); return R(`📊 **${it.hoja}:** hoy ${L22.cop(tt.hoy)} · este mes ${L22.cop(tt.mes)} · total ${L22.cop(tt.total)} (${tt.filas} filas).`); }
    if (it.hj === "ver") return pick(L22.hojaTabla(it.hoja, h), [["📗 Exportar a Excel", () => hoja({ hj: "excel", hoja: it.hoja })], ["☁️ Pasar a Google Sheets", () => hoja({ hj: "google", hoja: it.hoja })]], false);
    if (it.hj === "deshacer") { const r = h.filas.pop(); save(); return R(r ? `Quité la última fila: ${r[1]} × ${r[2]} (${L22.cop(r[3])}).` : "La hoja está vacía."); }
    if (it.hj === "excel") {
      try {
        const XL = await cargarXlsx();
        const ws = XL.utils.aoa_to_sheet([L22.COLS].concat(h.filas)), wb = XL.utils.book_new(); XL.utils.book_append_sheet(wb, ws, it.hoja.slice(0, 30));
        const b64 = XL.write(wb, { type: "base64", bookType: "xlsx" });
        await compartir({ title: "Hoja de " + it.hoja, fileName: `${it.hoja.replace(/[^\wáéíóúñ -]/gi, "")}.xlsx`, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: b64 });
        return R(`📗 Listo el Excel de **${it.hoja}** (${h.filas.length} filas): guárdalo o compártelo.`);
      } catch (e) { return R(e.message || String(e), "err"); }
    }
    // google
    A.setState("thinking");
    try { const id = await hojaGoogle(it.hoja, h); A.setState("idle"); aj().hojasAuto = true; save(); return pick(`☁️ Tu hoja de **${it.hoja}** quedó en Google Sheets. Desde ahora cada fila nueva se sube sola.`, [["Abrir en Google Sheets", () => abrirUrl(`https://docs.google.com/spreadsheets/d/${id}`)]]); }
    catch (e) { A.setState("idle"); return R("No pude subirla a Google: " + (e.message || e) + " (conecta Google en Ajustes › Google).", "err"); }
  }

  // ======================================================================== 📄 GOOGLE DOCS Y NOTION
  function fuenteDoc(it) {
    if (it.ultimo || !it.q) { const m = (D.chat || []).filter((x) => x.role === "assistant" && String(x.content || "").length > 60).slice(-1)[0]; return m ? { titulo: "Nota de Jarvis · " + new Date().toLocaleDateString("es-CO"), md: m.content } : null; }
    const q = L22.norm(it.q); const d = (D.docs || []).find((x) => L22.norm(x.titulo).includes(q)); return d ? { titulo: d.titulo, md: d.md || "" } : null;
  }
  async function documento(it) {
    const f = fuenteDoc(it);
    if (!f) return R(it.q ? `No encontré «${it.q}» en Material.` : "No encontré qué guardar.", "err");
    A.setState("thinking");
    try {
      if (it.dc === "docs") {
        const gf = X._ && X._.gfetch; if (!gf) throw new Error("Conecta Google en Ajustes › Google.");
        const mp = L22.multipart({ name: f.titulo, mimeType: "application/vnd.google-apps.document" }, "text/html", L22.mdHtml(f.md));
        const r = await gf("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${mp.borde}` }, body: mp.cuerpo });
        A.setState("idle");
        return pick(`📄 Guardé «${f.titulo}» en Google Docs.`, [["Abrir en Google Docs", () => abrirUrl(`https://docs.google.com/document/d/${r.id}/edit`)]]);
      }
      const tok = (aj().notionToken || "").trim(), padre = L22.notionId(aj().notionPagina || "");
      if (!tok || !padre) { A.setState("idle"); return R("📝 Para guardar en Notion: en Ajustes › «Google Docs y Notion» pon tu clave de integración de Notion y el enlace de la página donde guardo (compártela con la integración).", "err"); }
      const res = await IA.fetchX("https://api.notion.com/v1/pages", { method: "POST", headers: { Authorization: "Bearer " + tok, "Notion-Version": "2022-06-28", "Content-Type": "application/json" }, body: JSON.stringify(L22.notionPagina(padre, f.titulo, f.md)) });
      const j = await res.json().catch(() => ({}));
      A.setState("idle");
      if (!res.ok) return R("Notion no lo aceptó: " + ((j && j.message) || "error " + res.status) + ". Revisa la clave y que la página esté compartida con la integración.", "err");
      return pick(`📝 Guardé «${f.titulo}» en Notion.`, j.url ? [["Abrir en Notion", () => abrirUrl(j.url)]] : []);
    } catch (e) { A.setState("idle"); return R(e.message || String(e), "err"); }
  }

  // ======================================================================== 👥 NO PERDER EL CONTACTO
  const CON_ID = 797800;
  async function avisoContacto(c) { const id = idDe(c.nombre, CON_ID, 50); await cancelar(id, 1); const at = new Date((c.ultimo || c.desde) + c.dias * 864e5); at.setHours(19, 0, 0, 0); if (at.getTime() < Date.now()) at.setTime(Date.now() + 3600e3); await programar([{ id, title: "👥 Hace rato no hablas con " + c.nombre, body: `Hace ${c.dias >= 30 ? Math.round(c.dias / 30) + " mes" + (c.dias >= 60 ? "es" : "") : c.dias + " días"} no hablas con ${c.nombre}. ¿Le escribes?`, schedule: { at, allowWhileIdle: true } }]); }
  async function contacto(it) {
    D.seguirContacto = D.seguirContacto || [];
    const buscar = (n) => D.seguirContacto.find((c) => L22.norm(c.nombre).includes(L22.norm(n).replace(/^(?:mi |a |con )/, "")) || L22.norm(n).includes(L22.norm(c.nombre).replace(/^mi /, "")));
    if (it.ct === "agregar") { const c = buscar(it.nombre) || { nombre: it.nombre, desde: Date.now() }; c.dias = it.dias; if (!D.seguirContacto.includes(c)) D.seguirContacto.push(c); save(); await avisoContacto(c); return R(`👥 Listo: si pasan ${it.dias >= 30 ? Math.round(it.dias / 30) + " mes" + (it.dias >= 60 ? "es" : "") : it.dias + " días"} sin que hables con ${it.nombre}, te aviso. Cuando hables, dime «ya hablé con ${it.nombre}».`); }
    if (it.ct === "hecho") { const c = buscar(it.nombre); if (!c) return R("No te estaba recordando a esa persona. Di «recuérdame hablar con … cada mes»."); c.ultimo = Date.now(); save(); await avisoContacto(c); return R(`👥 ¡Qué bien! Anotado: hablaste con ${c.nombre}. Te vuelvo a recordar en ${c.dias} días.`); }
    if (it.ct === "quitar") { const c = buscar(it.nombre); if (!c) return R("No te estaba recordando a esa persona."); D.seguirContacto = D.seguirContacto.filter((x) => x !== c); save(); await cancelar(idDe(c.nombre, CON_ID, 50), 1); return R(`Listo, ya no te recuerdo a ${c.nombre}.`); }
    const pend = D.seguirContacto.filter((c) => L22.contactoPendiente(c, Date.now()));
    if (!D.seguirContacto.length) return R("👥 No te estoy recordando a nadie. Di «recuérdame hablar con mi tía cada mes».");
    if (!pend.length) return R("👥 Vas al día: " + D.seguirContacto.map((c) => c.nombre).join(", ") + ".");
    const quien = (n) => n.replace(/^mi\s+/i, "");
    return pick("👥 **Hace rato no hablas con:** " + pend.map((c) => c.nombre).join(", ") + ". (Te pregunto antes de llamar o escribir.)", [].concat(...pend.slice(0, 3).map((c) => [[`📞 Llamar a ${quien(c.nombre)}`, () => A.dispatch("llama a " + quien(c.nombre))], [`💬 WhatsApp a ${quien(c.nombre)}`, () => A.dispatch(`mándale un whatsapp a ${quien(c.nombre)} que cómo estás, me acordé de ti`)]])));
  }

  // ======================================================================== 🌙 SUEÑO
  function sueno(it) {
    if (it.su === "off") { aj().suenoOn = false; save(); rutina(); return R("Listo, quité la rutina de sueño."); }
    aj().suenoOn = true; aj().suenoHora = it.hora; save(); rutina();
    return R(`🌙 Listo: a las ${it.hora} es tu hora de dormir. Media hora antes te aviso${aj().suenoAjustar !== false ? " y te bajo el volumen" : ""}; si Health Connect dice que anoche dormiste menos de 6 horas, te lo recuerdo para que te acuestes a tiempo.`);
  }

  // ======================================================================== AJUSTES
  function seccion() {
    const box = $("#aj2"); if (!box || $("#aj-334")) return;
    const s = mk("div"); s.id = "aj-334";
    const chk = (cont, label, val, fn) => { const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = val; i.addEventListener("change", () => fn(i.checked)); l.append(i, document.createTextNode(" " + label)); cont.append(l); return i; };
    s.append(mk("h3", "sub", "Tu agenda y tus salidas"));
    chk(s, "Avisarme cada noche si mañana se me cruzan citas", !!aj().choquesNoche, (v) => { aj().choquesNoche = v; save(); rutina(); });
    chk(s, "Avisarme cuándo salir para las citas con dirección", !!aj().horaSalir, (v) => salir({ hs: v ? "on" : "off" }));
    const md = mk("select", "inp"); [["carro", "En carro"], ["transporte público", "En transporte público"], ["moto", "En moto"], ["bicicleta", "En bicicleta"], ["caminando", "Caminando"]].forEach(([v, t]) => md.append(new Option(t, v)));
    md.value = aj().salirModo || "carro"; md.addEventListener("change", () => { aj().salirModo = md.value; aj().salirCalc = 0; save(); }); s.append(md);
    s.append(mk("p", "hint", "Di «organiza mi tarde: llamar al banco, mercado 1 hora…» y Jarvis lo acomoda en los huecos de tu calendario (lo agenda solo si le dices que sí). El trayecto lo estima Gemini con Google Maps; no es tráfico exacto en vivo."));
    s.append(mk("h3", "sub", "Rutina de sueño"));
    const fs = mk("div", "row wrap"); const hr = mk("input", "inp"); hr.type = "time"; hr.value = aj().suenoHora || "22:00";
    hr.addEventListener("change", () => { aj().suenoHora = hr.value || "22:00"; save(); rutina(); }); fs.append(hr); s.append(fs);
    chk(s, "Avisarme media hora antes de mi hora de dormir", !!aj().suenoOn, (v) => sueno(v ? { su: "on", hora: hr.value || "22:00" } : { su: "off" }));
    chk(s, "Y bajarme el volumen a esa hora", aj().suenoAjustar !== false, (v) => { aj().suenoAjustar = v; save(); rutina(); });
    s.append(mk("h3", "sub", "Google Docs y Notion"));
    s.append(mk("p", "hint", "Google Docs y Google Sheets usan tu conexión de Google (Ajustes › Google). Para Notion: en notion.so/my-integrations crea una integración interna, copia su clave, abre la página donde quieres que Jarvis guarde, toca ··· › Conexiones › tu integración, y pega aquí la clave y el enlace de esa página."));
    const nt = mk("input", "inp"); nt.type = "password"; nt.placeholder = "Clave de Notion (ntn_… o secret_…)"; nt.value = aj().notionToken || ""; nt.addEventListener("change", () => { aj().notionToken = nt.value.trim(); save(); });
    const np = mk("input", "inp"); np.placeholder = "Enlace de la página de Notion"; np.value = aj().notionPagina || ""; np.addEventListener("change", () => { aj().notionPagina = np.value.trim(); save(); });
    s.append(nt, np);
    box.append(s);
  }

  // ======================================================================== ENGANCHES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings };
  X.intent = function (text) {
    if (String(text).length > 220 || /\n/.test(text)) return base.intent(text);
    const n = Date.now();
    const pr = L22.precioIntent(text); if (pr) return { a334: "pr", it: pr };
    const hj = L22.hojaIntent(text); if (hj) return { a334: "hj", it: hj };
    const od = L22.organizarIntent(text); if (od) return { a334: "od", it: od };
    const ag = L22.agendaIntent(text, n); if (ag) return { a334: "ag", it: ag };
    const hs = L22.salirIntent(text); if (hs) return { a334: "hs", it: hs };
    const te = L22.temasIntent(text); if (te) return { a334: "te", it: te };
    const co = L22.cocinaIntent(text); if (co) return { a334: "co", it: co };
    const vu = L22.viajeIntent(text, n); if (vu) return { a334: "vu", it: vu };
    const dc = L22.documentoIntent(text); if (dc) return { a334: "dc", it: dc };
    const ct = L22.contactoIntent(text); if (ct) return { a334: "ct", it: ct };
    const su = L22.suenoIntent(text); if (su) return { a334: "su", it: su };
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.a334) return base.run(it, text);
    switch (it.a334) {
      case "od": return organizar(it.it);
      case "ag": return choques(it.it);
      case "hs": return salir(it.it);
      case "te": return temas(it.it);
      case "co": return cocina(it.it);
      case "vu": return viaje(it.it);
      case "pr": return precios(it.it);
      case "hj": return hoja(it.it);
      case "dc": return documento(it.it);
      case "ct": return contacto(it.it);
      case "su": return sueno(it.it);
    }
  };
  X.settings = function () {
    try { base.settings(); } catch (e) { console.error(e); }
    try { seccion(); if (X._mejoras && X._mejoras.ordenarAjustes) X._mejoras.ordenarAjustes(); } catch (e) { console.error(e); }
  };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    setTimeout(() => { rutina(); calcularSalidas(false).catch(() => {}); }, 7000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) calcularSalidas(false).catch(() => {}); });
    const C = window.JL11 && window.JL11.CATALOGO;
    if (C && !C.some((x) => /Tu día, viajes/.test(x[0]))) C.push(["🗓️ Tu día, viajes y datos", ["Organiza mi tarde: llamar al banco, mercado 1 hora y estudiar 2 horas", "¿Tengo choques en mi agenda mañana?", "Avísame cuándo salir", "Sígueme el tema del dólar", "¿Qué cocino con esto?", "Mi vuelo es el AV123 mañana a las 6 de la mañana", "Avísame cuando los AirPods bajen de 900 mil", "Anota en mi hoja de ventas: 3 arepas, 15 mil", "Guarda esto en Google Docs", "Recuérdame hablar con mi tía cada mes", "Activa la rutina de sueño a las 10 de la noche"]]);
  };
  X._a334 = { organizar, choques, salir, temas, temasDia, cocina, viaje, precios, hoja, documento, contacto, sueno, rutina, calcularSalidas };
})();
