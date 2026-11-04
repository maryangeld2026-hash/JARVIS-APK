package co.jarvis.docente;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Telephony;
import android.telephony.SmsManager;
import android.telephony.SmsMessage;

import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

/**
 * 3.10: encontrar el celular. Si te llega un SMS que dice «Jarvis <tu clave>» (la escoges tú en Ajustes), el celular suena
 * fuerte como una alarma aunque esté en silencio, y le responde a quien escribió con la ubicación. Sin la clave, no hace nada.
 * Android avisa cada SMS: Jarvis no queda despierto esperando.
 */
public class SmsReceiver extends BroadcastReceiver {
    @SuppressLint("MissingPermission")
    @Override
    public void onReceive(Context c, Intent i) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(i.getAction())) return;
        SharedPreferences p = c.getSharedPreferences("jarvis_buscar", 0);
        String clave = p.getString("clave", "");
        if (!p.getBoolean("on", false) || clave.length() < 4) return;
        SmsMessage[] ms = Telephony.Sms.Intents.getMessagesFromIntent(i);
        if (ms == null || ms.length == 0) return;
        StringBuilder b = new StringBuilder(); for (SmsMessage m : ms) if (m != null && m.getMessageBody() != null) b.append(m.getMessageBody());
        String cuerpo = java.text.Normalizer.normalize(b.toString(), java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase().trim();
        String esperado = "jarvis " + java.text.Normalizer.normalize(clave, java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase().trim();
        if (!cuerpo.equals(esperado)) return;
        final String de = ms[0].getOriginatingAddress();
        sonar(c);
        if (de == null || !p.getBoolean("responder", true)) return;
        final PendingResult pr = goAsync();
        try {
            LocationServices.getFusedLocationProviderClient(c).getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null)
                .addOnCompleteListener((t) -> {
                    android.location.Location l = t.isSuccessful() ? t.getResult() : null;
                    String txt = l != null ? "Jarvis: el celular está aquí: https://maps.google.com/?q=" + l.getLatitude() + "," + l.getLongitude() + " (±" + Math.round(l.getAccuracy()) + " m). Está sonando."
                        : "Jarvis: el celular está sonando, pero no pude saber dónde está (la ubicación está apagada).";
                    try { SmsManager sm = Build.VERSION.SDK_INT >= 31 ? c.getSystemService(SmsManager.class) : SmsManager.getDefault(); sm.sendTextMessage(de, null, txt, null, null); } catch (Exception ignored) { }
                    pr.finish();
                });
        } catch (Exception e) { pr.finish(); }
    }

    static void sonar(Context c) {
        try { AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE); am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0); } catch (Exception ignored) { }
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE); if (nm == null) return;
        Uri u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM); if (u == null) u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel("jarvis_buscar", "Encontrar el celular", NotificationManager.IMPORTANCE_HIGH);
            ch.setSound(u, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            ch.enableVibration(true); ch.setVibrationPattern(new long[] { 0, 800, 400, 800, 400, 800 }); ch.setBypassDnd(true);
            nm.createNotificationChannel(ch);
        }
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent abrir = PendingIntent.getActivity(c, 41, new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), fl);
        Notification.Builder nb = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, "jarvis_buscar") : new Notification.Builder(c);
        nb.setSmallIcon(R.mipmap.ic_launcher_foreground).setContentTitle("📍 ¡Aquí estoy! Te están buscando").setContentText("Toca para que deje de sonar.")
            .setAutoCancel(true).setContentIntent(abrir).setFullScreenIntent(abrir, true).setCategory(Notification.CATEGORY_ALARM);
        if (Build.VERSION.SDK_INT < 26) nb.setSound(u, AudioManager.STREAM_ALARM).setPriority(Notification.PRIORITY_MAX);
        Notification n = nb.build(); n.flags |= Notification.FLAG_INSISTENT;
        try { nm.notify(4141, n); } catch (Exception ignored) { }
    }
}
