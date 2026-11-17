package co.jarvis.docente;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.graphics.Point;
import android.hardware.display.DisplayManager;
import android.os.Build;
import android.view.Display;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Jarvis 3.24 · Nexo Escritorio (com.nexo.escritorio), en las dos direcciones.
 *   estado() → {instalado, version, monitor, monitorTam}   (lo mira Jarvis solo, sin abrir Nexo)
 *   orden({accion, app?, modo?, q?, id?}) → abre la puerta de Nexo (NexoApiActivity); Nexo contesta con el evento «resultado»
 *   responder({pregunta, texto}) → le manda a Nexo la respuesta a lo que preguntaste desde el escritorio (tarjeta en el monitor)
 * Lo que pregunta Nexo llega por MainActivity (acción co.jarvis.docente.PREGUNTAR) a la cola de entradas de Ventana.
 */
@CapacitorPlugin(name = "Nexo")
public class NexoPlugin extends Plugin {
    static final String PKG = "com.nexo.escritorio";
    static final String ORDEN = "com.nexo.escritorio.ORDEN";
    static final String RESPUESTA = "com.nexo.escritorio.JARVIS_RESPUESTA";
    static final String RESULTADO = "co.jarvis.docente.NEXO";

    private BroadcastReceiver rx;

    @Override
    public void load() {
        rx = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent i) {
                JSObject r = new JSObject();
                r.put("id", i.getStringExtra("id"));
                r.put("ok", i.getBooleanExtra("ok", false));
                r.put("codigo", i.getStringExtra("codigo"));
                r.put("mensaje", i.getStringExtra("mensaje"));
                r.put("monitor", i.getStringExtra("monitor"));
                r.put("monitorTam", i.getStringExtra("monitorTam"));
                r.put("abierto", i.getBooleanExtra("abierto", false));
                r.put("dondeAbierto", i.getStringExtra("dondeAbierto"));
                r.put("version", i.getStringExtra("version"));
                r.put("ventanas", i.getIntExtra("ventanas", 0));
                r.put("pcActivo", i.getBooleanExtra("pcActivo", false));
                r.put("pcUrl", i.getStringExtra("pcUrl"));
                r.put("pcClave", i.getStringExtra("pcClave"));
                r.put("pcPrograma", i.getBooleanExtra("pcPrograma", false));
                notifyListeners("resultado", r);
            }
        };
        IntentFilter f = new IntentFilter(RESULTADO);
        try {
            if (Build.VERSION.SDK_INT >= 33) getContext().registerReceiver(rx, f, Context.RECEIVER_EXPORTED);
            else getContext().registerReceiver(rx, f);
        } catch (Exception ignored) { rx = null; }
    }

    @Override
    protected void handleOnDestroy() {
        try { if (rx != null) getContext().unregisterReceiver(rx); } catch (Exception ignored) { }
        rx = null;
    }

    @PluginMethod
    public void estado(PluginCall call) {
        JSObject r = new JSObject();
        Context c = getContext();
        try {
            PackageInfo p = c.getPackageManager().getPackageInfo(PKG, 0);
            r.put("instalado", true);
            r.put("version", p.versionName);
        } catch (Exception e) { r.put("instalado", false); }
        Display d = externa(c);
        if (d != null) {
            Point s = new Point();
            d.getRealSize(s);
            r.put("monitor", d.getName());
            r.put("monitorTam", s.x + "×" + s.y);
        } else r.put("monitor", "");
        call.resolve(r);
    }

    /** La primera pantalla conectada que no es la del celular (cable, inalámbrica o scrcpy). */
    private static Display externa(Context c) {
        try {
            DisplayManager dm = (DisplayManager) c.getSystemService(Context.DISPLAY_SERVICE);
            for (Display d : dm.getDisplays()) {
                if (d.getDisplayId() == Display.DEFAULT_DISPLAY) continue;
                if (d.getState() == Display.STATE_OFF) continue;
                if ((d.getFlags() & Display.FLAG_PRIVATE) != 0) continue;
                return d;
            }
        } catch (Exception ignored) { }
        return null;
    }

    @PluginMethod
    public void orden(PluginCall call) {
        String accion = call.getString("accion", "abrir");
        Intent i = new Intent(ORDEN).setPackage(PKG).addCategory(Intent.CATEGORY_DEFAULT).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        i.putExtra("accion", accion);
        i.putExtra("id", call.getString("id", ""));
        if (call.getString("app") != null) i.putExtra("app", call.getString("app"));
        if (call.getString("modo") != null) i.putExtra("modo", call.getString("modo"));
        if (call.getString("q") != null) i.putExtra("q", call.getString("q"));
        if (call.getBoolean("empezar", false)) i.putExtra("empezar", true);
        try {
            if (getActivity() != null) getActivity().startActivity(i); else getContext().startActivity(i);
            call.resolve();
        } catch (android.content.ActivityNotFoundException e) {
            call.reject("Nexo Escritorio no está instalado (o es una versión vieja sin la conexión con Jarvis).", "SIN_NEXO");
        } catch (Exception e) {
            call.reject("No pude hablar con Nexo: " + e.getMessage());
        }
    }

    /**
     * abrir({que}) · «pantallas» (proyectar / Miracast), «desarrollador» (opciones de desarrollador), «acerca» (número de compilación),
     * «nexo» (la app Nexo, que guía la preparación), «ajustes-nexo» (información de la app Nexo).
     */
    @PluginMethod
    public void abrir(PluginCall call) {
        String que = call.getString("que", "");
        Context c = getContext();
        java.util.List<Intent> l = new java.util.ArrayList<>();
        switch (que == null ? "" : que) {
            case "pantallas":
                l.add(new Intent(android.provider.Settings.ACTION_CAST_SETTINGS));
                l.add(new Intent("android.settings.WIFI_DISPLAY_SETTINGS"));
                l.add(new Intent(android.provider.Settings.ACTION_DISPLAY_SETTINGS));
                break;
            case "desarrollador":
                l.add(new Intent(android.provider.Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS));
                l.add(new Intent(android.provider.Settings.ACTION_DEVICE_INFO_SETTINGS));
                break;
            case "modem":
                l.add(new Intent().setComponent(new android.content.ComponentName("com.android.settings", "com.android.settings.TetherSettings")));
                l.add(new Intent("android.settings.TETHER_SETTINGS"));
                l.add(new Intent(android.provider.Settings.ACTION_WIRELESS_SETTINGS));
                break;
            case "acerca":
                l.add(new Intent(android.provider.Settings.ACTION_DEVICE_INFO_SETTINGS));
                break;
            case "nexo": {
                Intent i = c.getPackageManager().getLaunchIntentForPackage(PKG);
                if (i != null) l.add(i);
                break;
            }
            case "ajustes-nexo":
                l.add(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:" + PKG)));
                break;
        }
        for (Intent i : l) {
            try {
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (getActivity() != null) getActivity().startActivity(i); else c.startActivity(i);
                JSObject r = new JSObject(); r.put("ok", true); call.resolve(r); return;
            } catch (Exception ignored) { }
        }
        call.reject(que.equals("nexo") ? "Nexo Escritorio no está instalado." : "Tu celular no tiene esa pantalla de ajustes.");
    }

    @PluginMethod
    public void responder(PluginCall call) {
        String texto = call.getString("texto", "");
        if (texto == null || texto.trim().isEmpty()) { call.resolve(); return; }
        Intent i = new Intent(RESPUESTA).setPackage(PKG);
        i.putExtra("pregunta", call.getString("pregunta", ""));
        i.putExtra("texto", texto.length() > 4000 ? texto.substring(0, 4000) : texto);
        try { getContext().sendBroadcast(i); } catch (Exception ignored) { }
        call.resolve();
    }
}
