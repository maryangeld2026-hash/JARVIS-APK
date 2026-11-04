package co.jarvis.docente;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

/** 3.10: el botón «Jarvis» en los Ajustes rápidos (la cortina): lo tocas desde cualquier pantalla y Jarvis te escucha. */
public class JarvisTile extends TileService {
    @Override
    public void onStartListening() {
        Tile t = getQsTile(); if (t == null) return;
        t.setState(Tile.STATE_INACTIVE); t.setLabel("Jarvis");
        if (Build.VERSION.SDK_INT >= 29) t.setSubtitle("Háblame");
        t.updateTile();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onClick() {
        ControlServicio.capturar();
        Intent i = new Intent(this, MainActivity.class).putExtra("atajo", "hablar").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (Build.VERSION.SDK_INT >= 34) startActivityAndCollapse(PendingIntent.getActivity(this, 31, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        else startActivityAndCollapse(i);
    }
}
