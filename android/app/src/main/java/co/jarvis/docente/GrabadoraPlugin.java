package co.jarvis.docente;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.Arrays;

/**
 * Jarvis 3.18: la grabadora de reuniones.
 *   iniciar({id}) · pausar() · seguir() · detener() · estado() → {grabando, pausado, segundos, id, partes, pendiente}
 *   partes({id}) → {lista:[{ruta, mb}], segundos} · leer({ruta}) → {data} (base64) · borrar({id}) · listo({id}) (ya se resumió)
 */
@CapacitorPlugin(name = "Grabadora")
public class GrabadoraPlugin extends Plugin {
    private void enviar(String accion, Intent extra) {
        Intent i = extra != null ? extra : new Intent(getContext(), GrabadoraService.class);
        i.setClass(getContext(), GrabadoraService.class); if (accion != null) i.setAction(accion);
        if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(i); else getContext().startService(i);
    }

    @PluginMethod
    public void iniciar(PluginCall call) {
        if (getContext().checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED) { call.reject("Falta el permiso del micrófono.", "permiso"); return; }
        if (GrabadoraService.grabando) { call.resolve(estadoObj()); return; }
        String id = call.getString("id", "r" + System.currentTimeMillis());
        enviar(null, new Intent().putExtra("id", id));
        JSObject r = new JSObject(); r.put("id", id); call.resolve(r);
    }
    @PluginMethod public void pausar(PluginCall call) { if (GrabadoraService.grabando) enviar(GrabadoraService.PAUSAR, null); call.resolve(); }
    @PluginMethod public void seguir(PluginCall call) { if (GrabadoraService.grabando) enviar(GrabadoraService.SEGUIR, null); call.resolve(); }
    @PluginMethod
    public void detener(PluginCall call) {
        String id = GrabadoraService.id; long seg = GrabadoraService.segundos();
        if (GrabadoraService.grabando) enviar(GrabadoraService.PARAR, null);
        JSObject r = new JSObject(); r.put("id", id); r.put("segundos", seg); call.resolve(r);
    }

    private JSObject estadoObj() {
        JSObject r = new JSObject();
        r.put("grabando", GrabadoraService.grabando); r.put("pausado", GrabadoraService.pausado); r.put("segundos", GrabadoraService.segundos()); r.put("id", GrabadoraService.id);
        r.put("pendiente", getContext().getSharedPreferences("jarvis_grabadora", 0).getString("pendiente", ""));
        return r;
    }
    @PluginMethod public void estado(PluginCall call) { call.resolve(estadoObj()); }

    private File dir(String id) {
        if (id == null || !id.matches("[A-Za-z0-9_-]{1,40}")) return null;
        File d = new File(new File(getContext().getFilesDir(), "reuniones"), id);
        return d.isDirectory() ? d : null;
    }

    @PluginMethod
    public void partes(PluginCall call) {
        File d = dir(call.getString("id", ""));
        JSArray l = new JSArray();
        if (d != null) {
            File[] fs = d.listFiles((x, n) -> n.endsWith(".aac"));
            if (fs != null) {
                Arrays.sort(fs, (a, b) -> Integer.compare(num(a.getName()), num(b.getName())));
                for (File f : fs) { if (f.length() < 2000) continue; JSObject o = new JSObject(); o.put("ruta", f.getAbsolutePath()); o.put("mb", f.length() / 1048576.0); l.put(o); }
            }
        }
        JSObject r = new JSObject(); r.put("lista", l);
        r.put("segundos", getContext().getSharedPreferences("jarvis_grabadora", 0).getLong("seg_" + call.getString("id", ""), 0));
        call.resolve(r);
    }
    private static int num(String n) { try { return Integer.parseInt(n.replaceAll("\\D", "")); } catch (Exception e) { return 0; } }

    @PluginMethod
    public void leer(PluginCall call) {
        String ruta = call.getString("ruta", "");
        new Thread(() -> {
            try {
                File f = new File(ruta);
                File base = new File(getContext().getFilesDir(), "reuniones");
                if (!f.getCanonicalPath().startsWith(base.getCanonicalPath()) || !f.isFile()) { call.reject("No encontré esa parte."); return; }
                try (InputStream in = new FileInputStream(f); ByteArrayOutputStream o = new ByteArrayOutputStream()) {
                    byte[] b = new byte[32768]; int n; while ((n = in.read(b)) > 0) o.write(b, 0, n);
                    JSObject r = new JSObject(); r.put("data", android.util.Base64.encodeToString(o.toByteArray(), android.util.Base64.NO_WRAP)); call.resolve(r);
                }
            } catch (Exception e) { call.reject("No pude leer la grabación."); }
        }).start();
    }

    @PluginMethod
    public void listo(PluginCall call) {
        android.content.SharedPreferences p = getContext().getSharedPreferences("jarvis_grabadora", 0);
        if (call.getString("id", "").equals(p.getString("pendiente", ""))) p.edit().remove("pendiente").apply();
        call.resolve();
    }

    @PluginMethod
    public void borrar(PluginCall call) {
        File d = dir(call.getString("id", ""));
        if (d != null) { File[] fs = d.listFiles(); if (fs != null) for (File f : fs) f.delete(); d.delete(); }
        call.resolve();
    }
}
