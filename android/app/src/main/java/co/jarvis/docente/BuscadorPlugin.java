package co.jarvis.docente;

import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Jarvis 3.30 · buscar en tus cosas por significado (como Pixel Search o la nueva Siri), todo dentro del celular:
 * un modelo pequeño (EmbeddingGemma, ~300 MB) convierte cada trozo de tus notas, documentos y conversaciones en un vector;
 * lo que preguntas se compara con esos vectores. Nada sale del celular.
 *   estado() → {listo, mb, n, motor} · descargar({url, nombre}) (evento «progreso») · borrar()
 *   indexar({items:[{id, texto}]}) → {nuevos, n} (evento «indexando» {hechos, total}) · buscar({q, n}) → {lista:[{id, p}]}
 */
@CapacitorPlugin(name = "Buscador")
public class BuscadorPlugin extends Plugin {
    private final ExecutorService hilo = Executors.newSingleThreadExecutor();
    private final ExecutorService bajada = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Map<String, float[]> indice = new LinkedHashMap<>();
    private boolean leido = false, cargado = false;
    private volatile boolean parar = false;
    private final Runnable soltar = () -> hilo.execute(() -> { if (cargado) { try { co.jarvis.motores.Llama.liberarEmb(); } catch (Throwable ignored) { } cargado = false; } });

    private File carpeta() { File d = new File(getContext().getFilesDir(), "buscador"); d.mkdirs(); return d; }
    private File modelo() {
        File[] fs = carpeta().listFiles(); if (fs == null) return null;
        for (File f : fs) if (f.getName().endsWith(".gguf") && f.length() > 20L * 1024 * 1024) return f;
        return null;
    }
    private File archivoIndice() { return new File(carpeta(), "indice.bin"); }

    private boolean motor() { return co.jarvis.motores.Llama.iniciar(getContext().getApplicationInfo().nativeLibraryDir); }

    private void cargar() throws Exception {
        main.removeCallbacks(soltar);
        if (cargado) return;
        File f = modelo(); if (f == null) throw new Exception("La búsqueda por significado no está descargada.");
        if (!motor()) throw new Exception("Este celular no puede usar el motor GGUF (" + co.jarvis.motores.Llama.falla() + ").");
        int r = co.jarvis.motores.Llama.cargarEmb(f.getAbsolutePath(), 0);
        if (r != 0) throw new Exception(r == 3 ? "Ese archivo no es un modelo de búsqueda." : r == 2 ? "No hay memoria suficiente ahora." : "No pude abrir el modelo de búsqueda.");
        cargado = true;
    }
    private void usado() { main.removeCallbacks(soltar); main.postDelayed(soltar, 2 * 60_000); }

    private void leer() {
        if (leido) return;
        leido = true;
        File f = archivoIndice(); if (!f.exists()) return;
        try (DataInputStream in = new DataInputStream(new BufferedInputStream(new FileInputStream(f)))) {
            int n = in.readInt(), dim = in.readInt();
            for (int k = 0; k < n; k++) { String id = in.readUTF(); float[] v = new float[dim]; for (int j = 0; j < dim; j++) v[j] = in.readFloat(); indice.put(id, v); }
        } catch (Exception e) { indice.clear(); }
    }
    private void escribir() {
        File tmp = new File(carpeta(), "indice.tmp");
        try (DataOutputStream out = new DataOutputStream(new BufferedOutputStream(new FileOutputStream(tmp)))) {
            int dim = indice.isEmpty() ? 0 : indice.values().iterator().next().length;
            out.writeInt(indice.size()); out.writeInt(dim);
            for (Map.Entry<String, float[]> e : indice.entrySet()) { out.writeUTF(e.getKey()); for (float x : e.getValue()) out.writeFloat(x); }
        } catch (Exception e) { return; }
        tmp.renameTo(archivoIndice());
    }

    @PluginMethod
    public void estado(PluginCall call) {
        hilo.execute(() -> {
            leer();
            File f = modelo();
            JSObject r = new JSObject();
            r.put("listo", f != null); r.put("mb", f != null ? f.length() / (1024 * 1024) : 0); r.put("n", indice.size()); r.put("nombre", f != null ? f.getName() : "");
            r.put("motor", motor());
            call.resolve(r);
        });
    }

