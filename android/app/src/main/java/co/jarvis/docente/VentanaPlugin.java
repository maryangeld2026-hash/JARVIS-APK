package co.jarvis.docente;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Jarvis 3.2: minimizar (la app sigue abierta detrás) o salir del todo. */
@CapacitorPlugin(name = "Ventana")
public class VentanaPlugin extends Plugin {
    @PluginMethod
    public void minimizar(PluginCall call) {
        getActivity().runOnUiThread(() -> getActivity().moveTaskToBack(true));
        call.resolve();
    }

    @PluginMethod
    public void salir(PluginCall call) {
        call.resolve();
        getActivity().runOnUiThread(() -> getActivity().finishAndRemoveTask());
    }
}
