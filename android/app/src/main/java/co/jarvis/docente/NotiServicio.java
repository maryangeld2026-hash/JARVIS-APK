package co.jarvis.docente;

import android.app.Notification;
import android.app.RemoteInput;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Jarvis 3.7: lee los mensajes que te llegan (WhatsApp, SMS, Telegram, correo) para decírtelos en voz alta y responderlos
 * con el botón «Responder» de la notificación. Todo queda en el celular: Jarvis no guarda ni envía tus mensajes a ningún lado.
 */
public class NotiServicio extends NotificationListenerService {
    static volatile NotiServicio instancia;
    static final List<String> APPS = java.util.Arrays.asList("com.whatsapp", "com.whatsapp.w4b", "org.telegram.messenger", "org.thunderdog.challegram",
        "com.google.android.apps.messaging", "com.samsung.android.messaging", "com.android.mms", "com.google.android.gm", "com.microsoft.office.outlook",
        "com.microsoft.teams", "com.facebook.orca", "com.instagram.android", "com.google.android.apps.dynamite");

    static class Msg {
        String clave, app, paquete, de, texto; long t; Notification.Action responder; RemoteInput[] entradas;
    }
    static final LinkedHashMap<String, Msg> recientes = new LinkedHashMap<String, Msg>() {
        @Override protected boolean removeEldestEntry(Map.Entry<String, Msg> e) { return size() > 60; }
    };

    @Override public void onListenerConnected() { instancia = this; }
    @Override public void onListenerDisconnected() { instancia = null; if (tts != null) { tts.shutdown(); tts = null; } }

