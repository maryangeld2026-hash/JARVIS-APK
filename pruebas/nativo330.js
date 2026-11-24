window.__log = []; window.__cola = []; window.__idx = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
const anyP = (o) => new Proxy(o, { get: (t, n) => (n in t ? t[n] : n === 'then' ? undefined : async () => ({})) });
const generic = { addListener: on, modelo: async () => ({}), estado: async () => ({}), checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), schedule: async () => {}, cancel: async () => {}, registerActionTypes: async () => {},
  keepAwake: async () => {}, allowSleep: async () => {}, config: async () => {}, bateriaEstado: async () => ({ nivel: 80 }), stop: async () => {}, speak: async (o) => { window.__said.push(o.text); }, getSupportedVoices: async () => ({ voices: [] }) };
const generic2 = anyP(generic); const GB = 1073741824; const P = {
  IALocal: anyP({ addListener: on, estado: async () => ({ listo: false }), nanoEstado: async () => ({ estado: 'disponible', activo: false }), nanoPreparar: async () => { log('nano'); return { ok: true }; } }),
  Dictado: anyP({ addListener: on, estado: async () => ({ listo: false }), grabarAudio: async (o) => { log('grabar ' + o.maximo); return { wav: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=', seg: 42, nivel: -20 }; }, detener: async () => {} }),
  Celular: anyP({ espacio: async () => ({ total: 128 * GB, libre: 9 * GB, jarvis: [{ que: 'IA del celular (modelos)', carpeta: 'ia-local', bytes: 2.6 * GB }], cache: 80 * 1048576 }),
    liberar: async () => log('liberar'), borrarCache: async () => ({ liberado: 80 * 1048576 }),
    permisos: async (o) => { log('permisos ' + o.p); return { lista: [{ nombre: 'Maps', paquete: 'com.google.android.apps.maps', fondo: true }, { nombre: 'Uber', paquete: 'com.ubercab', fondo: false }] }; },
    abrirApp: async (o) => log('app ' + o.paquete), favoritos: async () => ({ n: 3 }),
    silencio: async (o) => { log(`silencio ${o.quien} ${o.min}`); return { permiso: true, ok: true }; }, quitarSilencio: async () => log('fin silencio'), abrirAjuste: async (o) => log('ajuste ' + o.accion) }),
  Buscador: anyP({ addListener: on, estado: async () => ({ listo: true, mb: 278, n: window.__idx.length, motor: true }),
    indexar: async (o) => { window.__idx = o.items; log('indexar ' + o.items.length); return { nuevos: o.items.length, n: o.items.length }; },
    buscar: async (o) => { log('buscar ' + o.q); const l = window.__idx.filter((x) => /museo/i.test(x.texto)).map((x) => ({ id: x.id, p: 0.61 })); return { lista: l }; } }),
  Mensajes: anyP({ addListener: on, activo: async () => ({ activo: true }), config: async (o) => log('config ' + JSON.stringify(o)),
    recientes: async () => ({ lista: [{ clave: 'a', app: 'WhatsApp', de: 'Carolina', texto: 'Hola profe, la reunión de padres es mañana a las 3 pm en el salón 2', t: Date.now() - 60000 },
      { clave: 'b', app: 'WhatsApp', de: 'Mamá', texto: 'Mija compra leche, huevos y pan por favor', t: Date.now() - 120000 }, { clave: 'c', app: 'Mensajes', de: 'Banco', texto: 'Tu código de verificación es 123456', t: Date.now() }] }) }),
  Disparadores: anyP({ widgetDatos: async (o) => { window.__widget = o; log('widget ' + o.titulo); return { fijado: true }; } }),
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  Telefono: anyP({ addListener: on, checkPermissions: async () => ({}), contactos: async () => ({ lista: [] }), apps: async () => ({ lista: [] }),
    contestador: async (o) => { log('contestador ' + o.on + ' ' + (o.texto || '').slice(0, 20)); return { sms: true }; }, filtroLlamadas: async (o) => { log('filtro ' + o.modo); return { activo: true }; },
    agenteUi: async () => ({ nodos: [], pkg: 'x' }) }),
  Lugares: anyP({ aqui: async () => ({ lat: 4.65, lng: -74.05 }) }),
  Ventana: anyP({ addListener: on, pendientes: async () => ({ lista: window.__cola.splice(0) }), abrir: async (o) => log('url ' + o.url) }),
};
window.Capacitor = { isNativePlatform: () => true, Plugins: new Proxy({}, { get: (t, n) => P[n] || (n === 'SpeechRecognition' || n === 'Escaner' || n === 'Calendario' || n === 'Oido' ? undefined : generic2) }) };
