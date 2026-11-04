package co.jarvis.docente;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** 3.9: conectaste o desconectaste un Bluetooth (el carro, tus audífonos): Android avisa aunque Jarvis esté cerrado. */
public class DisparoReceiver extends BroadcastReceiver {
    @SuppressLint("MissingPermission")
    @Override
    public void onReceive(Context c, Intent i) {
        String a = i.getAction();
        if (a == null) return;
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) { CargaJob.programar(c); return; }
        String nombre = "";
        try { BluetoothDevice d = i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE); if (d != null && d.getName() != null) nombre = d.getName(); } catch (Exception ignored) { }
        if (BluetoothDevice.ACTION_ACL_CONNECTED.equals(a)) Disparo.evento(c, "bt_on", nombre);
        else if (BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(a)) Disparo.evento(c, "bt_off", nombre);
    }
}
