/* Jarvis para Android · voz (escuchar y hablar) y lo del teléfono (avisos, compartir, pantalla encendida).
   En la app instalada (APK) usa lo nativo de Android con los plugins de Capacitor; en Chrome, lo del navegador. */
(function () {
  "use strict";
  const cap = () => window.Capacitor;
  const native = () => !!(cap() && cap().isNativePlatform && cap().isNativePlatform());
  const plug = (n) => (cap() && cap().Plugins && cap().Plugins[n]) || null;
  const LANG = "es-CO";

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
  async function listen(onPartial) {
    stopListening();
    if (native() && plug("Oido")) return listenOido(onPartial);
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
  let oidoOk = false;
  async function listenOido(onPartial) {
    const O = plug("Oido");
    if (!oidoOk) {
      const p = await O.permiso().catch(() => ({ ok: false }));
      if (!p.ok) throw new Error("Jarvis necesita permiso para usar el micrófono. Dáselo en Ajustes del teléfono › Apps › Jarvis › Permisos.");
      oidoOk = true;
    }
    const h = await O.addListener("parcial", (d) => { if (d && d.texto && onPartial) onPartial(d.texto); }).catch(() => null);
    nativeStop = () => { O.detener().catch(() => {}); };
    try {
      const r = await O.escuchar({ idioma: LANG, silencio: 1100, maximo: 15000 });
      if (r && r.error === "permiso") { oidoOk = false; throw new Error("Jarvis no tiene permiso para el micrófono. Dáselo en Ajustes del teléfono › Apps › Jarvis › Permisos."); }
      if (r && !r.texto && r.error === "red") throw new Error("El reconocimiento de voz de Android necesita internet en este celular. Revisa la conexión o escribe la orden.");
      if (r && !r.texto && r.error === "idioma") throw new Error("Falta el español en el reconocimiento de voz del celular: Ajustes del teléfono › Google › Voz.");
      return ((r && r.texto) || "").trim();
    } finally { nativeStop = null; if (h && h.remove) h.remove(); }
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
      handles.push(await SR.addListener("partialResults", (d) => { const m = (d && d.matches) || []; if (m[0]) { last = m[0]; if (onPartial) onPartial(last); } }));
      handles.push(await SR.addListener("listeningState", (d) => { if (d && d.status === "stopped") setTimeout(finish, 150); }));
      try {
        const r = await SR.start({ language: LANG, maxResults: 1, partialResults: true, popup: false });
        if (r && r.matches && r.matches[0]) { last = r.matches[0]; finish(); }
      } catch (e) { finish(); }
      setTimeout(() => { if (!done) nativeStop && nativeStop(); }, 20000);            // nunca se queda escuchando para siempre
    });
  }
  function stopListening() {
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
      return plug("TextToSpeech").speak({ text, lang: LANG, rate: opts.rate, pitch: opts.pitch, volume: 1.0, category: "playback" }).catch(() => {});
    }
    if (!window.speechSynthesis) return Promise.resolve();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = LANG; u.rate = opts.rate; u.pitch = opts.pitch;
      if (webVoice) u.voice = webVoice;
      let ok = false;
      const end = () => { if (!ok) { ok = true; resolve(); } };
      u.onend = end; u.onerror = end;
      speechSynthesis.speak(u);
      setTimeout(end, Math.max(4000, text.length * 120));                            // por si el navegador no avisa al terminar
    });
  }
  async function pump(myGen) {
    if (speaking) return;
    speaking = true;
    if (onState) onState(true);
    while (q.length && myGen === gen) {
      const t = q.shift();
      await speakOne(t);
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
    q.push(t);
    pump(gen);
  }
  /** → promesa que se cumple cuando terminó de decir todo lo que tenía en la cola. */
  function idle() { return !speaking && !q.length ? Promise.resolve() : new Promise((r) => waiters.push(r)); }
  function hush() {
    gen++; q.length = 0;
    if (native() && plug("TextToSpeech")) plug("TextToSpeech").stop().catch(() => {});
    if (window.speechSynthesis) speechSynthesis.cancel();
    speaking = false;
    if (onState) onState(false);
    waiters.splice(0).forEach((w) => w());
  }
  function setOptions(o) { opts = Object.assign(opts, o || {}); }

  // ======================================================================== AVISOS, COMPARTIR, PANTALLA
  async function notifyAt(id, title, body, when) {
    const LN = native() && plug("LocalNotifications");
    if (LN) {
      try {
        const p = await LN.checkPermissions();
        if (p.display !== "granted") await LN.requestPermissions();
        await LN.schedule({ notifications: [{ id: numId(id), title, body, schedule: { at: new Date(when), allowWhileIdle: true } }] });
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

  window.JV = { native, canListen, listen, stopListening, cancelListening, say, idle, hush, setOptions, onSpeaking: (f) => { onState = f; }, isSpeaking: () => speaking || q.length > 0 };
  window.JN = { notifyAt, cancelNotify, showNow, share, keepAwake };
})();
