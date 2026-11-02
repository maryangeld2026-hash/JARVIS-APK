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
 */
@CapacitorPlugin(name = "IALocal")
public class IALocalPlugin extends Plugin {
    private final ExecutorService hilo = Executors.newSingleThreadExecutor();
    private final ExecutorService bajada = Executors.newSingleThreadExecutor();
    private LlmInference motor;
    private String motorRuta = "";
    private volatile boolean cancelar = false;

    private File carpeta() { File d = new File(getContext().getFilesDir(), "ia-local"); if (!d.exists()) d.mkdirs(); return d; }

    private File modelo() {
        File[] fs = carpeta().listFiles();
        if (fs == null) return null;
        for (File f : fs) if (f.getName().endsWith(".task") && f.length() > 50L * 1024 * 1024) return f;
        return null;
    }

    @PluginMethod
    public void estado(PluginCall call) {
        File f = modelo();
        JSObject r = new JSObject();
        r.put("listo", f != null);
        r.put("nombre", f != null ? f.getName() : "");
        r.put("mb", f != null ? f.length() / (1024 * 1024) : 0);
        r.put("libreMb", carpeta().getUsableSpace() / (1024 * 1024));
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
                con.setRequestProperty("User-Agent", "JarvisDocente/3.2");
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
                if (viejos != null) for (File v : viejos) if (v.getName().endsWith(".task")) v.delete();
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
    }

    @Override
    protected void handleOnDestroy() { cerrarMotor(); }
}
