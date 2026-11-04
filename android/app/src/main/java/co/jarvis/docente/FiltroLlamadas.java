package co.jarvis.docente;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.ContactsContract;
import android.telecom.Call;
import android.telecom.CallScreeningService;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * 3.11: filtro de llamadas. Android le pregunta a Jarvis por cada llamada que entra (solo si le diste ese papel):
 * las de números de tu lista negra se bloquean; las de números que no están en tus contactos se silencian o se bloquean,
 * según escojas. Tus contactos siempre suenan. Nada queda corriendo: Android lo llama solo cuando entra una llamada.
 */
public class FiltroLlamadas extends CallScreeningService {
    @Override
    public void onScreenCall(Call.Details d) {
        CallResponse.Builder r = new CallResponse.Builder();
        try {
            if (Build.VERSION.SDK_INT >= 29 && d.getCallDirection() != Call.Details.DIRECTION_INCOMING) { respondToCall(d, r.build()); return; }
            SharedPreferences p = getSharedPreferences("jarvis_llamadas", 0);
            String modo = p.getString("modo", "off");
            Uri h = d.getHandle(); String num = h == null ? "" : h.getSchemeSpecificPart();
            String limpio = num.replaceAll("[^0-9]", "");
            boolean negra = false;
            for (String x : p.getString("negra", "").split("[,;\\s]+")) { String y = x.replaceAll("[^0-9]", ""); if (y.length() >= 5 && limpio.endsWith(y)) negra = true; }
            boolean contacto = !limpio.isEmpty() && esContacto(num);
            boolean oculto = limpio.isEmpty();
            String que = "pasa";
            if (negra) que = "bloquear";
            else if (!contacto && "bloquear".equals(modo)) que = "bloquear";
            else if (!contacto && "silenciar".equals(modo)) que = "silenciar";
            else if (oculto && !"off".equals(modo)) que = "silenciar";
            if ("bloquear".equals(que)) r.setDisallowCall(true).setRejectCall(true).setSkipNotification(false).setSkipCallLog(false);
            else if ("silenciar".equals(que) && Build.VERSION.SDK_INT >= 29) r.setSilenceCall(true);
            respondToCall(d, r.build());
            if (!"pasa".equals(que)) { guardar(p, num, que); avisar(num, que); }
        } catch (Exception e) { try { respondToCall(d, new CallResponse.Builder().build()); } catch (Exception ignored) { } }
    }

    private boolean esContacto(String num) {
        try (Cursor k = getContentResolver().query(Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(num)), new String[] { ContactsContract.PhoneLookup._ID }, null, null, null)) {
            return k != null && k.moveToFirst();
        } catch (Exception e) { return true; }                           // sin permiso de contactos: no se arriesga a silenciar a alguien conocido
    }

    private void guardar(SharedPreferences p, String num, String que) {
        try {
            JSONArray l = new JSONArray(p.getString("log", "[]")), n = new JSONArray();
            JSONObject o = new JSONObject(); o.put("numero", num); o.put("que", que); o.put("t", System.currentTimeMillis()); n.put(o);
            for (int k = 0; k < l.length() && k < 29; k++) n.put(l.get(k));
            p.edit().putString("log", n.toString()).apply();
        } catch (Exception ignored) { }
    }

    private void avisar(String num, String que) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE); if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel("jarvis_llamadas", "Llamadas filtradas", NotificationManager.IMPORTANCE_LOW));
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, "jarvis_llamadas") : new Notification.Builder(this);
        b.setSmallIcon(R.mipmap.ic_launcher_foreground).setContentTitle(("bloquear".equals(que) ? "⛔ Bloqueé" : "🔕 Silencié") + " una llamada").setContentText(num.isEmpty() ? "Número oculto" : num).setAutoCancel(true);
        try { nm.notify(("ll" + num).hashCode(), b.build()); } catch (Exception ignored) { }
    }
}
