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
@CapacitorPlugin(name = "Disparadores", permissions = { @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "bluetooth"),
    @Permission(strings = { Manifest.permission.RECEIVE_SMS }, alias = "smsIn") })
public class DisparadoresPlugin extends Plugin {

    @PluginMethod
    public void guardar(PluginCall call) {
        JSArray r = call.getArray("reglas", new JSArray());
        getContext().getSharedPreferences("jarvis_disparadores", 0).edit().putString("reglas", r.toString()).putBoolean("abrir", call.getBoolean("abrir", true))
            .putString("carro", call.getString("carro", "")).apply();
        CargaJob.programar(getContext());
        call.resolve();
    }

    /** 3.10: dónde quedó el carro (lo guarda Android al desconectarse su Bluetooth): {lat, lng, precision, t} o {} */
    @PluginMethod
    public void carro(PluginCall call) {
        String s = getContext().getSharedPreferences("jarvis_disparadores", 0).getString("carroPos", "");
        JSObject o = new JSObject();
        String[] p = s.split(",");
        if (p.length == 4) { try { o.put("lat", Double.parseDouble(p[0])); o.put("lng", Double.parseDouble(p[1])); o.put("precision", Long.parseLong(p[2])); o.put("t", Long.parseLong(p[3])); } catch (Exception ignored) { } }
        call.resolve(o);
    }

    /** 3.10: encontrar el celular por SMS: {on, clave, responder} (pide el permiso de recibir SMS). */
    @PluginMethod
    public void buscarCelular(PluginCall call) {
        boolean on = call.getBoolean("on", false);
        getContext().getSharedPreferences("jarvis_buscar", 0).edit().putBoolean("on", on).putString("clave", call.getString("clave", "")).putBoolean("responder", call.getBoolean("responder", true)).apply();
        if (on && getPermissionState("smsIn") != PermissionState.GRANTED) { requestPermissionForAlias("smsIn", call, "smsInListo"); return; }
        JSObject o = new JSObject(); o.put("ok", true); call.resolve(o);
    }
    @PermissionCallback
    private void smsInListo(PluginCall call) { JSObject o = new JSObject(); o.put("ok", getPermissionState("smsIn") == PermissionState.GRANTED); call.resolve(o); }

    /** 3.11: el widget a la carta: {titulo, texto, cmd, fijar} → {fijado} */
    @PluginMethod
    public void widgetDatos(PluginCall call) {
        getContext().getSharedPreferences("jarvis_widget2", 0).edit().putString("titulo", call.getString("titulo", "Jarvis")).putString("texto", call.getString("texto", "")).putString("cmd", call.getString("cmd", "")).apply();
        WidgetDatos.actualizar(getContext());
        JSObject o = new JSObject(); o.put("fijado", call.getBoolean("fijar", false) && WidgetDatos.fijar(getContext())); call.resolve(o);
    }

    /** 3.10: prueba del sonido de «encontrar el celular». */
    @PluginMethod
    public void probarSonido(PluginCall call) { SmsReceiver.sonar(getContext()); call.resolve(); }

    /** 3.10: pide a Android poner el botón de Jarvis en los Ajustes rápidos (Android 13+). */
    @PluginMethod
    public void agregarBoton(PluginCall call) {
        JSObject o = new JSObject();
        if (Build.VERSION.SDK_INT >= 33) {
            try {
                android.app.StatusBarManager sb = getContext().getSystemService(android.app.StatusBarManager.class);
                sb.requestAddTileService(new android.content.ComponentName(getContext(), JarvisTile.class), "Jarvis",
                    android.graphics.drawable.Icon.createWithResource(getContext(), R.drawable.w_mic), getContext().getMainExecutor(), (res) -> { });
                o.put("pedido", true);
            } catch (Exception e) { o.put("pedido", false); }
        } else o.put("pedido", false);
        call.resolve(o);
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