    // ======================================================================== 3.9: modo conducción, gastos del banco, «¿qué me perdí?»
    static class Gasto { String clave, app, texto; long t; }
    static final LinkedHashMap<String, Gasto> banco = new LinkedHashMap<String, Gasto>() {
        @Override protected boolean removeEldestEntry(Map.Entry<String, Gasto> e) { return size() > 40; }
    };
    static final java.util.regex.Pattern GASTO = java.util.regex.Pattern.compile("(?i)(compra|compraste|pago|pagaste|transferencia|transferiste|retiro|retiraste|d[eé]bito|cargo)[^$]{0,80}\\$\\s?[\\d.,]{3,}|\\$\\s?[\\d.,]{3,}[^.]{0,60}(compra|pago|transferencia|retiro)");
    private android.speech.tts.TextToSpeech tts;
    private boolean ttsListo = false;
    private android.content.SharedPreferences prefs() { return getSharedPreferences("jarvis_noti", 0); }
    private void decir(String t) {
        if (tts == null) {
            tts = new android.speech.tts.TextToSpeech(getApplicationContext(), (st) -> {
                ttsListo = st == android.speech.tts.TextToSpeech.SUCCESS;
                if (ttsListo) { tts.setLanguage(new java.util.Locale("es", "CO")); tts.speak(t, android.speech.tts.TextToSpeech.QUEUE_ADD, null, "j" + System.nanoTime()); }
            });
            return;
        }
        if (ttsListo) tts.speak(t, android.speech.tts.TextToSpeech.QUEUE_ADD, null, "j" + System.nanoTime());
    }
    private void extras(StatusBarNotification sbn, Notification n) {
        android.content.SharedPreferences p = prefs();
        Bundle x = n.extras;
        CharSequence ti = x.getCharSequence(Notification.EXTRA_TITLE), te = x.getCharSequence(Notification.EXTRA_TEXT), bt = x.getCharSequence(Notification.EXTRA_BIG_TEXT);
        String titulo = ti == null ? "" : ti.toString(), texto = (bt != null ? bt : te == null ? "" : te).toString();
        // una llamada entrante (cualquier app de teléfono): en modo conducción, «Te llama …»
        if (Notification.CATEGORY_CALL.equals(n.category) && p.getBoolean("conduccion", false) && !titulo.isEmpty() && (n.flags & Notification.FLAG_ONGOING_EVENT) != 0 && n.fullScreenIntent != null) {
            long ult = p.getLong("llamadaT", 0);
            if (System.currentTimeMillis() - ult > 8000) { p.edit().putLong("llamadaT", System.currentTimeMillis()).apply(); decir("Te llama " + titulo); }
            return;
        }
        // gastos que avisa el banco (por SMS o en su app): quedan en el celular para que Jarvis los anote
        if (p.getBoolean("gastosAuto", false) && !getPackageName().equals(sbn.getPackageName()) && GASTO.matcher(texto).find()) {
            Gasto g = new Gasto(); g.app = etiqueta(sbn.getPackageName()); g.texto = (titulo.isEmpty() ? "" : titulo + ": ") + texto; g.t = sbn.getPostTime(); g.clave = sbn.getKey() + "|" + texto.hashCode();
            synchronized (banco) { banco.put(g.clave, g); }
        }
    }
    // ======================================================================== 3.11: estafas y respuestas automáticas
    /** Qué tanto parece una estafa (0 = nada). Reglas comunes en Colombia: bloqueo de cuenta, premios, links raros, pedir claves o plata. */
    static int estafa(String texto) {
        String t = java.text.Normalizer.normalize(texto == null ? "" : texto, java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase();
        int s = 0;
        boolean link = t.matches("(?s).*(https?://|www\\.|bit\\.ly|tinyurl|cutt\\.ly|t\\.co/|is\\.gd|ow\\.ly|rb\\.gy|wa\\.me/).*");
        boolean corto = t.matches("(?s).*(bit\\.ly|tinyurl|cutt\\.ly|is\\.gd|ow\\.ly|rb\\.gy|shorturl).*");
        if (t.matches("(?s).*(cuenta|tarjeta|usuario|clave).{0,40}(bloquead|suspendid|inactivad|desactivad|cancelad|vencid).*")) s += 2;
        if (t.matches("(?s).*(ganaste|has ganado|ha ganado|ganador|premio|sorteo|bono de|subsidio aprobado|reclama tu|reclamar su).*")) s += 2;
        if (t.matches("(?s).*(verifi(ca|que)|actualiz(a|e)|confirm(a|e)|valid(a|e)).{0,30}(datos|cuenta|informacion|identidad|clave).*")) s += 2;
        if (t.matches("(?s).*(codigo de verificacion|codigo que te llego|clave dinamica|token|pin|contrasena).{0,60}(envia|enviame|dime|pasame|comparte|reenvia).*") || t.matches("(?s).*(envia|enviame|dime|pasame|comparte|reenvia).{0,40}(codigo|clave dinamica|pin|contrasena).*")) s += 3;
        if (t.matches("(?s).*(urgente|inmediatamente|en las proximas 24 horas|hoy mismo|ultimo aviso|evite el bloqueo).*")) s += 1;
        if (t.matches("(?s).*(soy tu hijo|soy tu hija|cambie de numero|nuevo numero|me robaron el celular).{0,80}(consign|transfier|nequi|daviplata|plata|prestame|presta).*")) s += 4;
        if (t.matches("(?s).*(premio|bono|ganaste|ganador|sorteo).{0,80}(https?|link|enlace|aqui|ingresa).*")) s += 1;
        if (t.matches("(?s).*(consigna|transfiere|envia|deposita).{0,30}(\\$|\\d{2,3}\\.\\d{3}|mil|nequi|daviplata).*") && !t.contains("te consigno")) s += 1;
        if (link) s += 1; if (corto) s += 2;
        if (t.matches("(?s).*(dian|policia|fiscalia|juzgado|embargo|comparendo|multa).{0,60}(pague|link|ingrese|consulte aqui).*")) s += 2;
        return s;
    }
    private final java.util.Map<String, Long> autoUltimo = new java.util.HashMap<>();
    private void revisar(Msg m) {
        android.content.SharedPreferences p = prefs();
        if (p.getBoolean("estafas", true)) {
            int e = estafa(m.texto);
            if (e >= 3) {
                android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                if (nm != null) {
                    if (android.os.Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new android.app.NotificationChannel("jarvis_estafa", "Posibles estafas", android.app.NotificationManager.IMPORTANCE_HIGH));
                    Notification.Builder b = android.os.Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, "jarvis_estafa") : new Notification.Builder(this);
                    String t = "El mensaje de " + m.de + " (" + m.app + ") tiene señales de estafa: no abras links, no des códigos ni claves y no consignes. Si dice ser de tu banco, llama tú al número oficial.";
                    b.setSmallIcon(R.mipmap.ic_launcher_foreground).setContentTitle("⚠️ Cuidado: posible estafa").setContentText(t).setStyle(new Notification.BigTextStyle().bigText(t)).setAutoCancel(true);
                    try { nm.notify(("e" + m.clave).hashCode(), b.build()); } catch (Exception ignored) { }
                }
            }
        }
        if (p.getBoolean("autoResp", false) && m.responder != null) {
            long hasta = p.getLong("autoHasta", 0), ahora = System.currentTimeMillis();
            if (hasta != 0 && ahora > hasta) { p.edit().putBoolean("autoResp", false).apply(); return; }
            boolean grupo = m.de.contains(":") || m.de.matches(".*\\(\\d+ mensajes\\).*");
            String chat = m.paquete + "|" + m.de;
            Long u = autoUltimo.get(chat);
            if (!grupo && (u == null || ahora - u > 30 * 60000L) && estafa(m.texto) < 3) {
                autoUltimo.put(chat, ahora);
                responder(this, m, p.getString("autoTexto", "Ahora no puedo contestar; te escribo en un rato. (Respuesta automática de Jarvis)"));
            }
        }
    }
    static boolean responder(android.content.Context c, Msg m, String texto) {
        if (m == null || m.responder == null) return false;
        try {
            android.content.Intent i = new android.content.Intent(); Bundle b = new Bundle();
            for (RemoteInput ri : m.entradas) b.putCharSequence(ri.getResultKey(), texto);
            RemoteInput.addResultsToIntent(m.entradas, i, b);
            m.responder.actionIntent.send(c, 0, i);
            return true;
        } catch (Exception e) { return false; }
    }

