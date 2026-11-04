package co.jarvis.docente;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Jarvis 3.9: disparadores automáticos. Cuando pasa algo (conectas un Bluetooth, pones a cargar, llegas a un lugar),
 * Jarvis hace una de tus habilidades. Android avisa esos eventos: Jarvis no queda despierto esperando.
 * Las reglas vienen de la app: SharedPreferences «jarvis_disparadores» → «reglas»: [{tipo, dispositivo, frase}].
 */
final class Disparo {
    private Disparo() { }

    static JSONArray reglas(Context c) {
        try { return new JSONArray(c.getSharedPreferences("jarvis_disparadores", 0).getString("reglas", "[]")); } catch (Exception e) { return new JSONArray(); }
    }

    /** tipo: bt_on, bt_off, carga_on, carga_off. dispositivo: el nombre del Bluetooth (o vacío). */
    static void evento(Context c, String tipo, String dispositivo) {
        JSONArray r = reglas(c);
        for (int k = 0; k < r.length(); k++) {
            JSONObject o = r.optJSONObject(k); if (o == null || !tipo.equals(o.optString("tipo"))) continue;
            String d = o.optString("dispositivo", "");
            if (!d.isEmpty() && (dispositivo == null || !dispositivo.toLowerCase().contains(d.toLowerCase()))) continue;
            lanzar(c, o.optString("frase", ""), motivo(tipo, dispositivo));
        }
    }

    static String motivo(String tipo, String d) {
        String n = d == null || d.isEmpty() ? "" : " «" + d + "»";
        switch (tipo) {
            case "bt_on": return "Se conectó el Bluetooth" + n;
            case "bt_off": return "Se desconectó el Bluetooth" + n;
            case "carga_on": return "Pusiste a cargar el celular";
            case "carga_off": return "Desconectaste el cargador";
            default: return "Llegaste al lugar";
        }
    }

    /** Abre Jarvis con la orden (si puede mostrarse sobre otras apps); si no, deja un aviso para tocar. */
    static void lanzar(Context c, String frase, String motivo) {
        if (frase == null || frase.trim().isEmpty()) return;
        Intent abrir = new Intent(c, MainActivity.class).putExtra("atajo", "orden:" + frase)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        boolean puede = Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(c);
        if (puede && c.getSharedPreferences("jarvis_disparadores", 0).getBoolean("abrir", true)) {
            try { c.startActivity(abrir); return; } catch (Exception ignored) { }
        }
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel("jarvis_disparo", "Disparadores automáticos", NotificationManager.IMPORTANCE_HIGH));
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, "jarvis_disparo") : new Notification.Builder(c);
        b.setSmallIcon(R.mipmap.ic_launcher_foreground).setContentTitle("▶ Jarvis: " + frase).setContentText(motivo + ". Toca para hacerlo.")
            .setAutoCancel(true).setContentIntent(PendingIntent.getActivity(c, frase.hashCode(), abrir, fl));
        try { nm.notify(("d" + frase).hashCode(), b.build()); } catch (Exception ignored) { }
    }

    /** ¿Hay reglas de este tipo? */
    static boolean hay(Context c, String prefijo) {
        JSONArray r = reglas(c);
        for (int k = 0; k < r.length(); k++) { JSONObject o = r.optJSONObject(k); if (o != null && o.optString("tipo").startsWith(prefijo)) return true; }
        return false;
    }
}
