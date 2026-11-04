package co.jarvis.docente;

import android.Manifest;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * 3.9: disparadores automáticos.
 *   guardar({reglas:[{tipo, dispositivo, frase}], abrir}) · permisoBluetooth() · bluetooth() → {lista:[nombres emparejados]}
 */
@CapacitorPlugin(name = "Disparadores", permissions = { @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "bluetooth") })
public class DisparadoresPlugin extends Plugin {

    @PluginMethod
    public void guardar(PluginCall call) {
        JSArray r = call.getArray("reglas", new JSArray());
        getContext().getSharedPreferences("jarvis_disparadores", 0).edit().putString("reglas", r.toString()).putBoolean("abrir", call.getBoolean("abrir", true)).apply();
        CargaJob.programar(getContext());
        call.resolve();
    }

    @PluginMethod
    public void permisoBluetooth(PluginCall call) {
        if (Build.VERSION.SDK_INT < 31 || getPermissionState("bluetooth") == PermissionState.GRANTED) { JSObject o = new JSObject(); o.put("ok", true); call.resolve(o); return; }
        requestPermissionForAlias("bluetooth", call, "btListo");
    }

    @PermissionCallback
    private void btListo(PluginCall call) { JSObject o = new JSObject(); o.put("ok", getPermissionState("bluetooth") == PermissionState.GRANTED); call.resolve(o); }

    @android.annotation.SuppressLint("MissingPermission")
    @PluginMethod
    public void bluetooth(PluginCall call) {
        JSArray l = new JSArray();
        try {
            android.bluetooth.BluetoothManager bm = (android.bluetooth.BluetoothManager) getContext().getSystemService(android.content.Context.BLUETOOTH_SERVICE);
            if (bm != null && bm.getAdapter() != null && (Build.VERSION.SDK_INT < 31 || getPermissionState("bluetooth") == PermissionState.GRANTED))
                for (android.bluetooth.BluetoothDevice d : bm.getAdapter().getBondedDevices()) if (d.getName() != null) l.put(d.getName());
        } catch (Exception ignored) { }
        JSObject o = new JSObject(); o.put("lista", l); call.resolve(o);
    }
}
