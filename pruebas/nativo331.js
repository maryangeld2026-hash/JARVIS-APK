window.__log = []; window.__cola = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
const anyP = (o) => new Proxy(o, { get: (t, n) => (n in t ? t[n] : n === 'then' ? undefined : async () => ({})) });
const generic = { addListener: on, modelo: async () => ({}), estado: async () => ({}), checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), schedule: async () => {}, cancel: async () => {}, registerActionTypes: async () => {},
  keepAwake: async () => {}, allowSleep: async () => {}, config: async () => {}, bateriaEstado: async () => ({ nivel: 80 }), stop: async () => {}, speak: async (o) => { window.__said.push(o.text); }, getSupportedVoices: async () => ({ voices: [] }) };
const generic2 = anyP(generic); const H = 3600e3; const P = {
  LocalNotifications: anyP({ addListener: on, schedule: async (o) => { (o.notifications || []).forEach((n) => log('noti ' + n.id + ' ' + n.title)); }, cancel: async () => {}, checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }), registerActionTypes: async () => {} }),
  Dictado: anyP({ addListener: on, estado: async () => ({ listo: true, motor: true }), transcribirAudio: async (o) => { log('whisper ' + o.base64.length); return { texto: 'Hola profe, mañana no puedo ir a la reunión.', seg: 4 }; } }),
  Salud: anyP({ estado: async () => ({ estado: 'listo', permisos: 3 }), conectar: async () => ({ estado: 'listo', permisos: 3 }),
    resumen: async () => ({ pasos: [{ dia: (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })(), n: 4321 }], sueno: [{ ini: Date.now() - 31 * H, fin: Date.now() - 24 * H }, { ini: Date.now() - 9 * H, fin: Date.now() - 2 * H }], pulso: { prom: 70, min: 55, max: 110 } }) }),
  Clima: anyP({ config: async (o) => log('clima ' + o.on + ' ' + (o.lat || '')), probar: async () => ({ hay: true, texto: '🌧️ Lluvia fuerte hacia las 3 p. m. (85 %). Lleva paraguas.' }) }),
  Celular: anyP({ silencio: async (o) => { log(`silencio ${o.quien} ${o.min}`); return { permiso: true }; }, quitarSilencio: async () => log('fin silencio') }),
  Lugares: anyP({ aqui: async () => ({ lat: 4.65, lng: -74.05 }) }),
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  Telefono: anyP({ addListener: on, checkPermissions: async () => ({}), contactos: async () => ({ lista: [] }), apps: async () => ({ lista: [] }) }),
  Ventana: anyP({ addListener: on, pendientes: async () => ({ lista: window.__cola.splice(0) }), abrir: async (o) => log('url ' + o.url) }),
  Share: anyP({ share: async (o) => log('share ' + (o.files || []).join(',')) }), Filesystem: anyP({ writeFile: async (o) => ({ uri: 'file://' + o.path }) }),
};
window.Capacitor = { isNativePlatform: () => true, Plugins: new Proxy({}, { get: (t, n) => P[n] || (n === 'SpeechRecognition' || n === 'Escaner' || n === 'Calendario' || n === 'Oido' || n === 'IALocal' || n === 'VozNeural' ? undefined : generic2) }) };
