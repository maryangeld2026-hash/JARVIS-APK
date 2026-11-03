package co.jarvis.docente;

import android.Manifest;
import android.content.ContentUris;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.TimeZone;

/**
 * Jarvis 3.4: el calendario del celular (el mismo de tu cuenta de Google, ya sincronizado), sin configurar Google Cloud.
 *   permiso() → {ok}    eventos({desde, hasta}) → {lista: [{titulo, inicio, fin, todoElDia, lugar}]}
 *   crear({titulo, inicio, fin, descripcion}) → {ok, calendario}
 */
@CapacitorPlugin(name = "Calendario", permissions = { @Permission(strings = { Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR }, alias = "calendario") })
public class CalendarioPlugin extends Plugin {

    @PluginMethod
    public void permiso(PluginCall call) {
        if (getPermissionState("calendario") == PermissionState.GRANTED) { JSObject r = new JSObject(); r.put("ok", true); call.resolve(r); return; }
        requestPermissionForAlias("calendario", call, "permisoListo");
    }

    @PermissionCallback
    private void permisoListo(PluginCall call) { JSObject r = new JSObject(); r.put("ok", getPermissionState("calendario") == PermissionState.GRANTED); call.resolve(r); }

    @PluginMethod
    public void eventos(PluginCall call) {
        if (getPermissionState("calendario") != PermissionState.GRANTED) { call.reject("Sin permiso para el calendario."); return; }
        long desde = (long) (double) call.getDouble("desde", (double) System.currentTimeMillis());
        long hasta = (long) (double) call.getDouble("hasta", (double) (System.currentTimeMillis() + 86400000L));
        Uri.Builder b = CalendarContract.Instances.CONTENT_URI.buildUpon();
        ContentUris.appendId(b, desde);
        ContentUris.appendId(b, hasta);
        String[] cols = { CalendarContract.Instances.TITLE, CalendarContract.Instances.BEGIN, CalendarContract.Instances.END, CalendarContract.Instances.ALL_DAY, CalendarContract.Instances.EVENT_LOCATION, CalendarContract.Instances.VISIBLE };
        JSArray lista = new JSArray();
        try (Cursor k = getContext().getContentResolver().query(b.build(), cols, null, null, CalendarContract.Instances.BEGIN + " ASC")) {
            while (k != null && k.moveToNext() && lista.length() < 40) {
                if (k.getInt(5) == 0) continue;
                JSObject e = new JSObject();
                e.put("titulo", k.getString(0) == null ? "" : k.getString(0));
                e.put("inicio", k.getLong(1));
                e.put("fin", k.getLong(2));
                e.put("todoElDia", k.getInt(3) == 1);
                e.put("lugar", k.getString(4) == null ? "" : k.getString(4));
                lista.put(e);
            }
        } catch (Exception ex) { call.reject("No pude leer el calendario: " + ex.getMessage()); return; }
        JSObject r = new JSObject(); r.put("lista", lista); call.resolve(r);
    }

    @PluginMethod
    public void crear(PluginCall call) {
        if (getPermissionState("calendario") != PermissionState.GRANTED) { call.reject("Sin permiso para el calendario."); return; }
        long ini = (long) (double) call.getDouble("inicio", 0d), fin = (long) (double) call.getDouble("fin", 0d);
        if (ini <= 0) { call.reject("Falta la hora."); return; }
        if (fin <= ini) fin = ini + 3600000L;
        long cal = -1; String nombre = "";
        String[] cols = { CalendarContract.Calendars._ID, CalendarContract.Calendars.CALENDAR_DISPLAY_NAME, CalendarContract.Calendars.IS_PRIMARY, CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL, CalendarContract.Calendars.VISIBLE };
        try (Cursor k = getContext().getContentResolver().query(CalendarContract.Calendars.CONTENT_URI, cols,
                CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL + ">=" + CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR, null, null)) {
            while (k != null && k.moveToNext()) {
                boolean primario = k.getInt(2) == 1, visible = k.getInt(4) == 1;
                if (cal < 0 || (primario && visible)) { cal = k.getLong(0); nombre = k.getString(1); if (primario && visible) break; }
            }
        } catch (Exception ex) { call.reject("No pude ver tus calendarios: " + ex.getMessage()); return; }
        if (cal < 0) { call.reject("No encontré un calendario donde guardar. Revisa que tu cuenta de Google esté sincronizando el calendario."); return; }
        ContentValues v = new ContentValues();
        v.put(CalendarContract.Events.CALENDAR_ID, cal);
        v.put(CalendarContract.Events.TITLE, call.getString("titulo", "Evento"));
        v.put(CalendarContract.Events.DESCRIPTION, call.getString("descripcion", "Agendado por Jarvis"));
        v.put(CalendarContract.Events.DTSTART, ini);
        v.put(CalendarContract.Events.DTEND, fin);
        v.put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().getID());
        v.put(CalendarContract.Events.HAS_ALARM, 1);
        try {
            Uri u = getContext().getContentResolver().insert(CalendarContract.Events.CONTENT_URI, v);
            if (u != null) {
                ContentValues rv = new ContentValues();
                rv.put(CalendarContract.Reminders.EVENT_ID, ContentUris.parseId(u));
                rv.put(CalendarContract.Reminders.MINUTES, 15);
                rv.put(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT);
                try { getContext().getContentResolver().insert(CalendarContract.Reminders.CONTENT_URI, rv); } catch (Exception ignored) { }
            }
            JSObject r = new JSObject(); r.put("ok", u != null); r.put("calendario", nombre == null ? "" : nombre); call.resolve(r);
        } catch (Exception ex) { call.reject("No pude crear el evento: " + ex.getMessage()); }
    }
}
