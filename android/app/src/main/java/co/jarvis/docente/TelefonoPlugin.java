package co.jarvis.docente;

import android.Manifest;
import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.database.Cursor;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.media.AudioManager;
import android.net.Uri;
import android.provider.AlarmClock;
import android.provider.ContactsContract;
import android.provider.Settings;
import android.telephony.SmsManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Jarvis 3.6: controlar el celular por voz.
 *   contactos({q}) → [{nombre, numero}]      llamar({numero})      sms({numero, texto})
 *   apps() → [{nombre, paquete}]      abrirApp({paquete})      cerrarApp({paquete}) (solo las de segundo plano: regla de Android)
 *   linterna({on})      volumen({accion: subir|bajar|silencio|max|sonido})      alarma({hora, minuto, texto})
 *   global({accion: inicio|atras|recientes|notificaciones|ajustesRapidos|bloquear|captura}) (necesita el control de Jarvis en Accesibilidad)
 *   ip() → la dirección del celular en el wifi (para la práctica con QR)
 */
@CapacitorPlugin(name = "Telefono", permissions = {
    @Permission(strings = { Manifest.permission.READ_CONTACTS }, alias = "contactos"),
    @Permission(strings = { Manifest.permission.CALL_PHONE }, alias = "llamar"),
    @Permission(strings = { Manifest.permission.SEND_SMS }, alias = "sms")
})
public class TelefonoPlugin extends Plugin {

    // ======================================================================== contactos, llamar, SMS
    @PluginMethod
    public void contactos(PluginCall call) {
        if (getPermissionState("contactos") != PermissionState.GRANTED) { requestPermissionForAlias("contactos", call, "contactosListo"); return; }
        buscar(call);
    }

    @PermissionCallback
    private void contactosListo(PluginCall call) {
        if (getPermissionState("contactos") != PermissionState.GRANTED) { call.reject("Sin permiso para ver tus contactos."); return; }
        buscar(call);
    }

    private void buscar(PluginCall call) {
        String q = call.getString("q", "").trim();
        JSArray out = new JSArray();
        String[] cols = { ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER, ContactsContract.CommonDataKinds.Phone.IS_SUPER_PRIMARY };
        List<String> vistos = new ArrayList<>();
        try (Cursor k = getContext().getContentResolver().query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI, cols,
                q.isEmpty() ? null : ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " LIKE ?", q.isEmpty() ? null : new String[] { "%" + q + "%" },
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC")) {
            int max = q.isEmpty() ? 5000 : 40;
            while (k != null && k.moveToNext() && out.length() < max) {
                String n = k.getString(0), num = k.getString(1);
                if (n == null || num == null) continue;
                String clave = n + "|" + num.replaceAll("[^0-9+]", "");
                if (vistos.contains(clave)) continue;
                vistos.add(clave);
                JSObject c = new JSObject(); c.put("nombre", n); c.put("numero", num); out.put(c);
            }
        } catch (Exception e) { call.reject("No pude leer tus contactos: " + e.getMessage()); return; }
        JSObject r = new JSObject(); r.put("lista", out); call.resolve(r);
    }

