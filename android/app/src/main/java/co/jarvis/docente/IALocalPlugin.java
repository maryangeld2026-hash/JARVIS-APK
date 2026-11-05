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

    private File carpeta() { File d = new File(getContext().getFilesDir(), "ia-local"); if (!d.exists()) d.mkdirs(); return d; }

    private File modelo() {
        File[] fs = carpeta().listFiles();
        if (fs == null) return null;
        File mejor = null;
        for (File f : fs) if ((f.getName().endsWith(".task") || f.getName().endsWith(".litertlm")) && f.length() > 50L * 1024 * 1024 && (mejor == null || f.lastModified() > mejor.lastModified())) mejor = f;
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
                if (f != null && f.getName().endsWith(".litertlm") && (gemma == null || !gemma.getRuta().equals(f.getAbsolutePath()))) {
                    cerrarMotor();
                    gemma = new GemmaMotor(getContext(), f.getAbsolutePath(), totalMb() >= 10500);
                    motorRuta = f.getAbsolutePath();
                }
                usado();
                JSObject r = new JSObject(); r.put("listo", gemma != null); call.resolve(r);
            } catch (Throwable e) { cerrarMotor(); call.reject("No pude cargar Gemma: " + e.getMessage()); }
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
    public void detener(PluginCall call) { GemmaMotor g = gemma; if (g != null) g.detener(); call.resolve(); }

    private long totalMb() {
        android.app.ActivityManager am = (android.app.ActivityManager) getContext().getSystemService(android.content.Context.ACTIVITY_SERVICE);
        android.app.ActivityManager.MemoryInfo mi = new android.app.ActivityManager.MemoryInfo(); am.getMemoryInfo(mi); return mi.totalMem / (1024 * 1024);
    }

    private void generarGemma(PluginCall call, File f) throws Exception {
        if (gemma == null || !gemma.getRuta().equals(f.getAbsolutePath())) {
            cerrarMotor();
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
        if ((!imgs.isEmpty() || !auds.isEmpty()) && !gemma.getMultimodal()) { call.reject("Este modelo no pudo arrancar con fotos ni audio en tu celular (solo texto)."); return; }
        final long[] ultEv = { 0 };
        String t = gemma.generar(call.getString("sistema", ""), hist, ultimo, imgs, auds, call.getInt("maxTokens", 700), call.getDouble("temperatura", 0.7), (parcial) -> {
            long ahora = System.currentTimeMillis();
            if (ahora - ultEv[0] > 120) { ultEv[0] = ahora; JSObject e = new JSObject(); e.put("texto", parcial); notifyListeners("parcial", e); }
            return kotlin.Unit.INSTANCE;
        });
        JSObject r = new JSObject(); r.put("texto", t == null ? "" : t); r.put("motor", "Gemma · " + gemma.getBackend()); r.put("ve", gemma.getMultimodal());
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
        r.put("cargada", gemma != null); r.put("ve", gemma != null && gemma.getMultimodal());
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
                        if (p != ultimo) { ultimo = p; JSObject ev = new JSObject(); ev.put("p", p); ev.put("mb", n / (1024 * 1024)); notifyListeners("progreso", ev); }
                    }
                }
                cerrarMotor();
                File[] viejos = carpeta().listFiles();
                if (viejos != null) for (File v : viejos) if (v.getName().endsWith(".task") || v.getName().endsWith(".litertlm")) v.delete();
                File fin = new File(carpeta(), nombre);
                if (!parte.renameTo(fin)) throw new Exception("No pude guardar el modelo.");
                JSObject ok = new JSObject(); ok.put("ok", true); ok.put("mb", fin.length() / (1024 * 1024));
                call.resolve(ok);
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "No pude descargar el modelo.");
            } finally { if (con != null) con.disconnect(); }
        });
    }

    @PluginMethod
    public void cancelar(PluginCall call) { cancelar = true; call.resolve(); }

    @PluginMethod
    public void generar(PluginCall call) {
        final String prompt = call.getString("prompt", "");
        hilo.execute(() -> {
            try {
                File f = modelo();
                if (f == null) { call.reject("La IA del celular no está descargada."); return; }
                usado();
                if (f.getName().endsWith(".litertlm")) { generarGemma(call, f); usado(); return; }
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
        hilo.execute(() -> {
            cerrarMotor();
            File[] fs = carpeta().listFiles();
            if (fs != null) for (File f : fs) f.delete();
            call.resolve();
        });
    }

    private void cerrarMotor() {
        if (motor != null) { try { motor.close(); } catch (Throwable e) { } motor = null; motorRuta = ""; }
        if (gemma != null) { try { gemma.cerrar(); } catch (Throwable e) { } gemma = null; motorRuta = ""; }
    }

    @Override
    protected void handleOnDestroy() { cerrarMotor(); }
}
