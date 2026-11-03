package co.jarvis.docente;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;

/** Llegaste (o saliste) del lugar: Jarvis te muestra el recordatorio, y deja de vigilar ese lugar. */
public class LugarReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        GeofencingEvent ev = GeofencingEvent.fromIntent(i);
        if (ev == null || ev.hasError() || ev.getTriggeringGeofences() == null) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel("jarvis_lugar", "Recordatorios por lugar", NotificationManager.IMPORTANCE_HIGH));
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        for (Geofence g : ev.getTriggeringGeofences()) {
            String id = g.getRequestId(), t = c.getSharedPreferences("jarvis_lugares", 0).getString(id, "Recordatorio");
            Intent abrir = new Intent(c, MainActivity.class).putExtra("atajo", "lugar:" + id).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, "jarvis_lugar") : new Notification.Builder(c);
            b.setSmallIcon(R.mipmap.ic_launcher_foreground).setContentTitle("📍 Jarvis te recuerda").setContentText(t)
                .setStyle(new Notification.BigTextStyle().bigText(t)).setAutoCancel(true)
                .setContentIntent(PendingIntent.getActivity(c, id.hashCode(), abrir, fl));
            try { nm.notify(id.hashCode(), b.build()); } catch (Exception ignored) { }
            c.getSharedPreferences("jarvis_lugares", 0).edit().remove(id).apply();
            com.google.android.gms.location.LocationServices.getGeofencingClient(c).removeGeofences(java.util.Collections.singletonList(id));
        }
    }
}