    /** 3.10: «No molestar» encendido o apagado (si diste el permiso; si no, abre el ajuste). {on} → {ok} */
    @PluginMethod
    public void noMolestar(PluginCall call) {
        android.app.NotificationManager nm = (android.app.NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        JSObject r = new JSObject();
        if (nm == null || !nm.isNotificationPolicyAccessGranted()) {
            try { getContext().startActivity(new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { }
            r.put("ok", false); call.resolve(r); return;
        }
        nm.setInterruptionFilter(call.getBoolean("on", true) ? android.app.NotificationManager.INTERRUPTION_FILTER_PRIORITY : android.app.NotificationManager.INTERRUPTION_FILTER_ALL);
        r.put("ok", true); call.resolve(r);
    }

    /** 3.10: el brillo de la pantalla {nivel: 0–100} (Android pide un permiso especial la primera vez). */
    @PluginMethod
    public void brillo(PluginCall call) {
        JSObject r = new JSObject();
        if (android.os.Build.VERSION.SDK_INT >= 23 && !Settings.System.canWrite(getContext())) {
            try { getContext().startActivity(new Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.parse("package:" + getContext().getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { }
            r.put("ok", false); call.resolve(r); return;
        }
        try {
            int n = Math.max(1, Math.min(100, call.getInt("nivel", 20)));
            Settings.System.putInt(getContext().getContentResolver(), Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL);
            Settings.System.putInt(getContext().getContentResolver(), Settings.System.SCREEN_BRIGHTNESS, Math.round(n * 2.55f));
            r.put("ok", true);
        } catch (Exception e) { r.put("ok", false); }
        call.resolve(r);
    }

    /** 3.10: el texto de la pantalla que estabas viendo cuando llamaste a Jarvis: {app, texto, t, activo} */
    @PluginMethod
    public void pantalla(PluginCall call) {
        JSObject r = new JSObject();
        r.put("activo", ControlServicio.instancia != null);
        r.put("app", ControlServicio.capApp); r.put("texto", ControlServicio.capTexto); r.put("t", ControlServicio.capT);
        if (call.getBoolean("borrar", false)) { ControlServicio.capTexto = ""; ControlServicio.capApp = ""; ControlServicio.capT = 0; }
        call.resolve(r);
    }

    /** 3.9: los cumpleaños guardados en tus contactos: {lista:[{nombre, fecha}]} (fecha «--MM-DD» o «AAAA-MM-DD»). */
    @PluginMethod
    public void cumpleanos(PluginCall call) {
        if (getPermissionState("contactos") != PermissionState.GRANTED) { requestPermissionForAlias("contactos", call, "cumpleListo"); return; }
        leerCumple(call);
    }
    @PermissionCallback
    private void cumpleListo(PluginCall call) {
        if (getPermissionState("contactos") != PermissionState.GRANTED) { call.reject("Sin permiso para ver tus contactos."); return; }
        leerCumple(call);
    }
    private void leerCumple(PluginCall call) {
        JSArray out = new JSArray();
        String[] cols = { ContactsContract.Data.DISPLAY_NAME, ContactsContract.CommonDataKinds.Event.START_DATE };
        String sel = ContactsContract.Data.MIMETYPE + "=? AND " + ContactsContract.CommonDataKinds.Event.TYPE + "=" + ContactsContract.CommonDataKinds.Event.TYPE_BIRTHDAY;
        try (Cursor k = getContext().getContentResolver().query(ContactsContract.Data.CONTENT_URI, cols, sel, new String[] { ContactsContract.CommonDataKinds.Event.CONTENT_ITEM_TYPE }, null)) {
            while (k != null && k.moveToNext() && out.length() < 2000) {
                String n = k.getString(0), f = k.getString(1);
                if (n == null || f == null) continue;
                JSObject c = new JSObject(); c.put("nombre", n); c.put("fecha", f); out.put(c);
            }
        } catch (Exception e) { call.reject("No pude leer los cumpleaños: " + e.getMessage()); return; }
        JSObject r = new JSObject(); r.put("lista", out); call.resolve(r);
    }

    /** 3.9: abre «Nuevo contacto» de Android con los datos de una tarjeta de presentación (tú lo revisas y lo guardas). */
    @PluginMethod
    public void nuevoContacto(PluginCall call) {
        try {
            Intent i = new Intent(ContactsContract.Intents.Insert.ACTION).setType(ContactsContract.RawContacts.CONTENT_TYPE);
            i.putExtra(ContactsContract.Intents.Insert.NAME, call.getString("nombre", ""));
            if (!call.getString("telefono", "").isEmpty()) i.putExtra(ContactsContract.Intents.Insert.PHONE, call.getString("telefono", ""));
            if (!call.getString("email", "").isEmpty()) i.putExtra(ContactsContract.Intents.Insert.EMAIL, call.getString("email", ""));
            if (!call.getString("empresa", "").isEmpty()) i.putExtra(ContactsContract.Intents.Insert.COMPANY, call.getString("empresa", ""));
            if (!call.getString("cargo", "").isEmpty()) i.putExtra(ContactsContract.Intents.Insert.JOB_TITLE, call.getString("cargo", ""));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) { call.reject("No pude abrir «Nuevo contacto»: " + e.getMessage()); }
    }

    @PluginMethod
    public void llamar(PluginCall call) {
        if (getPermissionState("llamar") != PermissionState.GRANTED) { requestPermissionForAlias("llamar", call, "llamarListo"); return; }
        hacerLlamada(call, true);
    }

    @PermissionCallback
    private void llamarListo(PluginCall call) { hacerLlamada(call, getPermissionState("llamar") == PermissionState.GRANTED); }

    private void hacerLlamada(PluginCall call, boolean directo) {
        String num = call.getString("numero", "").replaceAll("[^0-9+*#]", "");
        if (num.isEmpty()) { call.reject("Falta el número."); return; }
        try {
            Intent i = new Intent(directo ? Intent.ACTION_CALL : Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(num)));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            JSObject r = new JSObject(); r.put("directo", directo); call.resolve(r);
        } catch (Exception e) { call.reject("No pude llamar: " + e.getMessage()); }
    }

    @PluginMethod
    public void sms(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) { requestPermissionForAlias("sms", call, "smsListo"); return; }
        enviarSms(call);
    }

    @PermissionCallback
    private void smsListo(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            // sin permiso: se abre la app de mensajes con el texto listo
            try {
                Intent i = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + call.getString("numero", "")));
                i.putExtra("sms_body", call.getString("texto", "")); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                JSObject r = new JSObject(); r.put("abierto", true); call.resolve(r);
            } catch (Exception e) { call.reject("No pude abrir los mensajes."); }
            return;
        }
        enviarSms(call);
    }

    @SuppressWarnings("deprecation")
    private void enviarSms(PluginCall call) {
        String num = call.getString("numero", "").replaceAll("[^0-9+]", ""), t = call.getString("texto", "");
        if (num.isEmpty() || t.isEmpty()) { call.reject("Falta el número o el mensaje."); return; }
        try {
            SmsManager sm = android.os.Build.VERSION.SDK_INT >= 31 ? getContext().getSystemService(SmsManager.class) : SmsManager.getDefault();
            ArrayList<String> partes = sm.divideMessage(t);
            sm.sendMultipartTextMessage(num, null, partes, null, null);
            JSObject r = new JSObject(); r.put("enviado", true); call.resolve(r);
        } catch (Exception e) { call.reject("No pude enviar el mensaje: " + e.getMessage()); }
    }

    // ======================================================================== aplicaciones
    @PluginMethod
    public void apps(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        JSArray out = new JSArray();
        try {
            for (ResolveInfo ri : pm.queryIntentActivities(i, 0)) {
                JSObject a = new JSObject();
                a.put("nombre", String.valueOf(ri.loadLabel(pm)));
                a.put("paquete", ri.activityInfo.packageName);
                out.put(a);
            }
        } catch (Exception e) { call.reject("No pude ver las apps: " + e.getMessage()); return; }
        JSObject r = new JSObject(); r.put("lista", out); call.resolve(r);
    }

    @PluginMethod
    public void abrirApp(PluginCall call) {
        String p = call.getString("paquete", "");
        Intent i = getContext().getPackageManager().getLaunchIntentForPackage(p);
        if (i == null) { call.reject("No encontré esa app."); return; }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { getContext().startActivity(i); call.resolve(); } catch (Exception e) { call.reject("No pude abrirla: " + e.getMessage()); }
    }

    @PluginMethod
    public void cerrarApp(PluginCall call) {
        String p = call.getString("paquete", "");
        try {
            ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
            if (am != null) am.killBackgroundProcesses(p);
            call.resolve();
        } catch (Exception e) { call.reject("Android no me dejó cerrarla."); }
    }

    // ======================================================================== linterna, volumen, alarma
    @PluginMethod
    public void linterna(PluginCall call) {
        boolean on = call.getBoolean("on", true);
        try {
            CameraManager cm = (CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
            for (String id : cm.getCameraIdList()) {
                Boolean flash = cm.getCameraCharacteristics(id).get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                if (flash != null && flash) { cm.setTorchMode(id, on); call.resolve(); return; }
            }
            call.reject("Este celular no tiene linterna.");
        } catch (Exception e) { call.reject("No pude con la linterna: " + e.getMessage()); }
    }

    @PluginMethod
    public void volumen(PluginCall call) {
        String a = call.getString("accion", "subir");
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (am == null) { call.reject("Sin control de volumen."); return; }
        try {
            int s = AudioManager.STREAM_MUSIC, fl = AudioManager.FLAG_SHOW_UI;
            switch (a) {
                case "bajar": am.adjustStreamVolume(s, AudioManager.ADJUST_LOWER, fl); am.adjustStreamVolume(s, AudioManager.ADJUST_LOWER, fl); break;
                case "silencio": am.adjustStreamVolume(s, AudioManager.ADJUST_MUTE, fl); break;
                case "sonido": am.adjustStreamVolume(s, AudioManager.ADJUST_UNMUTE, fl); break;
                case "max": am.setStreamVolume(s, am.getStreamMaxVolume(s), fl); break;
                default: am.adjustStreamVolume(s, AudioManager.ADJUST_RAISE, fl); am.adjustStreamVolume(s, AudioManager.ADJUST_RAISE, fl);
            }
            JSObject r = new JSObject(); r.put("nivel", am.getStreamVolume(s)); r.put("max", am.getStreamMaxVolume(s)); call.resolve(r);
        } catch (Exception e) { call.reject("No pude cambiar el volumen: " + e.getMessage()); }
    }

    @PluginMethod
    public void alarma(PluginCall call) {
        try {
            Intent i = new Intent(AlarmClock.ACTION_SET_ALARM)
                .putExtra(AlarmClock.EXTRA_HOUR, call.getInt("hora", 6))
                .putExtra(AlarmClock.EXTRA_MINUTES, call.getInt("minuto", 0))
                .putExtra(AlarmClock.EXTRA_MESSAGE, call.getString("texto", "Jarvis"))
                .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) { call.reject("No encontré la app del reloj para poner la alarma."); }
    }

    // ======================================================================== botones del sistema (Accesibilidad)
    @PluginMethod
    public void global(PluginCall call) {
        String a = call.getString("accion", "inicio");
        if (ControlServicio.instancia == null) {
            if (a.equals("inicio")) {                                   // ir al inicio no necesita permiso
                Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i); call.resolve(); return;
            }
            JSObject r = new JSObject(); r.put("necesitaPermiso", true); call.resolve(r); return;
        }
        boolean ok = ControlServicio.instancia.accion(a);
        JSObject r = new JSObject(); r.put("ok", ok); call.resolve(r);
    }

    @PluginMethod
    public void controlActivo(PluginCall call) { JSObject r = new JSObject(); r.put("activo", ControlServicio.instancia != null); call.resolve(r); }

    @PluginMethod
    public void abrirAccesibilidad(PluginCall call) {
        try { getContext().startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { }
        call.resolve();
    }

    // ======================================================================== la dirección en el wifi
    @PluginMethod
    public void ip(PluginCall call) {
        String mejor = "";
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (!(a instanceof Inet4Address) || a.isLoopbackAddress()) continue;
                    String ip = a.getHostAddress(), n = ni.getName();
                    if (n.startsWith("wlan") || n.startsWith("ap") || n.startsWith("swlan")) { mejor = ip; break; }
                    if (mejor.isEmpty() && (ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172."))) mejor = ip;
                }
                if (!mejor.isEmpty() && (ni.getName().startsWith("wlan") || ni.getName().startsWith("ap"))) break;
            }
        } catch (Exception ignored) { }
        JSObject r = new JSObject(); r.put("ip", mejor); call.resolve(r);
    }
}
