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

/** Jarvis 3.4: el widget de la pantalla de inicio. Muestra tu próxima clase y abre Jarvis escuchando. */
public class JarvisWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, vista(c));
    }

    static RemoteViews vista(Context c) {
        SharedPreferences sp = c.getSharedPreferences("jarvis_widget", Context.MODE_PRIVATE);
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_jarvis);
        v.setTextViewText(R.id.w_titulo, sp.getString("titulo", "Jarvis"));
        v.setTextViewText(R.id.w_sub, sp.getString("sub", "Toca el micrófono para hablarme"));
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        Intent hablar = new Intent(c, MainActivity.class).putExtra("atajo", "hablar").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        Intent abrir = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        v.setOnClickPendingIntent(R.id.w_mic, PendingIntent.getActivity(c, 40, hablar, fl));
        v.setOnClickPendingIntent(R.id.w_texto, PendingIntent.getActivity(c, 41, abrir, fl));
        return v;
    }

    static void actualizarTodos(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, JarvisWidget.class));
        if (ids != null && ids.length > 0) for (int id : ids) m.updateAppWidget(id, vista(c));
    }
}
