package co.jarvis.docente;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mediapipe.tasks.genai.llminference.LlmInference;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Jarvis 3.2: la IA dentro del celular, para cuando no hay internet o está muy lento.
 *   estado() → {listo, nombre, mb}     descargar({url, nombre}) → baja el modelo una vez (eventos «progreso» {p, mb})
 *   generar({prompt, maxTokens}) → {texto}     borrar() → libera el espacio     cancelar() → para la descarga
 * Corre con MediaPipe (LLM Inference) y un modelo abierto pequeño (Qwen 2.5). Nada sale del celular.
 * 3.12: también Gemma 4 E2B/E4B (archivos .litertlm, con LiteRT-LM): generar({sistema, mensajes}) responde por partes
 *   (eventos «parcial» {texto}); memoria() → {totalMb, libreMb}; detener() corta la respuesta. El modelo se libera solo
 *   a los 3 minutos sin usarse (devuelve la memoria y no gasta batería).
 */
@CapacitorPlugin(name = "IALocal")
public class IALocalPlugin extends Plugin {
    private final ExecutorService hilo = Executors.newSingleThreadExecutor();
    private final ExecutorService bajada = Executors.newSingleThreadExecutor();
    private final ExecutorService grabadora = Executors.newSingleThreadExecutor();
    private LlmInference motor;
    private String motorRuta = "";
    private volatile boolean cancelar = false;

    static final String NANO = "gemini-nano.nano";
    private volatile boolean nanoParar = false;
    private File carpeta() { File d = new File(getContext().getFilesDir(), "ia-local"); if (!d.exists()) d.mkdirs(); return d; }

    /** 3.19: varios modelos descargados a la vez; se usa el que escogiste (o el último que bajaste). */
    private static boolean esModelo(File f) {
        String n = f.getName();
        if (n.equals(NANO)) return true;                                               // 3.30: Gemini Nano (lo pone Android; aquí solo una marca)
        return (n.endsWith(".task") || n.endsWith(".litertlm") || (n.endsWith(".gguf") && !n.toLowerCase().startsWith("mmproj"))) && f.length() > 50L * 1024 * 1024;   // 3.29: GGUF (llama.cpp)
    }
    private File modelo() {
        File[] fs = carpeta().listFiles();
        if (fs == null) return null;
        String act = getContext().getSharedPreferences("jarvis_ia_local", 0).getString("activo", "");
        if (!act.isEmpty()) for (File f : fs) if (f.getName().equals(act) && esModelo(f)) return f;
        File mejor = null;
        for (File f : fs) if (esModelo(f) && (mejor == null || f.lastModified() > mejor.lastModified())) mejor = f;
        return mejor;
    }

    // ======================================================================== 3.12: Gemma 4 (LiteRT-LM)
    private GemmaMotor gemma;
    private final android.os.Handler main = new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable liberar = () -> hilo.execute(this::cerrarMotor);
    @Override public void load() { GemmaMotor.revisarCaida(getContext()); }

    private void usado() { main.removeCallbacks(liberar); main.postDelayed(liberar, 5 * 60 * 1000); }

    /** 3.15: carga Gemma de una vez (al abrir el micrófono o el teclado), para que la respuesta no espere la carga. */
    @PluginMethod
    public void precargar(PluginCall call) {
        hilo.execute(() -> {
            try {
                File f = modelo();
                if (f != null && f.getName().endsWith(".gguf")) { cargarGguf(f); usado(); JSObject r = new JSObject(); r.put("listo", true); call.resolve(r); return; }
                if (f != null && f.getName().endsWith(".litertlm") && (gemma == null || !gemma.getRuta().equals(f.getAbsolutePath()))) {
                    cerrarMotor();
                    revisarMemoria(f);
                    gemma = new GemmaMotor(getContext(), f.getAbsolutePath(), totalMb() >= 10500);
                    motorRuta = f.getAbsolutePath();
                }
                usado();
                JSObject r = new JSObject(); r.put("listo", gemma != null); call.resolve(r);
            } catch (Throwable e) { cerrarMotor(); call.reject("No pude cargar la IA del celular: " + e.getMessage()); }
        });
    }

