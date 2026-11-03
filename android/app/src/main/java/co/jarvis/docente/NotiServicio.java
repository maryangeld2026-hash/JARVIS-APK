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
    @Override public void onListenerDisconnected() { instancia = null; }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
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