    @PluginMethod
    public void descargar(PluginCall call) {
        final String url = call.getString("url", ""), nombre = call.getString("nombre", "busqueda.gguf").replaceAll("[^A-Za-z0-9._-]", "_");
        if (url.isEmpty() || !url.startsWith("https://huggingface.co/")) { call.reject("Falta la dirección del modelo."); return; }
        Descargas.cancelar = false;
        bajada.execute(() -> {
            try {
                File fin = Descargas.bajar(url, new File(carpeta(), nombre), (n, total) -> {
                    JSObject e = new JSObject(); e.put("p", total > 0 ? (int) (n * 100 / total) : -1); e.put("mb", n / (1024 * 1024)); notifyListeners("progreso", e);
                });
                JSObject r = new JSObject(); r.put("ok", true); r.put("mb", fin.length() / (1024 * 1024)); call.resolve(r);
            } catch (Exception e) { call.reject(e.getMessage()); }
        });
    }

    @PluginMethod public void cancelar(PluginCall call) { Descargas.cancelar = true; parar = true; call.resolve(); }

    @PluginMethod
    public void borrar(PluginCall call) {
        hilo.execute(() -> {
            if (cargado) { try { co.jarvis.motores.Llama.liberarEmb(); } catch (Throwable ignored) { } cargado = false; }
            indice.clear(); leido = true;
            File[] fs = carpeta().listFiles(); if (fs != null) for (File f : fs) f.delete();
            call.resolve();
        });
    }

    /** Calcula los vectores que falten; los trozos que ya no existen se quitan. */
    @PluginMethod
    public void indexar(PluginCall call) {
        final JSArray items = call.getArray("items", new JSArray());
        parar = false;
        hilo.execute(() -> {
            try {
                leer();
                cargar();
                Set<String> vivos = new HashSet<>();
                List<String[]> faltan = new ArrayList<>();
                for (int k = 0; k < items.length(); k++) {
                    JSONObject o = items.getJSONObject(k);
                    String id = o.optString("id"); if (id.isEmpty()) continue;
                    vivos.add(id);
                    if (!indice.containsKey(id)) faltan.add(new String[] { id, o.optString("texto") });
                }
                int quitados = 0;
                for (java.util.Iterator<String> it = indice.keySet().iterator(); it.hasNext(); ) if (!vivos.contains(it.next())) { it.remove(); quitados++; }
                long ult = 0; int hechos = 0;
                for (String[] f : faltan) {
                    if (parar) break;
                    float[] v = co.jarvis.motores.Llama.embeber(f[1]);
                    if (v != null) indice.put(f[0], v);
                    hechos++;
                    long ahora = System.currentTimeMillis();
                    if (ahora - ult > 500) { ult = ahora; JSObject e = new JSObject(); e.put("hechos", hechos); e.put("total", faltan.size()); notifyListeners("indexando", e); }
                    if (hechos % 50 == 0) escribir();
                }
                if (hechos > 0 || quitados > 0) escribir();
                usado();
                JSObject r = new JSObject(); r.put("nuevos", hechos); r.put("n", indice.size()); r.put("parado", parar); call.resolve(r);
            } catch (Throwable e) { call.reject(e.getMessage() != null ? e.getMessage() : "La búsqueda falló."); }
        });
    }

    @PluginMethod
    public void buscar(PluginCall call) {
        final String q = call.getString("q", "");
        final int n = call.getInt("n", 12);
        hilo.execute(() -> {
            try {
                leer();
                cargar();
                float[] v = co.jarvis.motores.Llama.embeber(q);
                if (v == null) { call.reject("No pude entender la búsqueda."); return; }
                List<Object[]> l = new ArrayList<>();
                for (Map.Entry<String, float[]> e : indice.entrySet()) {
                    float[] w = e.getValue(); if (w.length != v.length) continue;
                    double s = 0; for (int j = 0; j < v.length; j++) s += v[j] * w[j];      // los dos ya vienen normalizados: es el coseno
                    l.add(new Object[] { e.getKey(), s });
                }
                l.sort((a, b) -> Double.compare((double) b[1], (double) a[1]));
                JSArray out = new JSArray();
                for (int k = 0; k < Math.min(n, l.size()); k++) { JSObject o = new JSObject(); o.put("id", l.get(k)[0]); o.put("p", Math.round((double) l.get(k)[1] * 1000) / 1000.0); out.put(o); }
                usado();
                JSObject r = new JSObject(); r.put("lista", out); call.resolve(r);
            } catch (Throwable e) { call.reject(e.getMessage() != null ? e.getMessage() : "La búsqueda falló."); }
        });
    }

    @Override protected void handleOnDestroy() { parar = true; }
}
