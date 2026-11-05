package co.jarvis.docente;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.RemoteInput;
import android.content.Context;
import android.content.Intent;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Jarvis 3.18: Jarvis en el reloj y en los audífonos.
 *  · Reloj: un aviso de Jarvis con «Preguntar» (respuesta por voz o con frases rápidas). Los relojes con Wear OS, Galaxy Watch y
 *    otros que permiten responder avisos lo muestran: le hablas al reloj y la respuesta llega al reloj (y suena en los audífonos).
 *    activar({on}) · responder({pregunta, texto}) · evento «pregunta» {texto}
 *  · Audífonos: avisa cuando se conectan o desconectan (Bluetooth o cable): estado() → {audifonos, nombre} · evento «audifonos»
 */
@CapacitorPlugin(name = "Reloj")
public class RelojPlugin extends Plugin {
    static final String CANAL = "jarvis_reloj", CLAVE = "pregunta";
    static final int ID = 76;
    static volatile RelojPlugin instancia;
    private AudioDeviceCallback cb;

    @Override
    public void load() {
        instancia = this;
        if (Build.VERSION.SDK_INT >= 23) {
            AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            cb = new AudioDeviceCallback() {
                @Override public void onAudioDevicesAdded(AudioDeviceInfo[] d) { avisar(); }
                @Override public void onAudioDevicesRemoved(AudioDeviceInfo[] d) { avisar(); }
            };
            try { am.registerAudioDeviceCallback(cb, null); } catch (Exception ignored) { }
        }
        // preguntas que llegaron desde el reloj mientras Jarvis estaba cerrado
        String p = getContext().getSharedPreferences("jarvis_reloj", 0).getString("pendiente", "");
        if (!p.isEmpty()) getContext().getSharedPreferences("jarvis_reloj", 0).edit().remove("pendiente").apply();
        pendienteAlCargar = p;
    }
    static String pendienteAlCargar = "";

    private JSObject audio() {
        JSObject r = new JSObject(); boolean hay = false; String nombre = "";
        if (Build.VERSION.SDK_INT >= 23) {
            AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            for (AudioDeviceInfo d : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
                int t = d.getType();
                if (t == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || t == AudioDeviceInfo.TYPE_BLUETOOTH_SCO || t == AudioDeviceInfo.TYPE_WIRED_HEADPHONES || t == AudioDeviceInfo.TYPE_WIRED_HEADSET
                    || (Build.VERSION.SDK_INT >= 26 && t == AudioDeviceInfo.TYPE_USB_HEADSET) || (Build.VERSION.SDK_INT >= 31 && (t == AudioDeviceInfo.TYPE_BLE_HEADSET))) {
                    hay = true; if (d.getProductName() != null) nombre = d.getProductName().toString();
                }
            }
        }
        r.put("audifonos", hay); r.put("nombre", nombre);
        return r;
    }
    private void avisar() { notifyListeners("audifonos", audio()); }

    @PluginMethod
    public void estado(PluginCall call) {
        JSObject r = audio(); r.put("pendiente", pendienteAlCargar); pendienteAlCargar = "";
        call.resolve(r);
    }

    static void aviso(Context c, String titulo, String texto) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) { NotificationChannel ch = new NotificationChannel(CANAL, "Jarvis en el reloj", NotificationManager.IMPORTANCE_DEFAULT); ch.setSound(null, null); ch.enableVibration(true); nm.createNotificationChannel(ch); }
        int flMut = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        PendingIntent pr = PendingIntent.getBroadcast(c, 61, new Intent(c, RelojReceiver.class), flMut);
        RemoteInput ri = new RemoteInput.Builder(CLAVE).setLabel("Pregúntale a Jarvis")
            .setChoices(new CharSequence[] { "¿Qué tengo hoy?", "¿Cómo está el clima?", "Pon 10 minutos", "¿Qué me escribieron?" }).build();
        Notification.Action a = new Notification.Action.Builder(null, "🎙️ Preguntar", pr).addRemoteInput(ri).build();
        PendingIntent abrir = PendingIntent.getActivity(c, 62, new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CANAL) : new Notification.Builder(c);
        b.setSmallIcon(R.mipmap.ic_launcher_foreground).setContentTitle(titulo).setContentText(texto).setStyle(new Notification.BigTextStyle().bigText(texto))
            .setContentIntent(abrir).addAction(a).setOnlyAlertOnce(false).setAutoCancel(false).setCategory(Notification.CATEGORY_MESSAGE);
        nm.notify(ID, b.build());
    }

    @PluginMethod
    public void activar(PluginCall call) {
        Context c = getContext();
        if (Boolean.TRUE.equals(call.getBoolean("on", true))) aviso(c, "Jarvis", "Toca «Preguntar» en el reloj o aquí y háblale.");
        else { NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE); if (nm != null) nm.cancel(ID); }
        call.resolve();
    }

    @PluginMethod
    public void responder(PluginCall call) {
        String p = call.getString("pregunta", ""), t = call.getString("texto", "");
        aviso(getContext(), p.isEmpty() ? "Jarvis" : "«" + (p.length() > 60 ? p.substring(0, 60) + "…" : p) + "»", t.length() > 900 ? t.substring(0, 900) + "…" : t);
        call.resolve();
    }

    void pregunta(String t) { JSObject o = new JSObject(); o.put("texto", t); notifyListeners("pregunta", o, true); }

    @Override
    protected void handleOnDestroy() {
        instancia = null;
        if (cb != null && Build.VERSION.SDK_INT >= 23) { try { ((AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE)).unregisterAudioDeviceCallback(cb); } catch (Exception ignored) { } }
    }
}
