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
    private static MensajesPlugin yo;
    @Override public void load() { yo = this; }

    /** 3.9: llegó un mensaje (para el modo conducción). → true si Jarvis está escuchando el evento. */
    static boolean llego(NotiServicio.Msg m) {
        MensajesPlugin p = yo; if (p == null || !p.hasListeners("llego")) return false;
        JSObject o = new JSObject();
        o.put("clave", m.clave); o.put("app", m.app); o.put("de", m.de); o.put("texto", m.texto); o.put("t", m.t); o.put("puedeResponder", m.responder != null);
        p.notifyListeners("llego", o);
        return true;
    }

    /** 3.9: {conduccion, gastosAuto} */
    @PluginMethod
    public void config(PluginCall call) {
        android.content.SharedPreferences.Editor e = getContext().getSharedPreferences("jarvis_noti", 0).edit();
        if (call.hasOption("conduccion")) e.putBoolean("conduccion", call.getBoolean("conduccion", false));
        if (call.hasOption("gastosAuto")) e.putBoolean("gastosAuto", call.getBoolean("gastosAuto", false));
        if (call.hasOption("estafas")) e.putBoolean("estafas", call.getBoolean("estafas", true));
        if (call.hasOption("autoResp")) e.putBoolean("autoResp", call.getBoolean("autoResp", false));
        if (call.hasOption("archivar")) { boolean on = call.getBoolean("archivar", false); e.putBoolean("archivar", on); if (!on) Archivo.borrar(getContext()); }   // 3.18
        if (call.hasOption("autoTexto")) e.putString("autoTexto", call.getString("autoTexto", ""));
        if (call.hasOption("autoHasta")) e.putLong("autoHasta", (long) (double) call.getDouble("autoHasta", 0d));
        e.apply(); call.resolve();
    }

    /** 3.18: la memoria de tus mensajes: {dias} → {lista:[{a: app, d: de, x: texto, t}]} */
    @PluginMethod
    public void archivo(PluginCall call) {
        long dias = Math.max(1, Math.min(30, call.getInt("dias", 30)));
        new Thread(() -> {
            JSObject r = new JSObject();
            try { r.put("lista", Archivo.json(getContext(), System.currentTimeMillis() - dias * 24L * 3600 * 1000)); } catch (Exception e) { r.put("lista", new com.getcapacitor.JSArray()); }
            r.put("activo", getContext().getSharedPreferences("jarvis_noti", 0).getBoolean("archivar", false));
            call.resolve(r);
        }).start();
    }
    @PluginMethod
    public void borrarArchivo(PluginCall call) { Archivo.borrar(getContext()); call.resolve(); }

    /** 3.11: ¿parece estafa? (las mismas reglas que revisan los mensajes que llegan) {texto} → {puntaje} */
    @PluginMethod
    public void estafa(PluginCall call) { JSObject r = new JSObject(); r.put("puntaje", NotiServicio.estafa(call.getString("texto", ""))); call.resolve(r); }

    /** 3.9: avisos de compras y pagos del banco: {lista:[{clave, app, texto, t}]} */
    @PluginMethod
    public void banco(PluginCall call) {
        long desde = (long) (double) call.getDouble("desde", 0d);
        JSArray l = new JSArray();
        for (NotiServicio.Gasto g : NotiServicio.gastos(desde)) { JSObject o = new JSObject(); o.put("clave", g.clave); o.put("app", g.app); o.put("texto", g.texto); o.put("t", g.t); l.put(o); }
        JSObject r = new JSObject(); r.put("lista", l); r.put("sinPermiso", !activo()); call.resolve(r);
    }

    /** 3.9: «¿qué me perdí?»: todas las notificaciones que tienes. {lista:[{app, titulo, texto, t}]} */
    @PluginMethod
    public void activas(PluginCall call) {
        JSArray l = new JSArray();
        NotiServicio s = NotiServicio.instancia;
        if (s != null) for (String[] a : s.activas()) { JSObject o = new JSObject(); o.put("app", a[0]); o.put("titulo", a[1]); o.put("texto", a[2]); o.put("t", Long.parseLong(a[3])); l.put(o); }
        JSObject r = new JSObject(); r.put("lista", l); r.put("sinPermiso", !activo()); call.resolve(r);
    }
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
