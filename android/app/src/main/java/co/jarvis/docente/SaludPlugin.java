package co.jarvis.docente;

import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Jarvis 3.31 · Health Connect: estado() → {estado: listo|actualizar|no, permisos} · conectar() (Android pregunta qué compartir)
 * · resumen({dias}) → {pasos, sueno, pulso}. Solo lectura; nada sale del celular salvo lo que tú le preguntes a la IA.
 */
@CapacitorPlugin(name = "Salud")
public class SaludPlugin extends Plugin {
    @PluginMethod
    public void estado(PluginCall call) {
        new Thread(() -> {
            JSObject r = new JSObject();
            String e = "no";
            try { e = SaludMotor.estado(getContext()); } catch (Throwable ignored) { }
            r.put("estado", e);
            r.put("permisos", "listo".equals(e) ? SaludMotor.concedidos(getContext()) : 0);
            call.resolve(r);
        }).start();
    }

    @PluginMethod
    public void conectar(PluginCall call) {
        String e = SaludMotor.estado(getContext());
        if ("actualizar".equals(e) || "no".equals(e)) {
            try {   // Health Connect viene con Android 14+; en Android 13 o menos es una app de Play
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding"));
                i.setPackage("com.android.vending"); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            } catch (Exception ignored) { }
            JSObject r = new JSObject(); r.put("estado", e); r.put("permisos", 0); call.resolve(r); return;
        }
        try { startActivityForResult(call, SaludMotor.intentPermisos(getContext()), "conectado"); }
        catch (Exception ex) { call.reject("No pude abrir Health Connect: " + ex.getMessage()); }
    }

    @ActivityCallback
    private void conectado(PluginCall call, ActivityResult res) {
        if (call == null) return;
        new Thread(() -> { JSObject r = new JSObject(); r.put("estado", "listo"); r.put("permisos", SaludMotor.concedidos(getContext())); call.resolve(r); }).start();
    }

    @PluginMethod
    public void resumen(PluginCall call) {
        final int dias = Math.max(1, Math.min(30, call.getInt("dias", 7)));
        new Thread(() -> {
            try { call.resolve(new JSObject(SaludMotor.resumen(getContext(), dias))); }
            catch (Throwable e) { call.reject("No pude leer Health Connect: " + e.getMessage()); }
        }).start();
    }
}
