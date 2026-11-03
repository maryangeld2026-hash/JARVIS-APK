package co.jarvis.docente;

import android.app.RemoteInput;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Bundle;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Jarvis 3.7: «¿qué me escribieron?» y «respóndele que…».
 *   activo() → {activo}     permiso() → abre «Acceso a notificaciones»
 *   recientes({desde}) → {lista: [{clave, app, de, texto, t, puedeResponder}]}     responder({clave, texto})
 */
@CapacitorPlugin(name = "Mensajes")
public class MensajesPlugin extends Plugin {
    private boolean activo() {
        String s = Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners");
        return s != null && s.contains(new ComponentName(getContext(), NotiServicio.class).flattenToString());
    }

    @PluginMethod
    public void activo(PluginCall call) { JSObject r = new JSObject(); r.put("activo", activo()); call.resolve(r); }

    @PluginMethod
    public void permiso(PluginCall call) {
        try { getContext().startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { }
        call.resolve();
    }

    @PluginMethod
    public void recientes(PluginCall call) {
        if (!activo()) { JSObject r = new JSObject(); r.put("sinPermiso", true); r.put("lista", new JSArray()); call.resolve(r); return; }
        long desde = (long) (double) call.getDouble("desde", 0d);
        JSArray l = new JSArray();
        for (NotiServicio.Msg m : NotiServicio.lista(desde)) {
            JSObject o = new JSObject();
            o.put("clave", m.clave); o.put("app", m.app); o.put("de", m.de); o.put("texto", m.texto); o.put("t", m.t); o.put("puedeResponder", m.responder != null);
            l.put(o);
        }
        JSObject r = new JSObject(); r.put("lista", l); call.resolve(r);
    }

    @PluginMethod
    public void responder(PluginCall call) {
        NotiServicio.Msg m = NotiServicio.buscar(call.getString("clave", ""));
        String texto = call.getString("texto", "");
        if (m == null || m.responder == null) { call.reject("Ese mensaje ya no se puede responder desde aquí. Ábrelo en la app."); return; }
        try {
            Intent i = new Intent();
            Bundle b = new Bundle();
            for (RemoteInput ri : m.entradas) b.putCharSequence(ri.getResultKey(), texto);
            RemoteInput.addResultsToIntent(m.entradas, i, b);
            m.responder.actionIntent.send(getContext(), 0, i);
            JSObject r = new JSObject(); r.put("ok", true); call.resolve(r);
        } catch (Exception e) { call.reject("No pude responder: " + e.getMessage()); }
    }
}
