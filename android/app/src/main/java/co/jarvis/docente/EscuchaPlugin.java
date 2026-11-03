package co.jarvis.docente;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Jarvis: «Jarvis» en segundo plano. La app lo usa así:
 *   modelo() → ¿ya está el modelo de voz en el celular?   descargar() → lo baja una vez (≈ 40 MB, con eventos «progreso»)
 *   activar() / desactivar()   pausar() / reanudar() (mientras Jarvis conversa usa el micrófono)
 *   evento «despertar» {resto}: dijiste «Jarvis…» (resto = lo que dijiste después).
 */
@CapacitorPlugin(name = "Escucha", permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microfono") })
public class EscuchaPlugin extends Plugin {
    static final String EXTRA_DESPERTAR = "jarvis_despertar", EXTRA_RESTO = "jarvis_resto";
    static final String URL_MODELO = "https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip";
    private static EscuchaPlugin instancia;
    private static String pendiente = null;

    @Override
    public void load() {
        instancia = this;
        if (pendiente != null) { String r = pendiente; pendiente = null; despertar(r); }
    }

    static void emitir(String evento, String valor) {
        if (instancia == null) return;
        JSObject o = new JSObject();
        o.put("valor", valor);
        instancia.notifyListeners(evento, o);
    }

    static void despertar(String resto) {
        if (instancia == null) { pendiente = resto == null ? "" : resto; return; }
        JSObject o = new JSObject();
        o.put("resto", resto == null ? "" : resto);
        instancia.notifyListeners("despertar", o, true);
    }

    /** La actividad llama esto al abrirse por «Jarvis». */
    static void revisar(Intent intent) {
        if (intent == null || !intent.getBooleanExtra(EXTRA_DESPERTAR, false)) return;
        intent.removeExtra(EXTRA_DESPERTAR);
    }

    static File carpeta(Context c) { return new File(c.getFilesDir(), "vosk"); }

    /** La carpeta del modelo (la que tiene «conf» y «am»), o null si no está. */
    static String rutaModelo(Context c) {
        File base = carpeta(c);
        File[] hijos = base.listFiles();
        if (hijos == null) return null;
        for (File h : hijos) if (h.isDirectory() && new File(h, "conf").isDirectory() && new File(h, "am").isDirectory()) return h.getAbsolutePath();
        return null;
    }

    @PluginMethod
    public void modelo(PluginCall call) {
        JSObject r = new JSObject();
        r.put("listo", rutaModelo(getContext()) != null);
        r.put("activo", EscuchaService.activo);
        r.put("pausado", EscuchaService.pausado);
        r.put("superponer", Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(getContext()));
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        r.put("bateria", Build.VERSION.SDK_INT < Build.VERSION_CODES.M || (pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName())));
        call.resolve(r);
    }

    @PluginMethod
    public void descargar(final PluginCall call) {
        if (rutaModelo(getContext()) != null) { call.resolve(); return; }
        call.setKeepAlive(true);
        new Thread(() -> {
            File base = carpeta(getContext());
            File tmp = new File(getContext().getCacheDir(), "vosk.zip");
            try {
                HttpURLConnection con = (HttpURLConnection) new URL(URL_MODELO).openConnection();
                con.setConnectTimeout(20000); con.setReadTimeout(30000);
                con.setInstanceFollowRedirects(true);
                long total = con.getContentLengthLong();
                try (InputStream in = new BufferedInputStream(con.getInputStream()); FileOutputStream out = new FileOutputStream(tmp)) {
                    byte[] b = new byte[65536];
                    long hecho = 0; int n, ultimo = -1;
                    while ((n = in.read(b)) > 0) {
                        out.write(b, 0, n); hecho += n;
                        int p = total > 0 ? (int) (hecho * 90 / total) : -1;
                        if (p != ultimo) { ultimo = p; JSObject o = new JSObject(); o.put("p", p); notifyListeners("progreso", o); }
                    }
                }
                base.mkdirs();
                try (ZipInputStream z = new ZipInputStream(new BufferedInputStream(new java.io.FileInputStream(tmp)))) {
                    ZipEntry e;
                    byte[] b = new byte[65536];
                    String raiz = base.getCanonicalPath() + File.separator;
                    while ((e = z.getNextEntry()) != null) {
                        File f = new File(base, e.getName());
                        if (!f.getCanonicalPath().startsWith(raiz)) continue;                 // nada fuera de la carpeta
                        if (e.isDirectory()) { f.mkdirs(); continue; }
                        File p = f.getParentFile(); if (p != null) p.mkdirs();
                        try (FileOutputStream out = new FileOutputStream(f)) { int n; while ((n = z.read(b)) > 0) out.write(b, 0, n); }
                    }
                }
                tmp.delete();
                JSObject o = new JSObject(); o.put("p", 100); notifyListeners("progreso", o);
                if (rutaModelo(getContext()) == null) throw new IllegalStateException("El modelo descargado no quedó completo.");
                call.resolve();
            } catch (Exception ex) {
                tmp.delete();
                call.reject("No pude descargar el modelo de voz: " + ex.getMessage());
            } finally {
                call.setKeepAlive(false);
            }
        }, "jarvis-modelo").start();
    }

    @PluginMethod
    public void activar(PluginCall call) {
        if (getPermissionState("microfono") != PermissionState.GRANTED) { requestPermissionForAlias("microfono", call, "trasPermiso"); return; }
        iniciar(call);
    }

    @PermissionCallback
    private void trasPermiso(PluginCall call) {
        if (getPermissionState("microfono") != PermissionState.GRANTED) { call.reject("Jarvis necesita el micrófono para oír «Jarvis»."); return; }
        iniciar(call);
    }

    private void iniciar(PluginCall call) {
        if (rutaModelo(getContext()) == null) { call.reject("Primero hay que descargar el modelo de voz."); return; }
        Intent i = new Intent(getContext(), EscuchaService.class).setAction(EscuchaService.ACCION_REANUDAR);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(i); else getContext().startService(i);
        call.resolve();
    }

    @PluginMethod
    public void desactivar(PluginCall call) {
        getContext().stopService(new Intent(getContext(), EscuchaService.class));
        call.resolve();
    }

    /** 3.7.1: cuándo escuchar (ahorro de batería): {cuidarBateria, bateriaMin, soloPantalla, soloHorario, ventanas:[{dia, ini, fin}]} */
    @PluginMethod
    public void config(PluginCall call) {
        android.content.SharedPreferences.Editor e = getContext().getSharedPreferences("jarvis_escucha", 0).edit();
        e.putBoolean("cuidarBateria", call.getBoolean("cuidarBateria", true));
        e.putInt("bateriaMin", call.getInt("bateriaMin", 15));
        e.putBoolean("soloPantalla", call.getBoolean("soloPantalla", false));
        e.putBoolean("soloHorario", call.getBoolean("soloHorario", false));
        e.putString("ventanas", call.getArray("ventanas", new com.getcapacitor.JSArray()).toString());
        e.apply();
        call.resolve();
    }

    /** 3.7.1: ¿Android está dejando a Jarvis sin restricciones de batería? */
    @PluginMethod
    public void bateriaEstado(PluginCall call) {
        JSObject r = new JSObject();
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            Intent b = getContext().registerReceiver(null, new android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            r.put("nivel", b != null ? b.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1) * 100 / Math.max(1, b.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, 100)) : -1);
            r.put("ahorro", pm != null && pm.isPowerSaveMode());
            r.put("sinRestriccion", Build.VERSION.SDK_INT < 23 || (pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName())));
        } catch (Exception ignored) { }
        call.resolve(r);
    }

    @PluginMethod
    public void pausar(PluginCall call) {
        // 3.3: responde solo cuando el micrófono quedó libre de verdad (antes respondía de una vez y el reconocedor oía silencio)
        new Thread(() -> {
            if (EscuchaService.activo) {
                if (EscuchaService.grabando) EscuchaService.soltarMicrofono(getContext(), 2500);
                else {
                    Intent i = new Intent(getContext(), EscuchaService.class).setAction(EscuchaService.ACCION_PAUSAR);
                    try { if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(i); else getContext().startService(i); } catch (Exception ignored) { }
                }
            }
            JSObject r = new JSObject(); r.put("libre", !EscuchaService.grabando);
            call.resolve(r);
        }, "jarvis-pausar").start();
    }

    @PluginMethod
    public void reanudar(PluginCall call) {
        if (EscuchaService.activo) {
            Intent i = new Intent(getContext(), EscuchaService.class).setAction(EscuchaService.ACCION_REANUDAR);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(i); else getContext().startService(i);
        }
        call.resolve();
    }

    /** Abre el ajuste para que Android no apague a Jarvis por ahorro de batería. */
    @PluginMethod
    public void bateria(PluginCall call) {
        if (call.getBoolean("lista", false)) {                      // 3.7.1: la lista de Android, para quitar la excepción
            try { getContext().startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { }
            call.resolve(); return;
        }
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }
}
