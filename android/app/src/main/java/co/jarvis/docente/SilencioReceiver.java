package co.jarvis.docente;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Jarvis 3.4: «No molestar» solo en horario de clase. Las clases de los próximos días se guardan y, al empezar cada una,
 * el celular se silencia (deja pasar alarmas y lo que tengas como prioritario); al terminar, vuelve a sonar.
 * Si «No molestar» ya estaba puesto por ti, Jarvis no lo toca.
 */
public class SilencioReceiver extends BroadcastReceiver {
    static final String ACCION = "co.jarvis.docente.SILENCIO";

    @Override
    public void onReceive(Context c, Intent i) {
        String a = i.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || "android.intent.action.MY_PACKAGE_REPLACED".equals(a)) { programar(c); return; }
        if (!ACCION.equals(a)) return;
        boolean entrar = i.getBooleanExtra("entrar", false);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        SharedPreferences sp = c.getSharedPreferences("jarvis_silencio", Context.MODE_PRIVATE);
        if (nm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && nm.isNotificationPolicyAccessGranted()) {
            try {
                int actual = nm.getCurrentInterruptionFilter();
                if (entrar) {
                    if (actual == NotificationManager.INTERRUPTION_FILTER_ALL) { nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY); sp.edit().putBoolean("puseYo", true).apply(); }
                } else if (sp.getBoolean("puseYo", false)) {
                    nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL);
                    sp.edit().putBoolean("puseYo", false).apply();
                }
            } catch (Exception ignored) { }
        }
        programar(c);
    }

    /** Programa la siguiente entrada o salida de clase. */
    static void programar(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        Intent base = new Intent(c, SilencioReceiver.class).setAction(ACCION);
        PendingIntent viejo = PendingIntent.getBroadcast(c, 50, base, fl);
        am.cancel(viejo);
        long ahora = System.currentTimeMillis(), cuando = Long.MAX_VALUE;
        boolean entrar = false;
        try {
            JSONArray b = new JSONArray(c.getSharedPreferences("jarvis_silencio", Context.MODE_PRIVATE).getString("bloques", "[]"));
            for (int k = 0; k < b.length(); k++) {
                JSONObject o = b.getJSONObject(k);
                long ini = o.getLong("ini"), fin = o.getLong("fin");
                if (ini > ahora && ini < cuando) { cuando = ini; entrar = true; }
                if (fin > ahora && fin < cuando) { cuando = fin; entrar = false; }
            }
        } catch (Exception ignored) { }
        if (cuando == Long.MAX_VALUE) return;
        Intent i = new Intent(c, SilencioReceiver.class).setAction(ACCION).putExtra("entrar", entrar);
        PendingIntent pi = PendingIntent.getBroadcast(c, 50, i, fl);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, pi);
            else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, pi);
            else am.setExact(AlarmManager.RTC_WAKEUP, cuando, pi);
        } catch (SecurityException e) { am.set(AlarmManager.RTC_WAKEUP, cuando, pi); }
    }
}