    static List<Gasto> gastos(long desde) {
        List<Gasto> out = new ArrayList<>();
        synchronized (banco) { for (Gasto g : banco.values()) if (g.t >= desde) out.add(g); }
        return out;
    }
    /** Todas las notificaciones que tienes ahora (menos las fijas y las de Jarvis), para «¿qué me perdí?». */
    List<String[]> activas() {
        List<String[]> out = new ArrayList<>();
        try {
            for (StatusBarNotification sbn : getActiveNotifications()) {
                Notification n = sbn.getNotification();
                if ((n.flags & Notification.FLAG_ONGOING_EVENT) != 0 || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0 || getPackageName().equals(sbn.getPackageName())) continue;
                CharSequence ti = n.extras.getCharSequence(Notification.EXTRA_TITLE), te = n.extras.getCharSequence(Notification.EXTRA_TEXT);
                if (ti == null && te == null) continue;
                out.add(new String[] { etiqueta(sbn.getPackageName()), ti == null ? "" : ti.toString(), te == null ? "" : te.toString(), String.valueOf(sbn.getPostTime()) });
            }
        } catch (Exception ignored) { }
        return out;
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (Apagado.es(this)) return;                                          // 3.16: Jarvis apagado no lee ni responde nada
        try {
            try { extras(sbn, sbn.getNotification()); } catch (Exception ignored) { }
            if (!APPS.contains(sbn.getPackageName())) return;
            Notification n = sbn.getNotification();
            if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0 || (n.flags & Notification.FLAG_ONGOING_EVENT) != 0) return;
            Bundle x = n.extras;
            CharSequence titulo = x.getCharSequence(Notification.EXTRA_TITLE), texto = x.getCharSequence(Notification.EXTRA_TEXT);
            CharSequence grande = x.getCharSequence(Notification.EXTRA_BIG_TEXT);
            // los chats traen la lista de mensajes: se toma el último
            Parcelable[] ms = x.getParcelableArray(Notification.EXTRA_MESSAGES);
            if (ms != null && ms.length > 0 && ms[ms.length - 1] instanceof Bundle) {
                Bundle ult = (Bundle) ms[ms.length - 1];
                CharSequence t = ult.getCharSequence("text"); if (t != null) texto = t;
            } else if (grande != null) texto = grande;
            if (titulo == null || texto == null) return;
            String tx = texto.toString().trim();
            if (tx.isEmpty() || tx.matches("^\\d+ (?:mensajes|messages) nuevos?.*")) return;
            Msg m = new Msg();
            m.paquete = sbn.getPackageName(); m.app = etiqueta(m.paquete); m.de = titulo.toString(); m.texto = tx; m.t = sbn.getPostTime();
            m.clave = sbn.getKey() + "|" + m.t;
            if (n.actions != null) for (Notification.Action a : n.actions) {
                RemoteInput[] ri = a.getRemoteInputs();
                if (ri != null && ri.length > 0) { m.responder = a; m.entradas = ri; break; }
            }
            synchronized (recientes) {
                // si el mismo chat manda otro, se reemplaza el anterior de ese chat por el más nuevo (con su botón de responder)
                Iterator<Map.Entry<String, Msg>> it = recientes.entrySet().iterator();
                while (it.hasNext()) { Msg o = it.next().getValue(); if (o.paquete.equals(m.paquete) && o.de.equals(m.de) && o.texto.equals(m.texto)) it.remove(); }
                recientes.put(m.clave, m);
            }
            try { revisar(m); } catch (Exception ignored) { }          // 3.11: estafas y respuestas automáticas
            if (prefs().getBoolean("archivar", false)) Archivo.guardar(this, m.app, m.de, m.texto, m.t);   // 3.18: memoria de tus mensajes (opcional, solo en el celular)
            // 3.9: modo conducción — si Jarvis está en pantalla, él te lo lee y te pregunta si respondes; si no, lo lee Android
            if (prefs().getBoolean("conduccion", false)) {
                if (MainActivity.visible && MensajesPlugin.llego(m)) { /* lo maneja Jarvis */ }
                else decir("Mensaje de " + m.de + " por " + m.app + ": " + (m.texto.length() > 220 ? m.texto.substring(0, 220) : m.texto));
            } else MensajesPlugin.llego(m);
        } catch (Exception ignored) { }
    }

    private String etiqueta(String p) {
        try { PackageManager pm = getPackageManager(); ApplicationInfo ai = pm.getApplicationInfo(p, 0); return String.valueOf(pm.getApplicationLabel(ai)); }
        catch (Exception e) { return p; }
    }

    static List<Msg> lista(long desde) {
        List<Msg> out = new ArrayList<>();
        synchronized (recientes) { for (Msg m : recientes.values()) if (m.t >= desde) out.add(m); }
        return out;
    }

    static Msg buscar(String clave) { synchronized (recientes) { return recientes.get(clave); } }
}