    @PluginMethod
    public void memoria(PluginCall call) {
        android.app.ActivityManager am = (android.app.ActivityManager) getContext().getSystemService(android.content.Context.ACTIVITY_SERVICE);
        android.app.ActivityManager.MemoryInfo mi = new android.app.ActivityManager.MemoryInfo(); am.getMemoryInfo(mi);
        JSObject r = new JSObject(); r.put("totalMb", mi.totalMem / (1024 * 1024)); r.put("libreMb", mi.availMem / (1024 * 1024)); r.put("discoMb", carpeta().getUsableSpace() / (1024 * 1024));
        call.resolve(r);
    }

    // ======================================================================== 3.13: grabar tu voz para que Gemma la entienda sin internet
    private volatile boolean grabandoVoz = false;
    /** Graba hasta que dejas de hablar (1,4 s de silencio) o hasta maxSeg. → {ruta, segundos, hablo}. Eventos «nivel» {v} para el orbe. */
    @PluginMethod
    public void grabar(PluginCall call) {
        if (getContext().checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED) { call.reject("Falta el permiso del micrófono."); return; }
        final int maxSeg = Math.max(2, Math.min(30, call.getInt("maxSeg", 15)));
        final int esperaMs = Math.max(2000, Math.min(15000, call.getInt("esperaMs", 8000)));
        grabadora.execute(() -> {
            EscuchaService.soltarMicrofono(getContext(), 2500);
            android.media.AudioRecord rec = null;
            File wav = new File(getContext().getCacheDir(), "gemma_voz.wav");
            try {
                int min = android.media.AudioRecord.getMinBufferSize(16000, android.media.AudioFormat.CHANNEL_IN_MONO, android.media.AudioFormat.ENCODING_PCM_16BIT);
                rec = new android.media.AudioRecord(android.media.MediaRecorder.AudioSource.VOICE_RECOGNITION, 16000, android.media.AudioFormat.CHANNEL_IN_MONO, android.media.AudioFormat.ENCODING_PCM_16BIT, Math.max(min, 8192));
                if (rec.getState() != android.media.AudioRecord.STATE_INITIALIZED) throw new Exception("El micrófono está ocupado.");
                java.io.ByteArrayOutputStream pcm = new java.io.ByteArrayOutputStream();
                byte[] buf = new byte[3200];
                rec.startRecording(); grabandoVoz = true;
                long t0 = System.currentTimeMillis(), ultVoz = 0; boolean hablo = false; double piso = 250;
                while (grabandoVoz) {
                    int n = rec.read(buf, 0, buf.length); if (n <= 0) continue;
                    pcm.write(buf, 0, n);
                    long s = 0; for (int i = 0; i + 1 < n; i += 2) { int v = (short) ((buf[i] & 0xff) | (buf[i + 1] << 8)); s += (long) v * v; }
                    double rms = Math.sqrt((double) s / Math.max(1, n / 2)), ahora = System.currentTimeMillis();
                    boolean voz = rms > Math.max(piso * 2.6, 300);
                    if (!voz) piso = piso * 0.95 + rms * 0.05; else { hablo = true; ultVoz = (long) ahora; }
                    JSObject ev = new JSObject(); ev.put("v", Math.min(1.0, rms / 3000.0)); notifyListeners("nivel", ev);
                    if (hablo && ahora - ultVoz > 1400) break;
                    if (!hablo && ahora - t0 > esperaMs) break;
                    if (ahora - t0 > maxSeg * 1000L) break;
                }
                byte[] d = pcm.toByteArray();
                try (FileOutputStream out = new FileOutputStream(wav)) {
                    java.nio.ByteBuffer h = java.nio.ByteBuffer.allocate(44).order(java.nio.ByteOrder.LITTLE_ENDIAN);
                    h.put("RIFF".getBytes()).putInt(36 + d.length).put("WAVE".getBytes()).put("fmt ".getBytes()).putInt(16).putShort((short) 1).putShort((short) 1)
                        .putInt(16000).putInt(32000).putShort((short) 2).putShort((short) 16).put("data".getBytes()).putInt(d.length);
                    out.write(h.array()); out.write(d);
                }
                JSObject r = new JSObject(); r.put("ruta", wav.getAbsolutePath()); r.put("segundos", d.length / 32000.0); r.put("hablo", hablo);
                call.resolve(r);
            } catch (Exception e) { call.reject(e.getMessage() != null ? e.getMessage() : "No pude grabar."); }
            finally { grabandoVoz = false; if (rec != null) { try { rec.stop(); } catch (Exception ignored) { } rec.release(); } }
        });
    }
    /** 3.14: las primeras páginas de un PDF como imágenes, para que Gemma lo lea sin internet. {data (base64), max} → {paginas:[base64 jpg], total} */
    @PluginMethod
    public void pdfPaginas(PluginCall call) {
        final String data = call.getString("data", ""); final int max = Math.max(1, Math.min(4, call.getInt("max", 4)));
        grabadora.execute(() -> {
            File f = new File(getContext().getCacheDir(), "gemma_doc.pdf");
            try (FileOutputStream out = new FileOutputStream(f)) { out.write(android.util.Base64.decode(data, android.util.Base64.DEFAULT)); }
            catch (Exception e) { call.reject("No pude leer el PDF."); return; }
            try (android.os.ParcelFileDescriptor fd = android.os.ParcelFileDescriptor.open(f, android.os.ParcelFileDescriptor.MODE_READ_ONLY);
                 android.graphics.pdf.PdfRenderer pr = new android.graphics.pdf.PdfRenderer(fd)) {
                com.getcapacitor.JSArray l = new com.getcapacitor.JSArray();
                for (int i = 0; i < pr.getPageCount() && i < max; i++) {
                    try (android.graphics.pdf.PdfRenderer.Page pg = pr.openPage(i)) {
                        float k = 1400f / Math.max(pg.getWidth(), pg.getHeight());
                        android.graphics.Bitmap b = android.graphics.Bitmap.createBitmap(Math.round(pg.getWidth() * k), Math.round(pg.getHeight() * k), android.graphics.Bitmap.Config.ARGB_8888);
                        b.eraseColor(android.graphics.Color.WHITE);
                        pg.render(b, null, null, android.graphics.pdf.PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                        java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream(); b.compress(android.graphics.Bitmap.CompressFormat.JPEG, 82, bo); b.recycle();
                        l.put(android.util.Base64.encodeToString(bo.toByteArray(), android.util.Base64.NO_WRAP));
                    }
                }
                JSObject r = new JSObject(); r.put("paginas", l); r.put("total", pr.getPageCount()); call.resolve(r);
            } catch (Exception e) { call.reject("Ese PDF no se pudo abrir (¿tiene contraseña?)."); }
            finally { f.delete(); }
        });
    }

    @PluginMethod
    public void pararGrabacion(PluginCall call) { grabandoVoz = false; call.resolve(); }

    @PluginMethod
    public void detener(PluginCall call) { GemmaMotor g = gemma; if (g != null) g.detener(); ggufParar = true; nanoParar = true; if (ggufListo) co.jarvis.motores.Llama.detener(); call.resolve(); }

    // ======================================================================== 3.29: modelos GGUF (llama.cpp, como PocketPal AI)
    private boolean ggufListo = false;
    private volatile boolean ggufParar = false;
    private String ggufRuta = "";

    private void cargarGguf(File f) throws Exception {
        if (ggufListo && ggufRuta.equals(f.getAbsolutePath())) return;
        cerrarMotor();
        if (!co.jarvis.motores.Llama.iniciar(getContext().getApplicationInfo().nativeLibraryDir))
            throw new Exception("Este celular no puede usar modelos GGUF (" + co.jarvis.motores.Llama.falla() + ").");
        android.app.ActivityManager am = (android.app.ActivityManager) getContext().getSystemService(android.content.Context.ACTIVITY_SERVICE);
        android.app.ActivityManager.MemoryInfo mi = new android.app.ActivityManager.MemoryInfo(); am.getMemoryInfo(mi);
        long libre = mi.availMem / (1024 * 1024), necesita = f.length() / (1024 * 1024) + 500;
        if (libre < necesita) throw new Exception("memoria_gguf:" + libre + ":" + necesita);
        long total = totalMb();
        int ctx = total >= 11000 ? 8192 : total >= 7000 ? 6144 : 4096;
        JSObject ev = new JSObject(); ev.put("cargando", true); notifyListeners("estado", ev);
        int r = co.jarvis.motores.Llama.cargar(f.getAbsolutePath(), ctx, 0);
        if (r == 2) throw new Exception("No hay memoria suficiente para este modelo GGUF: cierra otras apps o usa uno más pequeño.");
        if (r != 0) throw new Exception("No pude abrir ese modelo GGUF (¿archivo incompleto, o de un tipo que llama.cpp no conoce?).");
        ggufListo = true; ggufRuta = f.getAbsolutePath(); motorRuta = ggufRuta;
    }

    private void generarGguf(PluginCall call, File f) throws Exception {
        com.getcapacitor.JSArray im = call.getArray("imagenes", null);
        if (im != null && im.length() > 0) { call.reject("Los modelos GGUF todavía no ven fotos en Jarvis: para fotos sin internet usa Gemma 4 o Qwen 3.5 con visión."); return; }
        cargarGguf(f);
        java.util.List<String> roles = new java.util.ArrayList<>(), textos = new java.util.ArrayList<>();
        String sis = call.getString("sistema", "");
        if (sis != null && !sis.trim().isEmpty()) { roles.add("system"); textos.add(sis); }
        com.getcapacitor.JSArray ms = call.getArray("mensajes", null);
        if (ms != null && ms.length() > 0) {
            for (int k = 0; k < ms.length(); k++) {
                org.json.JSONObject m = ms.getJSONObject(k);
                String tx = m.optString("content", "");
                if (tx.isEmpty()) continue;
                String rol = "user".equals(m.optString("role")) ? "user" : "assistant";
                // dos del mismo rol seguidos (algunas plantillas no lo aceptan): se juntan
                if (!roles.isEmpty() && roles.get(roles.size() - 1).equals(rol)) { textos.set(textos.size() - 1, textos.get(textos.size() - 1) + "\n\n" + tx); continue; }
                roles.add(rol); textos.add(tx);
            }
        } else { roles.add("user"); textos.add(call.getString("prompt", "")); }
        if (roles.isEmpty() || !"user".equals(roles.get(roles.size() - 1))) { roles.add("user"); textos.add(call.getString("prompt", "Continúa.")); }
        ggufParar = false;
        final long[] ultEv = { 0 };
        String t = co.jarvis.motores.Llama.generar(roles.toArray(new String[0]), textos.toArray(new String[0]),
            call.getInt("maxTokens", 700), (float) (double) call.getDouble("temperatura", 0.7), false, (parcial) -> {
                long ahora = System.currentTimeMillis();
                if (ahora - ultEv[0] > 120) { ultEv[0] = ahora; JSObject e = new JSObject(); e.put("texto", sinPensar(parcial)); notifyListeners("parcial", e); }
                return !ggufParar;
            });
        t = sinPensar(t == null ? "" : t);
        if (t.isEmpty() && !ggufParar) { String err = co.jarvis.motores.Llama.error(); call.reject(err == null || err.isEmpty() ? "El modelo GGUF no devolvió texto." : "El modelo GGUF: " + err + "."); return; }
        JSObject r = new JSObject(); r.put("texto", t); r.put("motor", f.getName().replace(".gguf", "") + " · GGUF"); r.put("ve", false);
        call.resolve(r);
    }

    /** Quita el «pensamiento» (<think>…</think>) que algunos modelos escriben antes de la respuesta. */
    private static String sinPensar(String t) {
        String s = t.replaceAll("(?s)<think>.*?</think>", "");
        int a = s.indexOf("<think>");
        if (a >= 0) s = s.substring(0, a);
        return s.trim();
    }

    /** Qué tan rápido va el modelo GGUF en este celular (palabras por segundo al leer y al escribir). */
    @PluginMethod
    public void velocidad(PluginCall call) {
        hilo.execute(() -> {
            try {
                File f = modelo();
                if (f == null || !f.getName().endsWith(".gguf")) { call.reject("La medición es para los modelos GGUF: escoge uno primero."); return; }
                cargarGguf(f);
                org.json.JSONObject j = new org.json.JSONObject(co.jarvis.motores.Llama.prueba(128, 32));
                call.resolve(JSObject.fromJSONObject(j));
            } catch (Throwable e) { call.reject("No pude medir: " + e.getMessage()); }
        });
    }

    /** 3.20: antes de cargar Gemma 4 12B se revisa la memoria libre: si no alcanza, se avisa en vez de que Android cierre la app. */
    private void revisarMemoria(File f) throws Exception {
        if (!f.getName().toLowerCase().contains("12b")) return;
        android.app.ActivityManager am = (android.app.ActivityManager) getContext().getSystemService(android.content.Context.ACTIVITY_SERVICE);
        android.app.ActivityManager.MemoryInfo mi = new android.app.ActivityManager.MemoryInfo(); am.getMemoryInfo(mi);
        long libre = mi.availMem / (1024 * 1024);
        if (libre < 6800) throw new Exception("memoria:" + libre);
    }

    private long totalMb() {
        android.app.ActivityManager am = (android.app.ActivityManager) getContext().getSystemService(android.content.Context.ACTIVITY_SERVICE);
        android.app.ActivityManager.MemoryInfo mi = new android.app.ActivityManager.MemoryInfo(); am.getMemoryInfo(mi); return mi.totalMem / (1024 * 1024);
    }

    private void generarGemma(PluginCall call, File f) throws Exception {
        if (gemma == null || !gemma.getRuta().equals(f.getAbsolutePath())) {
            cerrarMotor();
            revisarMemoria(f);
            JSObject ev = new JSObject(); ev.put("cargando", true); notifyListeners("estado", ev);
            gemma = new GemmaMotor(getContext(), f.getAbsolutePath(), totalMb() >= 10500 && call.getBoolean("gpu", true));
            motorRuta = f.getAbsolutePath();
        }
        java.util.List<String[]> hist = new java.util.ArrayList<>();
        String ultimo = call.getString("prompt", "");
        com.getcapacitor.JSArray ms = call.getArray("mensajes", null);
        if (ms != null && ms.length() > 0) {
            for (int k = 0; k < ms.length(); k++) {
                org.json.JSONObject m = ms.getJSONObject(k);
                String rol = "user".equals(m.optString("role")) ? "user" : "assistant", tx = m.optString("content", "");
                if (k == ms.length() - 1 && "user".equals(rol)) ultimo = tx; else if (!tx.isEmpty()) hist.add(new String[] { rol, tx });
            }
        }
        // 3.13: fotos (base64 → archivo) y audio (archivo .wav ya grabado)
        java.util.List<String> imgs = new java.util.ArrayList<>(), auds = new java.util.ArrayList<>();
        com.getcapacitor.JSArray im = call.getArray("imagenes", null);
        if (im != null) for (int k = 0; k < im.length() && k < 4; k++) {
            org.json.JSONObject o = im.getJSONObject(k);
            File fi = new File(getContext().getCacheDir(), "gemma_img_" + k + ".jpg");
            try (FileOutputStream out = new FileOutputStream(fi)) { out.write(android.util.Base64.decode(o.optString("data", ""), android.util.Base64.DEFAULT)); }
            imgs.add(fi.getAbsolutePath());
        }
        String au = call.getString("audio", "");
        if (au != null && !au.isEmpty() && new File(au).exists()) auds.add(au);
        if (!imgs.isEmpty() && !gemma.getMultimodal()) { call.reject(gemma.getQwen() ? "Este Qwen no ve fotos: usa Qwen 3.5 con visión (VL) o Gemma 4." : "Este modelo no pudo arrancar con fotos en tu celular (solo texto)."); return; }
        if (!auds.isEmpty() && !gemma.getOye()) { call.reject("Este modelo no entiende audio: para la voz sin internet usa Gemma 4."); return; }
        final long[] ultEv = { 0 };
        String t = gemma.generar(call.getString("sistema", ""), hist, ultimo, imgs, auds, call.getInt("maxTokens", 700), call.getDouble("temperatura", 0.7), (parcial) -> {
            long ahora = System.currentTimeMillis();
            if (ahora - ultEv[0] > 120) { ultEv[0] = ahora; JSObject e = new JSObject(); e.put("texto", parcial); notifyListeners("parcial", e); }
            return kotlin.Unit.INSTANCE;
        });
        JSObject r = new JSObject(); r.put("texto", t == null ? "" : t); r.put("motor", gemma.getNombre() + " · " + gemma.getBackend()); r.put("ve", gemma.getMultimodal());
        call.resolve(r);
    }

    @PluginMethod
    public void estado(PluginCall call) {
        File f = modelo();
        JSObject r = new JSObject();
        r.put("listo", f != null);
        r.put("nombre", f != null ? f.getName() : "");
        r.put("mb", f != null ? f.length() / (1024 * 1024) : 0);
        r.put("libreMb", carpeta().getUsableSpace() / (1024 * 1024));
        r.put("gemma", f != null && f.getName().endsWith(".litertlm"));
        r.put("cargada", gemma != null);
        // 3.19: ve / oye: lo que el modelo activo puede hacer (si ya cargó, lo que de verdad pudo arrancar en este celular)
        JSObject cp = f != null ? capacidades(f) : new JSObject();
        boolean cargado = gemma != null && f != null && gemma.getRuta().equals(f.getAbsolutePath());
        r.put("familia", f != null ? cp.getString("familia") : "");
        r.put("ve", cargado ? gemma.getMultimodal() : cp.optBoolean("ve", false));
        r.put("oye", cargado ? gemma.getOye() : cp.optBoolean("oye", false));
        call.resolve(r);
    }

    @PluginMethod
    public void descargar(PluginCall call) {
        final String url = call.getString("url", "");
        final String nombre = call.getString("nombre", "modelo.task").replaceAll("[^A-Za-z0-9._-]", "_");
        if (url.isEmpty()) { call.reject("Falta la dirección del modelo."); return; }
        cancelar = false;
        bajada.execute(() -> {
            File parte = new File(carpeta(), nombre + ".part");
            HttpURLConnection con = null;
            try {
                con = (HttpURLConnection) new URL(url).openConnection();
                con.setInstanceFollowRedirects(true);
                con.setConnectTimeout(20000);
                con.setReadTimeout(60000);
                con.setRequestProperty("User-Agent", "JarvisDocente/3.12");
                long ya = parte.exists() ? parte.length() : 0;
                if (ya > 0) con.setRequestProperty("Range", "bytes=" + ya + "-");      // sigue donde iba si se cortó
                int code = con.getResponseCode();
                if (code != 200 && code != 206) throw new Exception("El servidor respondió " + code);
                if (code == 200) ya = 0;
                long total = con.getContentLengthLong();
                if (total > 0) total += ya;
                if (total > 0 && carpeta().getUsableSpace() < (total - ya) + 200L * 1024 * 1024)
                    throw new Exception("No hay espacio suficiente en el celular (se necesitan " + ((total - ya) / (1024 * 1024) + 200) + " MB libres).");
                try (InputStream in = new BufferedInputStream(con.getInputStream()); FileOutputStream out = new FileOutputStream(parte, ya > 0)) {
                    byte[] buf = new byte[1 << 16];
                    long n = ya; int r, ultimo = -1;
                    while ((r = in.read(buf)) > 0) {
                        if (cancelar) throw new Exception("Descarga cancelada.");
                        out.write(buf, 0, r);
                        n += r;
                        int p = total > 0 ? (int) (n * 100 / total) : -1;
                        if (p != ultimo) { ultimo = p; JSObject ev = new JSObject(); ev.put("p", p); ev.put("mb", n / (1024 * 1024)); notifyListeners("progreso", ev); avisoDescarga(nombre, p, n / (1024 * 1024)); }
                    }
                }
                cerrarMotor();
                File fin = new File(carpeta(), nombre);                         // 3.19: los otros modelos se quedan (varias alternativas)
                if (fin.exists()) fin.delete();
                if (!parte.renameTo(fin)) throw new Exception("No pude guardar el modelo.");
                getContext().getSharedPreferences("jarvis_ia_local", 0).edit().putString("activo", nombre).apply();
                quitarAvisoDescarga();
                JSObject ok = new JSObject(); ok.put("ok", true); ok.put("mb", fin.length() / (1024 * 1024));
                call.resolve(ok);
            } catch (Exception e) {
                quitarAvisoDescarga();
                call.reject(e.getMessage() != null ? e.getMessage() : "No pude descargar el modelo.");
            } finally { if (con != null) con.disconnect(); }
        });
    }

    @PluginMethod
    public void cancelar(PluginCall call) { cancelar = true; call.resolve(); }

    /** 3.28: la descarga de la IA del celular como aviso en vivo (barra de progreso arriba y en la pantalla bloqueada). */
    private void avisoDescarga(String nombre, int p, long mb) {
        try {
            android.content.Context c = getContext();
            android.app.NotificationManager nm = (android.app.NotificationManager) c.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            if (android.os.Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new android.app.NotificationChannel("jarvis_descargas", "Descargas de Jarvis", android.app.NotificationManager.IMPORTANCE_LOW));
            android.app.Notification.Builder b = android.os.Build.VERSION.SDK_INT >= 26 ? new android.app.Notification.Builder(c, "jarvis_descargas") : new android.app.Notification.Builder(c);
            int fl = android.app.PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 23 ? android.app.PendingIntent.FLAG_IMMUTABLE : 0);
            b.setSmallIcon(R.mipmap.ic_launcher_foreground).setContentTitle("Descargando la IA del celular")
                .setContentText((p >= 0 ? p + " % · " : "") + mb + " MB · " + nombre).setOngoing(true).setOnlyAlertOnce(true)
                .setContentIntent(android.app.PendingIntent.getActivity(c, 61, new android.content.Intent(c, MainActivity.class).addFlags(android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP), fl));
            EnVivo.progreso(b, p, EnVivo.VERDE);
            EnVivo.promover(b, p >= 0 ? p + "%" : "IA", EnVivo.VERDE);
            nm.notify(62, b.build());
        } catch (Exception ignored) { }
    }
    private void quitarAvisoDescarga() {
        try { ((android.app.NotificationManager) getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE)).cancel(62); } catch (Exception ignored) { }
    }

    @PluginMethod
    public void generar(PluginCall call) {
        final String prompt = call.getString("prompt", "");
        hilo.execute(() -> {
            try {
                File f = modelo();
                if (f == null) { call.reject("La IA del celular no está descargada."); return; }
                usado();
                if (f.getName().endsWith(".litertlm")) { generarGemma(call, f); usado(); return; }
                if (f.getName().endsWith(".gguf")) { generarGguf(call, f); usado(); return; }
                if (f.getName().equals(NANO)) { generarNano(call); return; }
                if (motor == null || !motorRuta.equals(f.getAbsolutePath())) {
                    cerrarMotor();
                    LlmInference.LlmInferenceOptions op = LlmInference.LlmInferenceOptions.builder()
                            .setModelPath(f.getAbsolutePath())
                            .setMaxTokens(1280)
                            .build();
                    motor = LlmInference.createFromOptions(getContext(), op);
                    motorRuta = f.getAbsolutePath();
                }
                String t = motor.generateResponse(prompt);
                JSObject r = new JSObject(); r.put("texto", t == null ? "" : t);
                call.resolve(r);
            } catch (Throwable e) {
                cerrarMotor();
                call.reject("La IA del celular falló: " + (e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
            }
        });
    }

    @PluginMethod
    public void borrar(PluginCall call) {
        final String solo = call.getString("nombre", "");
        hilo.execute(() -> {
            cerrarMotor();
            File[] fs = carpeta().listFiles();
            if (fs != null) for (File f : fs) if (solo == null || solo.isEmpty() || f.getName().equals(solo) || f.getName().equals(solo + ".part")) f.delete();
            android.content.SharedPreferences p = getContext().getSharedPreferences("jarvis_ia_local", 0);
            if (solo == null || solo.isEmpty() || solo.equals(p.getString("activo", ""))) p.edit().remove("activo").apply();
            call.resolve();
        });
    }

    /** 3.19: qué puede hacer cada modelo según su archivo (antes de cargarlo). */
    private static JSObject capacidades(File f) {
        String n = f.getName().toLowerCase();
        boolean lt = n.endsWith(".litertlm"), gem = lt && n.contains("gemma"), qw35 = lt && n.contains("qwen3.5"), gg = n.endsWith(".gguf"), nano = n.equals(NANO);
        JSObject o = new JSObject();
        o.put("nombre", f.getName()); o.put("mb", f.length() / (1024 * 1024));
        o.put("familia", nano ? "nano" : gg ? "gguf" : gem ? "gemma" : qw35 ? "qwen35" : lt ? "litertlm" : "task");
        o.put("ve", gem || (lt && n.contains("-vl"))); o.put("oye", gem);
        return o;
    }

    @PluginMethod
    public void modelos(PluginCall call) {
        File act = modelo();
        com.getcapacitor.JSArray l = new com.getcapacitor.JSArray();
        File[] fs = carpeta().listFiles();
        if (fs != null) for (File f : fs) if (esModelo(f)) { JSObject o = capacidades(f); o.put("activo", act != null && act.getName().equals(f.getName())); l.put(o); }
        JSObject r = new JSObject(); r.put("lista", l); r.put("libreMb", carpeta().getUsableSpace() / (1024 * 1024));
        call.resolve(r);
    }

    @PluginMethod
    public void usar(PluginCall call) {
        final String n = call.getString("nombre", "");
        hilo.execute(() -> {
            File f = new File(carpeta(), n == null ? "" : n);
            if (n == null || n.isEmpty() || !f.exists() || !esModelo(f)) { call.reject("Ese modelo no está descargado."); return; }
            if (!f.getName().equals(motorRuta.isEmpty() ? "" : new File(motorRuta).getName())) cerrarMotor();
            getContext().getSharedPreferences("jarvis_ia_local", 0).edit().putString("activo", f.getName()).apply();
            call.resolve(capacidades(f));
        });
    }

    // ======================================================================== 3.30: Gemini Nano (AICore)
    /** → {estado: disponible|descargable|descargando|no, sdk} */
    @PluginMethod
    public void nanoEstado(PluginCall call) {
        new Thread(() -> {
            JSObject r = new JSObject();
            r.put("estado", android.os.Build.VERSION.SDK_INT >= 26 ? NanoMotor.estado() : "no");
            r.put("activo", NANO.equals(getContext().getSharedPreferences("jarvis_ia_local", 0).getString("activo", "")));
            call.resolve(r);
        }).start();
    }
    /** Pide a Android que baje Gemini Nano (si hace falta) y lo deja como la IA del celular. */
    @PluginMethod
    public void nanoPreparar(PluginCall call) {
        bajada.execute(() -> {
            String e = NanoMotor.estado();
            if ("no".equals(e)) { call.reject("Este celular no tiene Gemini Nano."); return; }
            if (!"disponible".equals(e)) {
                String err = NanoMotor.descargar((b) -> { JSObject ev = new JSObject(); ev.put("p", -1); ev.put("mb", b / (1024 * 1024)); notifyListeners("progreso", ev); });
                if (!err.isEmpty() && !"disponible".equals(NanoMotor.estado())) { call.reject("Android no pudo bajar Gemini Nano: " + err); return; }
            }
            try { new File(carpeta(), NANO).createNewFile(); } catch (Exception ignored) { }
            getContext().getSharedPreferences("jarvis_ia_local", 0).edit().putString("activo", NANO).apply();
            JSObject r = new JSObject(); r.put("ok", true); call.resolve(r);
        });
    }
    private void generarNano(PluginCall call) {
        com.getcapacitor.JSArray im = call.getArray("imagenes", null);
        if (im != null && im.length() > 0) { call.reject("Gemini Nano en Jarvis todavía no ve fotos: para fotos sin internet usa Gemma 4."); return; }
        String prompt = call.getString("prompt", "");
        if (prompt == null || prompt.isEmpty()) prompt = call.getString("nano", "");
        nanoParar = false;
        final long[] ult = { 0 };
        String t = NanoMotor.generar(prompt, (parcial) -> {
            long ahora = System.currentTimeMillis();
            if (ahora - ult[0] > 120) { ult[0] = ahora; JSObject e = new JSObject(); e.put("texto", parcial); notifyListeners("parcial", e); }
            return !nanoParar;
        });
        if (t.isEmpty() && !nanoParar) { call.reject("Gemini Nano no respondió (puede estar ocupado o sin cupo: Android limita cuántas preguntas por minuto)."); return; }
        JSObject r = new JSObject(); r.put("texto", t); r.put("motor", "Gemini Nano · AICore"); r.put("ve", false);
        call.resolve(r);
    }

    private void cerrarMotor() {
        if (motor != null) { try { motor.close(); } catch (Throwable e) { } motor = null; motorRuta = ""; }
        if (gemma != null) { try { gemma.cerrar(); } catch (Throwable e) { } gemma = null; motorRuta = ""; }
        if (ggufListo) { try { co.jarvis.motores.Llama.liberar(); } catch (Throwable e) { } ggufListo = false; ggufRuta = ""; motorRuta = ""; }
    }

    @Override
    protected void handleOnDestroy() { cerrarMotor(); }
}
