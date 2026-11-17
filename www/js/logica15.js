/* Jarvis para Android 3.24 · lógica pura (se prueba con node).
   Nexo Escritorio (el celular como computador en un monitor): entender las órdenes de voz para el escritorio,
   las escenas («Trabajo: Chrome izquierda, Word derecha») y lo que la IA necesita saber para manejarlo. */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!;«»"“”.]/g, " ").replace(/\s+/g, " ").trim();
  const PAQUETE = "com.nexo.escritorio";
  const DESCARGA = "https://github.com/maryangeld2026-hash/Voltix-apk/releases/download/nexo-escritorio/NexoEscritorio.apk";

  /** [modo, cómo se dice] · el modo es el que entiende Nexo. */
  const MODOS = [
    ["izquierda", /\b(?:a|en) la (?:mitad )?izquierda\b|\bizquierda\b/],
    ["derecha", /\b(?:a|en) la (?:mitad )?derecha\b|\bderecha\b/],
    ["completa", /\b(?:a|en) pantalla completa\b|\bpantalla completa\b/],
    ["maximizada", /\bmaximizad[ao]\b|\bmaximiza(?:r|da)?\b|\ben grande\b/],
    ["ventana", /\ben (?:una )?ventana(?: flotante| pequena)?\b|\bventana\b/],
  ];
  const NOMBRE_MODO = { izquierda: "a la izquierda", derecha: "a la derecha", completa: "a pantalla completa", maximizada: "maximizada", ventana: "en ventana", "": "" };
  /** «en el monitor», «en el escritorio», «en la tele»… */
  const LUGAR = /\s*(?:,\s*)?\b(?:en|al|del|para)\s+(?:el\s+|la\s+)?(?:monitor|escritorio|nexo|tv|tele|televisor|pantalla grande|pantalla externa|computador del celular)\b/;
  const VERBO = /^(?:abre(?:me)?|abrir|pon(?:me)?|lanza|inicia|muestra(?:me)?)\s+/;

  function modoDe(s) {
    for (const [m, re] of MODOS) if (re.test(s)) return m;
    return "";
  }
  function quitarModo(s) {
    let r = s.replace(LUGAR, " ");
    for (const [, re] of MODOS) r = r.replace(re, " ");
    return r.replace(/\b(?:la app(?: de)?|la aplicacion(?: de)?)\b/g, " ").replace(/^(?:el|la|los|las)\s+/, "").replace(/\s+/g, " ").trim();
  }

  /** Órdenes para Nexo → {nx, …} o null. */
  function nexoIntent(text) {
    let t = norm(text).replace(/^(?:jarvis|oye jarvis|por favor)[\s,]+/, "").replace(/\s+por favor$/, "").trim();
    if (!t) return null;
    const esc = "(?:el\\s+)?(?:modo\\s+)?(?:escritorio|nexo(?: escritorio)?|modo pc|modo computador|computador del celular)";
    // abrir / escritorio en el celular
    let m = t.match(new RegExp(`^(?:abre(?:me)?|abrir|activa|pon(?:me)?|inicia|enciende|lanza|quiero|conecta)\\s+${esc}(?:\\s+(?:en|al|a)\\s+(?:el\\s+|la\\s+)?(monitor|tv|tele|televisor|pantalla(?: grande| externa)?|celular|telefono|movil))?$`));
    if (m) return { nx: m[1] && /celular|telefono|movil/.test(m[1]) ? "aqui" : "abrir" };
    if (new RegExp(`^${esc}\\s+en\\s+(?:el\\s+)?(?:celular|telefono|movil)$`).test(t)) return { nx: "aqui" };
    if (/^(?:proyecta(?:me)?|manda|pasa)\s+(?:el\s+)?(?:celular|telefono)\s+(?:al|a la)\s+(?:monitor|tv|tele|televisor|pantalla)$/.test(t)) return { nx: "abrir" };
    // conectar: buscar pantallas inalámbricas o las formas de conexión
    if (/^(?:busca(?:r)?|buscame)\s+(?:las\s+)?(?:pantallas|televisores|teles|tvs?)(?:\s+(?:inalambricas|cercanas))?$|^(?:conecta(?:me)?|proyecta(?:me)?|duplica(?:me)?)\s+(?:a\s+)?(?:la\s+|el\s+)?(?:tele|tv|televisor|smart tv)(?:\s+(?:inalambrica|por wi ?fi|sin cable))?$|^(?:conexion|pantalla) inalambrica$|^miracast$/.test(t)) return { nx: "pantallas" };
    if (/^(?:como (?:conecto|conectar|se conecta)|formas de (?:conexion|conectar)|como (?:pongo|abro) el escritorio en)\b.*(?:monitor|tv|tele|televisor|escritorio|nexo|pantalla|computador)?/.test(t) && /monitor|tv|tele|televisor|escritorio|nexo|pantalla|computador|conexion/.test(t)) return { nx: "formas" };
    if (/^(?:prepara(?:r)?|configura(?:r)?)\s+(?:el\s+)?(?:celular|telefono)\s+(?:para|con)\s+(?:el\s+)?(?:escritorio|nexo)$/.test(t)) return { nx: "preparar" };
    // cerrar
    if (new RegExp(`^(?:cierra|cerrar|sal(?:ir)?(?: del)?|apaga|quita|termina)\\s+(?:del\\s+)?${esc}$`).test(t)) return { nx: "cerrar" };
    // mostrar el escritorio, menú de inicio, centro de control, ajustes, touchpad
    if (/^(?:muestra(?:me)?|ve al|vuelve al|ir al|mostrar)\s+(?:el\s+)?escritorio$|^minimiza(?:r)? todo(?: en el monitor)?$/.test(t)) return { nx: "mostrar" };
    if (/^(?:abre|abrir|pon|muestra(?:me)?)?\s*(?:el\s+)?menu (?:de\s+)?inicio(?:\s+del escritorio| en el monitor)?$/.test(t)) return { nx: "inicio" };
    if (/^(?:abre|abrir|muestra(?:me)?)?\s*(?:el\s+)?centro de control(?:\s+del escritorio| en el monitor| de nexo)?$/.test(t)) return { nx: "panel" };
    if (/^(?:abre|abrir|muestra(?:me)?)\s+(?:los\s+)?ajustes (?:de nexo|del escritorio)$/.test(t)) return { nx: "ajustes" };
    if (/^(?:abre|abrir|activa|pon|usa|quiero)\s+(?:el\s+)?(?:touchpad|touch pad|panel tactil|mouse|raton)(?:\s+(?:del escritorio|en el celular|de nexo))?$/.test(t)) return { nx: "touchpad" };
    // estado
    if (/^(?:esta|hay)\s+(?:conectad[oa]\s+)?(?:el\s+|un\s+|algun\s+)?(?:monitor|tv|televisor)(?:\s+conectad[oa])?$|^estado del escritorio$|^(?:el\s+)?escritorio esta abierto$|^(?:como|que tal) (?:esta|va) el escritorio$/.test(t)) return { nx: "estado" };
    // buscar en el monitor
    m = t.match(/^(?:busca(?:me)?|buscar|googlea)\s+(.+?)\s+(?:en|al)\s+(?:el\s+|la\s+)?(?:monitor|escritorio|tv|tele|televisor|pantalla grande)$/);
    if (m) return { nx: "buscar", q: m[1].trim() };
    // apps en el escritorio: «abre Chrome a la izquierda y Word a la derecha en el monitor»
    if (VERBO.test(t)) {
      const enLugar = LUGAR.test(t);
      const resto = t.replace(VERBO, "");
      const partes = resto.split(/\s*,\s*|\s+y\s+(?=\S)/).map((s) => s.trim()).filter(Boolean);
      const lista = [];
      let alguno = enLugar;
      for (const p of partes) {
        const modo = modoDe(p), app = quitarModo(p);
        if (modo) alguno = true;
        if (!app || app.length > 40) return null;
        lista.push({ app, modo });
      }
      // «abre YouTube» a secas es para el celular; con un lugar o una forma de ventana va para Nexo
      if (!alguno || !lista.length) return null;
      if (lista.length > 6) return null;
      if (lista.some((x) => /^(?:escritorio|monitor|nexo|menu|centro de control|touchpad)$/.test(x.app))) return null;
      return lista.length === 1 ? { nx: "app", app: lista[0].app, modo: lista[0].modo } : { nx: "apps", lista };
    }
    return null;
  }

  // ======================================================================== FORMAS DE CONEXIÓN
  /** [clave, ícono, título, para quién, cómo, acción] · acción: lo que hace el botón de la tarjeta */
  const FORMAS = [
    ["cable", "🔌", "Cable USB‑C a HDMI", "Celulares con salida de video por USB‑C (DisplayPort): por ejemplo Samsung Galaxy S, Note y Tab, Motorola Edge y otros de gama alta (en la ficha del celular dice «DisplayPort» o «salida de video»).",
      "Conecta el adaptador o el hub USB‑C a HDMI al monitor o la TV. El escritorio se abre solo; si no, toca «Abrir en el monitor». Con un hub puedes cargar y conectar teclado y ratón al mismo tiempo.", "abrir"],
    ["inalambrica", "📡", "Inalámbrica (Miracast)", "Smart TV o Fire TV con «Screen mirroring/Miracast», o un PC con Windows («Proyectar a este equipo»). Chromecast solo duplica la pantalla: para él usa «En este celular». La TV y el celular en la misma red Wi‑Fi.",
      "Toca «Buscar pantallas», escoge tu TV o PC y espera a que conecte. Nexo abre el escritorio en esa pantalla. Hay un poco de retraso: para juegos rápidos es mejor el cable o el computador.", "pantallas"],
    ["computador", "💻", "Computador (scrcpy)", "Casi cualquier Android 10 o más nuevo, también sin salida de video. Necesitas scrcpy en el computador y la depuración USB activada.",
      "Conecta el celular al computador con el cable y ejecuta el comando de abajo. El celular crea una pantalla nueva que se ve en el computador, con sonido; Nexo la detecta y abre el escritorio ahí.", "comandos"],
    ["celular", "📱", "En este celular", "Cualquier celular.",
      "El escritorio en la pantalla del celular, en horizontal. Para verlo grande, duplica el celular en la TV (Proyectar/Smart View) o conecta teclado y ratón por Bluetooth.", "aqui"],
  ];
  const SCRCPY = {
    cable: "scrcpy --new-display=1920x1080/160 --start-app=com.nexo.escritorio",
    wifi1: "adb tcpip 5555",
    wifi2: "scrcpy --tcpip=IP_DEL_CELULAR:5555 --new-display=1920x1080/160 --start-app=com.nexo.escritorio",
  };
  const ADB_PREPARAR = [
    "adb shell settings put global enable_freeform_support 1",
    "adb shell settings put global force_resizable_activities 1",
    "adb shell settings put global force_desktop_mode_on_external_displays 1",
    "adb reboot",
  ];
  /** Por el nombre de la pantalla conectada: ¿cable, inalámbrica o computador? */
  function tipoConexion(nombre) {
    const n = norm(nombre);
    if (!n) return "";
    if (/scrcpy|virtual/.test(n)) return "computador";
    if (/wireless|wi ?fi|miracast|cast|inalambrica|mirror|smart view|proyecci|wfd/.test(n)) return "inalambrica";
    return "cable";
  }

  // ======================================================================== ESCENAS
  /** «Trabajo: Chrome izquierda, Word derecha» → {nombre, apps:[{app, modo}]} o null. */
  function parseEscena(linea) {
    const m = String(linea || "").match(/^\s*([^:=]{2,30}?)\s*[:=]\s*(.+)$/);
    if (!m) return null;
    const apps = m[2].split(/\s*[,;]\s*|\s+y\s+/).map((s) => s.trim()).filter(Boolean).map((p) => {
      const n = norm(p), modo = modoDe(n);
      return { app: quitarModo(n), modo };
    }).filter((x) => x.app);
    if (!apps.length || apps.length > 6) return null;
    return { nombre: m[1].trim(), apps };
  }
  function escenasDe(texto) {
    return String(texto || "").split(/\n+/).map(parseEscena).filter(Boolean);
  }
  /** «pon el escritorio de trabajo», «modo trabajo en el monitor», «escena cine» → la escena o null. */
  function escenaIntent(text, escenas) {
    const t = norm(text).replace(/^(?:jarvis|oye jarvis)[\s,]+/, "");
    const m = t.match(/^(?:pon(?:me)?|arma(?:me)?|prepara(?:me)?|organiza(?:me)?|activa|abre|abreme)?\s*(?:el\s+)?(?:escritorio|modo|escena|monitor)\s+(?:de\s+|para\s+|en\s+modo\s+)?(?:el\s+|la\s+)?(.+?)(?:\s+en el (?:monitor|escritorio))?$/);
    if (!m) return null;
    const q = m[1].trim();
    return (escenas || []).find((e) => norm(e.nombre) === q) || null;
  }

  // ======================================================================== LO QUE SABE LA IA
  /** Lo que se agrega a las instrucciones de la IA cuando Nexo está instalado. estado: {abierto, monitor, dondeAbierto} */
  function prompt(estado, escenas) {
    const e = estado || {};
    let s = " También manejas Nexo Escritorio (el celular como computador en un monitor o TV, con ventanas). Órdenes: «abre el escritorio», «escritorio en el celular», " +
      "«abre Chrome a la izquierda en el monitor», «abre Word a la derecha en el monitor», «abre YouTube a pantalla completa en el monitor», «abre Spotify en ventana en el monitor», " +
      "«busca pantallas» (conectar la TV sin cable), «¿cómo conecto el monitor?», «busca … en el monitor», «muestra el escritorio», «abre el menú de inicio», «abre el centro de control», «abre el touchpad», «cierra el escritorio». " +
      "Para organizar el escritorio escribe una orden por app (<<orden: abre chrome a la izquierda en el monitor>>).";
    if (e.monitor) s += ` Hay un monitor conectado (${e.monitor}).`;
    if (e.abierto) s += ` El escritorio está abierto${e.dondeAbierto === "celular" ? " en el celular" : " en el monitor"}.`;
    if (escenas && escenas.length) s += ` Escenas guardadas: ${escenas.map((x) => x.nombre).join(", ")} («pon el escritorio de ${norm(escenas[0].nombre)}»).`;
    return s;
  }

  /** Cómo se lee una orden en la conversación. */
  function describir(it) {
    switch (it.nx) {
      case "abrir": return "Abro el escritorio en el monitor.";
      case "aqui": return "Abro el escritorio en el celular.";
      case "mostrar": return "El escritorio al frente.";
      case "inicio": return "Abro el menú de inicio.";
      case "panel": return "Abro el centro de control.";
      case "ajustes": return "Abro los ajustes de Nexo.";
      case "touchpad": return "Abro el touchpad.";
      case "cerrar": return "Cierro el escritorio.";
      case "estado": return "Miro el escritorio…";
      case "pantallas": return "Abro «Proyectar»: escoge tu TV o tu PC y Nexo abre el escritorio ahí.";
      case "formas": return "Estas son las formas de conectar el escritorio:";
      case "preparar": return "Para preparar el celular (una sola vez):";
      case "buscar": return `Busco «${it.q}» en el monitor.`;
      case "app": return `Abro ${it.app} ${NOMBRE_MODO[it.modo || ""] || ""} en el monitor.`.replace(/\s+/g, " ").replace(" .", ".");
      case "apps": return "Organizo el escritorio: " + it.lista.map((x) => `${x.app}${x.modo ? " " + NOMBRE_MODO[x.modo] : ""}`).join(", ") + ".";
    }
    return "";
  }

  const API = { norm, PAQUETE, DESCARGA, FORMAS, SCRCPY, ADB_PREPARAR, tipoConexion, MODOS, NOMBRE_MODO, modoDe, nexoIntent, parseEscena, escenasDe, escenaIntent, prompt, describir };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL15 = API;
})(typeof window !== "undefined" ? window : globalThis);
