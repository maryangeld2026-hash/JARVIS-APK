package co.jarvis.docente;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** 3.9: conectaste o desconectaste un Bluetooth (el carro, tus audífonos): Android avisa aunque Jarvis esté cerrado. */
public class DisparoReceiver extends BroadcastReceiver {
    @SuppressLint("MissingPermission")
    static void guardarCarro(Context c, PendingResult pr) {
        try {
            com.google.android.gms.location.LocationServices.getFusedLocationProviderClient(c)
                .getCurrentLocation(com.google.android.gms.location.Priority.PRIORITY_BALANCED_POWER_ACCURACY, null)
                .addOnCompleteListener((t) -> {
                    android.location.Location l = t.isSuccessful() ? t.getResult() : null;
                    if (l != null) c.getSharedPreferences("jarvis_disparadores", 0).edit().putString("carroPos", l.getLatitude() + "," + l.getLongitude() + "," + Math.round(l.getAccuracy()) + "," + System.currentTimeMillis()).apply();
                    if (pr != null) pr.finish();
                });
        } catch (Exception e) { if (pr != null) pr.finish(); }
    }

    @SuppressLint("MissingPermission")
    @Override
    public void onReceive(Context c, Intent i) {
        String a = i.getAction();
        if (a == null) return;
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) { CargaJob.programar(c); return; }
        if (Apagado.es(c)) return;                                            // 3.16: apagado no hace disparadores
        String nombre = "";
        try { BluetoothDevice d = i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE); if (d != null && d.getName() != null) nombre = d.getName(); } catch (Exception ignored) { }
        if (BluetoothDevice.ACTION_ACL_CONNECTED.equals(a)) Disparo.evento(c, "bt_on", nombre);
        else if (BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(a)) {
            Disparo.evento(c, "bt_off", nombre);
            // 3.10: ¿dónde dejé el carro? — al apagar el carro (se desconecta su Bluetooth) se guarda dónde quedó
            String carro = c.getSharedPreferences("jarvis_disparadores", 0).getString("carro", "");
            if (!carro.isEmpty() && nombre.toLowerCase().contains(carro.toLowerCase())) guardarCarro(c, goAsync());
        }
    }
}
