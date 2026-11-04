/* Jarvis para Android · voz (escuchar y hablar) y lo del teléfono (avisos, compartir, pantalla encendida).
   En la app instalada (APK) usa lo nativo de Android con los plugins de Capacitor; en Chrome, lo del navegador. */
(function () {
  "use strict";
  const cap = () => window.Capacitor;
  const native = () => !!(cap() && cap().isNativePlatform && cap().isNativePlatform());
  const plug = (n) => (cap() && cap().Plugins && cap().Plugins[n]) || null;
  const LANG = "es-CO";
  /** 3.3.1: en el celular, addListener de los plugins no siempre devuelve una promesa (no tiene .catch). Esto sirve en ambos casos. */
  const on = (p, ev, fn) => Promise.resolve().then(() => p.addListener(ev, fn)).catch((e) => { console.warn("addListener", ev, e); return null; });
  window.JON = on;
  /** 3.7.1: un reloj que se detiene cuando Jarvis no está en pantalla (ahorra batería) y corre una vez al volver. */
  window.JEVERY = function (ms, fn) {
    let id = null;
    const run = () => { try { fn(); } catch (e) { /* el siguiente */ } };
    const go = () => { if (id == null && !document.hidden) id = setInterval(run, ms); };
    const halt = () => { if (id != null) { clearInterval(id); id = null; } };
    document.addEventListener("visibilitychange", () => { if (document.hidden) halt(); else { run(); go(); } });
    go();
    return { stop: halt };
  };

  // ======================================================================== ESCUCHAR
  let webRec = null, nativeStop = null;
  async function canListen() {
    if (native() && plug("Oido")) { try { return (await plug("Oido").disponible()).disponible; } catch (e) { /* abajo */ } }
    if (native() && plug("SpeechRecognition")) {
      try { return (await plug("SpeechRecognition").available()).available; } catch (e) { return false; }
    }
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
  /** Escucha una frase. onPartial(texto) mientras hablas. → texto final ("" si no se oyó nada). */
  /** opts: {espera: ms que espera a que empieces a hablar, silencio: ms de pausa que da por terminada la frase} */
  async function listen(onPartial, opts) {
    stopListening();
    // 3.13: sin internet (o si lo escogiste), Gemma 4 entiende tu voz dentro del celular
    if (window.__gemmaVoz && window.__gemmaVoz.usar()) { try { return await window.__gemmaVoz.oir(onPartial, opts); } catch (e) { console.warn("Gemma no pudo oír", e); } }
    if (native() && plug("Oido") && oidoFallas < 2) return listenOido(onPartial, opts);
    if (native() && plug("SpeechRecognition")) return listenNative(onPartial);
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) throw new Error("Este navegador no reconoce la voz. Escribe la orden, o instala la app de Jarvis.");
    return new Promise((resolve, reject) => {
      const r = new R();
      webRec = r;
      r.lang = LANG; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
      let final = "", last = "";
      r.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript; else interim += e.results[i][0].transcript;
        }
        last = (final + " " + interim).trim();
        if (onPartial) onPartial(last);
      };
      r.onerror = (e) => {
        webRec = null;
        if (e.error === "no-speech" || e.error === "aborted") resolve("");
        else if (e.error === "not-allowed" || e.error === "service-not-allowed") reject(new Error("Jarvis no tiene permiso para usar el micrófono. Actívalo en los permisos del navegador."));
        else reject(new Error("No pude escuchar (" + e.error + ")."));
      };
      r.onend = () => { webRec = null; resolve((final || last).trim()); };
      try { r.start(); } catch (e) { reject(e); }
    });
  }
  /** 3.1: el oído propio de la app (OidoPlugin.java). Siempre termina: con lo que oyó, o vacío si no oyó nada. */
  let oidoOk = false, oidoFallas = 0;
  let onListenState = null, lastListen = null;
  const MOTOR = { google: "reconocimiento de Google", celular: "reconocimiento del celular", vosk: "voz sin internet (Vosk)" };
  async function listenOido(onPartial, opts) {
    const O = plug("Oido");
    if (!oidoOk) {
      const p = await Promise.race([O.permiso(), new Promise((r) => setTimeout(() => r({ ok: "espera" }), 20000))]).catch(() => ({ ok: false }));
      if (!p.ok) throw new Error("Jarvis necesita permiso para usar el micrófono. Dáselo en Ajustes del teléfono › Apps › Jarvis › Permisos › Micrófono.");
      oidoOk = true;
    }
    const h = await on(O, "parcial", (d) => { if (d && d.texto && onPartial) onPartial(d.texto); });
    const h2 = await on(O, "estado", (d) => { if (onListenState && d) onListenState(d.s, d); });
    nativeStop = () => { O.detener().catch(() => {}); };
    try {
      const o = opts || {};
      const r = (await O.escuchar({ idioma: LANG, silencio: o.silencio || 1600, espera: o.espera || 9000, maximo: 15000 })) || {};
      lastListen = r;
      if (r.error === "permiso") { oidoOk = false; throw new Error("Jarvis no tiene permiso para el micrófono. Dáselo en Ajustes del teléfono › Apps › Jarvis › Permisos › Micrófono."); }
      if (!r.texto && r.error === "red") throw new Error("El reconocimiento de voz necesita internet en este celular. Revisa la conexión, o descarga la voz sin internet en Ajustes › «Jarvis» en segundo plano.");
      if (!r.texto && r.error === "idioma") throw new Error("Falta el español en el reconocimiento de voz del celular: Ajustes del teléfono › Google › Voz › Idiomas.");
      if (!r.texto && r.error === "sin_servicio") throw new Error("Este celular no tiene reconocimiento de voz. Instala o activa la app de Google, o descarga la voz sin internet en Ajustes › «Jarvis» en segundo plano.");
      // si el oído propio no sirvió en este celular, se prueba el reconocimiento de antes
      if (!r.texto && r.error && !/^(?:cancelado|otra|sin_respuesta)$/.test(r.error) && plug("SpeechRecognition")) {
        oidoFallas++; console.warn("Oído:", r.error);
        nativeStop = null; if (h && h.remove) h.remove();
        const t = await listenNative(onPartial);
        if (!t) throw new Error(`El micrófono no respondió (${r.motor || "voz"}: ${r.error}). Toca Ajustes › Probar el micrófono para ver qué pasa.`);
        return t;
      }
      if (r.texto) oidoFallas = 0;
      return (r.texto || "").trim();
    } finally { nativeStop = null; if (h && h.remove) h.remove(); if (h2 && h2.remove) h2.remove(); }
  }
  /** Prueba completa del micrófono (Ajustes): qué tiene el celular, y una escucha de prueba por cada camino. */
  async function micTest(onLine) {
    const O = native() && plug("Oido");
    if (!O) { onLine("En el navegador: " + (window.SpeechRecognition || window.webkitSpeechRecognition ? "sí reconoce voz." : "este navegador no reconoce voz.")); return; }
    const d = await O.diagnostico();
    onLine(`Celular: ${d.equipo} · Android ${d.android}`);
    onLine(`Permiso del micrófono: ${d.permiso ? "sí ✓" : "NO ✗ (dáselo en Ajustes del teléfono › Apps › Jarvis › Permisos)"}`);
    onLine(`Reconocimiento de Google: ${d.google ? "sí ✓" : "no"} · del celular: ${d.celular ? "sí ✓" : "no"} · sin internet (Vosk): ${d.vosk ? "sí ✓" : "no descargado"}`);
    onLine(`Servicio de voz: ${d.servicio || "(ninguno escogido)"}${d.servicios && d.servicios.length ? " · instalados: " + d.servicios.join(", ") : " · NINGUNO instalado"}`);
    if (d.fondoActivo) onLine(`«Jarvis» en segundo plano: activo${d.fondoGrabando ? " (tiene el micrófono; se suelta para la prueba)" : ""}`);
    if (d.ultimoError) onLine(`Último error: ${d.ultimoError}`);
    if (!d.permiso) { const p = await O.permiso(); onLine(p.ok ? "Permiso concedido ✓" : "Sin permiso: no puedo probar."); if (!p.ok) return; oidoOk = true; }
    for (const m of ["google", "celular", "vosk"]) {
      if ((m === "google" && !d.google) || (m === "celular" && !d.celular) || (m === "vosk" && !d.vosk)) continue;
      onLine(`▶ ${MOTOR[m]}: di algo ahora…`);
      const h = await on(O, "estado", (e) => { if (e.s === "listo") onLine("   escuchando ✓"); if (e.s === "habla") onLine("   te oigo ✓"); });
      const hp = await on(O, "parcial", (e) => { if (e && e.texto) onLine("   «" + e.texto + "»", true); });
      let r = {};
      try { r = await O.escuchar({ idioma: LANG, silencio: 1100, maximo: 8000, motor: m }); } catch (e) { r = { error: e.message }; }
      if (h && h.remove) h.remove(); if (hp && hp.remove) hp.remove();
      onLine(r.texto ? `   ✓ Funciona: «${r.texto}»` : `   ✗ No oyó nada${r.error ? " (" + r.error + ")" : ""}${r.nivel != null && r.nivel > -100 ? " · volumen máx. " + r.nivel + " dB" : ""}`);
      if (r.texto) { onLine("Listo: el micrófono funciona con " + MOTOR[m] + "."); return; }
    }
    onLine("Ningún camino oyó tu voz. Revisa: que ninguna otra app esté usando el micrófono, el permiso, y que la app de Google esté instalada. Si tienes «Jarvis en segundo plano», descarga su modelo: así la conversación también funciona sin Google.");
  }
  async function listenNative(onPartial) {
    const SR = plug("SpeechRecognition");
    const perm = await SR.checkPermissions().catch(() => ({}));
    if (perm.speechRecognition !== "granted") {
      const r = await SR.requestPermissions();
      if (r.speechRecognition !== "granted") throw new Error("Jarvis necesita permiso para usar el micrófono. Dáselo en Ajustes del teléfono › Apps › Jarvis.");
    }
    return new Promise(async (resolve) => {
      let last = "", done = false;
      const handles = [];
      const finish = () => { if (done) return; done = true; handles.forEach((h) => h && h.remove && h.remove()); nativeStop = null; resolve(last.trim()); };
      nativeStop = () => { SR.stop().catch(() => {}); finish(); };
      handles.push(await on(SR, "partialResults", (d) => { const m = (d && d.matches) || []; if (m[0]) { last = m[0]; if (onPartial) onPartial(last); } }));
      handles.push(await on(SR, "listeningState", (d) => { if (d && d.status === "stopped") setTimeout(finish, 150); }));
      try {
        const r = await SR.start({ language: LANG, maxResults: 1, partialResults: true, popup: false });
        if (r && r.matches && r.matches[0]) { last = r.matches[0]; finish(); }
      } catch (e) { finish(); }
      setTimeout(() => { if (!done) nativeStop && nativeStop(); }, 20000);            // nunca se queda escuchando para siempre
    });
  }
  function stopListening() {
    if (window.__gemmaVoz) window.__gemmaVoz.parar();
    if (webRec) { try { webRec.stop(); } catch (e) { /* ya paró */ } }
    if (nativeStop) nativeStop();
  }
  /** Corta en seco (sin esperar lo que alcanzó a oír): al salir de la app o al tocar Callar. */
  function cancelListening() {
    if (native() && plug("Oido")) plug("Oido").cancelar().catch(() => {});
    stopListening();
  }

  // ======================================================================== HABLAR (cola de frases)
  const q = [];
  let speaking = false, gen = 0, opts = { rate: 1, pitch: 1 }, webVoice = null, onState = null;
  function pickWebVoice() {
    if (!window.speechSynthesis) return null;
    const vs = speechSynthesis.getVoices().filter((v) => /^es/i.test(v.lang));
    const rank = (v) => (/es[-_]CO/i.test(v.lang) ? 0 : /es[-_](MX|US|419)/i.test(v.lang) ? 1 : 2) + (/google|natural|neural/i.test(v.name) ? -0.5 : 0);
    return vs.sort((a, b) => rank(a) - rank(b))[0] || null;
  }
  if (window.speechSynthesis) { speechSynthesis.onvoiceschanged = () => { webVoice = pickWebVoice(); }; webVoice = pickWebVoice(); }
  function speakOne(text) {
    if (native() && plug("TextToSpeech")) {
      const o = { text, lang: LANG, rate: opts.rate, pitch: opts.pitch, volume: 1.0, category: "playback" };
      if (opts.voice != null && opts.voice >= 0) o.voice = opts.voice;                   // 3.4: la voz que escogiste en Ajustes
      return plug("TextToSpeech").speak(o).catch(() => plug("TextToSpeech").speak({ text, lang: LANG, rate: opts.rate, pitch: opts.pitch, volume: 1.0 }).catch(() => {}));
    }
    if (!window.speechSynthesis) return Promise.resolve();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = LANG; u.rate = opts.rate; u.pitch = opts.pitch;
      if (opts.webVoice && window.speechSynthesis) { const v = speechSynthesis.getVoices().find((x) => x.name === opts.webVoice); if (v) u.voice = v; else if (webVoice) u.voice = webVoice; }
      else if (webVoice) u.voice = webVoice;
      let ok = false;
      const end = () => { if (!ok) { ok = true; resolve(); } };
      u.onend = end; u.onerror = end;
      speechSynthesis.speak(u);
      setTimeout(end, Math.max(4000, text.length * 120));                            // por si el navegador no avisa al terminar
    });
  }
  /** 3.7: voz con IA. speaker = {prepare(texto) → promesa de audio, play(audio) → promesa, stop()}; si falla, habla el celular. */
  let speaker = null;
  function setSpeaker(sp) { speaker = sp; }
  async function speakItem(it) {
    if (it.pre) {
      try {
        const audio = await Promise.race([it.pre, new Promise((r) => setTimeout(() => r(null), 8000))]);
        if (audio && speaker) { await speaker.play(audio); return; }
      } catch (e) { /* habla el celular */ }
    }
    return speakOne(it.t);
  }
  async function pump(myGen) {
    if (speaking) return;
    speaking = true;
    if (onState) onState(true);
    while (q.length && myGen === gen) {
      const it = q.shift();
      await speakItem(it);
    }
    speaking = false;
    if (onState && myGen === gen) onState(false);
    waiters.splice(0).forEach((w) => w());
  }
  const waiters = [];
  /** Agrega una frase a la cola (la IA va mandando frases mientras piensa). */
  function say(text) {
    const t = String(text || "").trim();
    if (!t) return;
    let pre = null;
    if (speaker) { try { pre = speaker.prepare(t); if (pre && pre.catch) pre.catch(() => null); } catch (e) { pre = null; } }   // se pide el audio de una vez: mientras dice una frase, ya viene la otra
    q.push({ t, pre });
    pump(gen);
  }
  /** → promesa que se cumple cuando terminó de decir todo lo que tenía en la cola. */
  function idle() { return !speaking && !q.length ? Promise.resolve() : new Promise((r) => waiters.push(r)); }
  function hush() {
    gen++; q.length = 0;
    if (speaker && speaker.stop) { try { speaker.stop(); } catch (e) { /* nada */ } }
    if (native() && plug("TextToSpeech")) plug("TextToSpeech").stop().catch(() => {});
    if (window.speechSynthesis) speechSynthesis.cancel();
    speaking = false;
    if (onState) onState(false);
    waiters.splice(0).forEach((w) => w());
  }
  function setOptions(o) { opts = Object.assign(opts, o || {}); }

  // ======================================================================== AVISOS, COMPARTIR, PANTALLA
  let tiposListos = false;
  async function notifyAt(id, title, body, when, extra) {
    const LN = native() && plug("LocalNotifications");
    if (LN) {
      try {
        const p = await LN.checkPermissions();
        if (p.display !== "granted") await LN.requestPermissions();
        const n = { id: numId(id), title, body, schedule: { at: new Date(when), allowWhileIdle: true }, extra: { rid: String(id) } };
        // 3.4: los recordatorios llegan con «Posponer 10 min» y «Listo»
        if (extra && extra.acciones) {
          if (!tiposListos) { try { await LN.registerActionTypes({ types: [{ id: "recordatorio", actions: [{ id: "posponer", title: "Posponer 10 min" }, { id: "listo", title: "Listo" }] }, { id: "jarvis_med", actions: [{ id: "tomada", title: "✅ Ya la tomé" }, { id: "luego", title: "⏰ En 10 minutos" }] }] }); tiposListos = true; } catch (e) { /* sin botones */ } }
          if (tiposListos) n.actionTypeId = "recordatorio";
        }
        await LN.schedule({ notifications: [n] });
        return true;
      } catch (e) { return false; }
    }
    if ("Notification" in window && Notification.permission === "default") { try { await Notification.requestPermission(); } catch (e) { /* nada */ } }
    return false;                                                                     // en el navegador avisa la propia app mientras está abierta
  }
  async function cancelNotify(id) {
    const LN = native() && plug("LocalNotifications");
    if (LN) { try { await LN.cancel({ notifications: [{ id: numId(id) }] }); } catch (e) { /* ya no estaba */ } }
  }
  function showNow(title, body) {
    if (!native() && "Notification" in window && Notification.permission === "granted" && document.hidden) {
      try { new Notification(title, { body, icon: "img/icono-192.png" }); } catch (e) { /* algunos navegadores solo desde el service worker */ }
    }
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 500]);
  }
  function numId(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 2000000000; }

  /** Comparte un archivo (PDF, CSV) o un texto: WhatsApp, correo, Drive… */
  async function share({ title, text, fileName, mime, base64 }) {
    if (native() && plug("Share")) {
      let files;
      if (base64 && plug("Filesystem")) {
        const w = await plug("Filesystem").writeFile({ path: fileName, data: base64, directory: "CACHE" });
        files = [w.uri];
      }
      await plug("Share").share({ title, text: files ? undefined : text, files, dialogTitle: title });
      return "compartido";
    }
    if (base64) {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const file = new File([bytes], fileName, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ title, files: [file] }); return "compartido"; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file); a.download = fileName; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      return "descargado";
    }
    if (navigator.share) { await navigator.share({ title, text }); return "compartido"; }
    await navigator.clipboard.writeText(text);
    return "copiado";
  }
  let wakeLock = null;
  async function keepAwake(on) {
    const KA = native() && plug("KeepAwake");
    try {
      if (KA) { await (on ? KA.keepAwake() : KA.allowSleep()); return; }
      if (on && navigator.wakeLock) wakeLock = await navigator.wakeLock.request("screen");
      else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { /* no es grave */ }
  }

  window.JV = { setSpeaker, micTest, onListenState: (f) => { onListenState = f; }, lastListen: () => lastListen, native, canListen, listen, stopListening, cancelListening, say, idle, hush, setOptions, onSpeaking: (f) => { onState = f; }, isSpeaking: () => speaking || q.length > 0 };
  window.JN = { notifyAt, cancelNotify, showNow, share, keepAwake };
})();
