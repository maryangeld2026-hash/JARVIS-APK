package co.jarvis.docente;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Jarvis: la burbuja flotante. Un círculo con el ícono de Jarvis sobre las otras apps; al tocarlo se abre Jarvis
 * y la app recibe el evento «toque» para ponerse a escuchar. Necesita el permiso «Mostrar sobre otras apps».
 */
@CapacitorPlugin(name = "Burbuja")
public class BurbujaPlugin extends Plugin {

    static final String EXTRA_TOQUE = "jarvis_burbuja_toque";
    private static BurbujaPlugin instancia;
    private static boolean toquePendiente = false;

    @Override
    public void load() {
        instancia = this;
        if (toquePendiente) {
            toquePendiente = false;
            notifyListeners("toque", new JSObject(), true);
        }
    }

    /** La actividad llama esto al abrirse: si fue por la burbuja, avisa a la app. */
    static void revisarToque(Intent intent) {
        if (intent == null || !intent.getBooleanExtra(EXTRA_TOQUE, false)) return;
        intent.removeExtra(EXTRA_TOQUE);
        if (instancia != null) instancia.notifyListeners("toque", new JSObject(), true);
        else toquePendiente = true;
    }

    private boolean puede() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(getContext());
    }

    @PluginMethod
    public void permitido(PluginCall call) {
        JSObject r = new JSObject();
        r.put("permitido", puede());
        call.resolve(r);
    }

    @PluginMethod
    public void pedirPermiso(PluginCall call) {
        if (!puede()) {
            Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    @PluginMethod
    public void mostrar(PluginCall call) {
        if (!puede()) {
            call.reject("Falta el permiso «Mostrar sobre otras apps».");
            return;
        }
        Intent i = new Intent(getContext(), BurbujaService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(i);
        else getContext().startService(i);
        call.resolve();
    }

    /** El estado de Jarvis en la burbuja (color del aro) y, si hay texto, un globo con la respuesta por unos segundos. */
    @PluginMethod
    public void estado(PluginCall call) {
        if (BurbujaService.vivo) {
            Intent i = new Intent(getContext(), BurbujaService.class).setAction(BurbujaService.ACCION_ESTADO)
                .putExtra("modo", call.getString("modo", "idle")).putExtra("texto", call.getString("texto", ""));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(i); else getContext().startService(i);
        }
        call.resolve();
    }

    @PluginMethod
    public void ocultar(PluginCall call) {
        getContext().stopService(new Intent(getContext(), BurbujaService.class));
        call.resolve();
    }
}
