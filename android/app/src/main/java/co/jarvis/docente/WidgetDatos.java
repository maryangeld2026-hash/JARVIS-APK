package co.jarvis.docente;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.widget.RemoteViews;

/** 3.11: el widget a la carta («crea un widget con mis pagos del mes»): Jarvis le pone el título y las líneas. */
public class WidgetDatos extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) m.updateAppWidget(id, vista(c)); }

    static RemoteViews vista(Context c) {
        SharedPreferences sp = c.getSharedPreferences("jarvis_widget2", Context.MODE_PRIVATE);
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_datos);
        v.setTextViewText(R.id.wd_titulo, sp.getString("titulo", "Jarvis"));
        v.setTextViewText(R.id.wd_texto, sp.getString("texto", "Pídele a Jarvis: «crea un widget con mis pagos del mes»."));
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        String cmd = sp.getString("cmd", "");
        Intent abrir = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (!cmd.isEmpty()) abrir.putExtra("atajo", "orden:" + cmd);
        v.setOnClickPendingIntent(R.id.wd_raiz, PendingIntent.getActivity(c, 52, abrir, fl));
        return v;
    }

    static void actualizar(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, WidgetDatos.class));
        if (ids != null) for (int id : ids) m.updateAppWidget(id, vista(c));
    }

    /** → true si Android mostró el diálogo para ponerlo en la pantalla de inicio. */
    static boolean fijar(Context c) {
        if (Build.VERSION.SDK_INT < 26) return false;
        AppWidgetManager m = c.getSystemService(AppWidgetManager.class);
        if (m == null || !m.isRequestPinAppWidgetSupported()) return false;
        int[] ids = m.getAppWidgetIds(new ComponentName(c, WidgetDatos.class));
        if (ids != null && ids.length > 0) return false;
        return m.requestPinAppWidget(new ComponentName(c, WidgetDatos.class), null, null);
    }
}
