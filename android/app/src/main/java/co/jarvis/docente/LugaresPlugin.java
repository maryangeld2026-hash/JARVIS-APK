package co.jarvis.docente;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingClient;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import java.util.Collections;

/**
 * Jarvis 3.6: recordatorios por lugar («cuando llegue al colegio, recuérdame imprimir las guías»).
 *   aqui() → {lat, lng} (dónde estás ahora, para guardar «el colegio»)
 *   programar({id, lat, lng, radio, texto, salir}) / quitar({id})
 *   permisoFondo() → abre el ajuste para «Permitir todo el tiempo» (Android lo pide aparte)
 * Android avisa al llegar aunque Jarvis esté cerrado. La ubicación no sale del celular.
 */
@CapacitorPlugin(name = "Lugares", permissions = { @Permission(strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }, alias = "ubicacion") })
public class LugaresPlugin extends Plugin {

    @PluginMethod
    public void aqui(PluginCall call) {
        if (getPermissionState("ubicacion") != PermissionState.GRANTED) { requestPermissionForAlias("ubicacion", call, "aquiListo"); return; }
        ubicar(call);
    }

    @PermissionCallback
    private void aquiListo(PluginCall call) {
        if (getPermissionState("ubicacion") != PermissionState.GRANTED) { call.reject("Sin permiso de ubicación."); return; }
        ubicar(call);
    }

    @SuppressLint("MissingPermission")
    private void ubicar(PluginCall call) {
        LocationServices.getFusedLocationProviderClient(getContext()).getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
            .addOnSuccessListener((loc) -> {
                if (loc == null) { call.reject("No pude saber dónde estás. Activa la ubicación del celular."); return; }
                JSObject r = new JSObject(); r.put("lat", loc.getLatitude()); r.put("lng", loc.getLongitude()); r.put("precision", loc.getAccuracy()); call.resolve(r);
            })
            .addOnFailureListener((e) -> call.reject("No pude saber dónde estás: " + e.getMessage()));
    }

    @PluginMethod
    public void fondoActivo(PluginCall call) {
        boolean ok = Build.VERSION.SDK_INT < 29 || getContext().checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        JSObject r = new JSObject(); r.put("activo", ok); call.resolve(r);
    }

    @PluginMethod
    public void permisoFondo(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception ignored) { }
        call.resolve();
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void programar(PluginCall call) {
        if (getPermissionState("ubicacion") != PermissionState.GRANTED) { call.reject("Sin permiso de ubicación."); return; }
        String id = call.getString("id", "lugar");
        double lat = call.getDouble("lat", 0d), lng = call.getDouble("lng", 0d);
        float radio = (float) (double) call.getDouble("radio", 150d);
        boolean salir = call.getBoolean("salir", false);
        getContext().getSharedPreferences("jarvis_lugares", 0).edit().putString(id, call.getString("texto", "Recordatorio")).apply();
        Geofence g = new Geofence.Builder().setRequestId(id).setCircularRegion(lat, lng, Math.max(100f, radio))
            .setExpirationDuration(Geofence.NEVER_EXPIRE)
            .setTransitionTypes(salir ? Geofence.GEOFENCE_TRANSITION_EXIT : Geofence.GEOFENCE_TRANSITION_ENTER).build();
        GeofencingRequest req = new GeofencingRequest.Builder().setInitialTrigger(0).addGeofence(g).build();
        GeofencingClient gc = LocationServices.getGeofencingClient(getContext());
        gc.addGeofences(req, pi()).addOnSuccessListener((v) -> call.resolve())
            .addOnFailureListener((e) -> call.reject("Android no aceptó el recordatorio por lugar (activa la ubicación y «Permitir todo el tiempo»): " + e.getMessage()));
    }

    @PluginMethod
    public void quitar(PluginCall call) {
        String id = call.getString("id", "");
        LocationServices.getGeofencingClient(getContext()).removeGeofences(Collections.singletonList(id));
        getContext().getSharedPreferences("jarvis_lugares", 0).edit().remove(id).apply();
        call.resolve();
    }

    private PendingIntent pi() {
        Intent i = new Intent(getContext(), LugarReceiver.class);
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        return PendingIntent.getBroadcast(getContext(), 60, i, fl);
    }
}
