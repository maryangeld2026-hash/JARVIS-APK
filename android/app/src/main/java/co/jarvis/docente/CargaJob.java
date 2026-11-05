package co.jarvis.docente;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;

/**
 * 3.9: «al poner a cargar» y «al desconectar el cargador». Android ya no deja escuchar el cargador con la app cerrada,
 * así que se usa el programador de tareas de Android: una tarea que corre cuando empieza a cargar y, mientras carga
 * (cuando la batería no importa), una revisión cada 15 minutos para saber cuándo lo desconectas.
 */
public class CargaJob extends JobService {
    static final int ID_CARGA = 7301, ID_REVISAR = 7302;

    static void programar(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        js.cancel(ID_CARGA); js.cancel(ID_REVISAR);
        if (!Disparo.hay(c, "carga")) return;
        boolean cargando = cargando(c);
        c.getSharedPreferences("jarvis_disparadores", 0).edit().putBoolean("cargaba", cargando).apply();
        ComponentName cn = new ComponentName(c, CargaJob.class);
        if (cargando) js.schedule(new JobInfo.Builder(ID_REVISAR, cn).setPeriodic(15 * 60 * 1000L).setPersisted(true).build());
        else js.schedule(new JobInfo.Builder(ID_CARGA, cn).setRequiresCharging(true).setPersisted(true).build());
    }

    static boolean cargando(Context c) {
        Intent b = c.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        int p = b != null ? b.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) : 0;
        return p != 0;
    }

    @Override
    public boolean onStartJob(JobParameters p) {
        if (Apagado.es(this)) return false;
        boolean antes = getSharedPreferences("jarvis_disparadores", 0).getBoolean("cargaba", false), ahora = cargando(this);
        if (ahora && !antes) Disparo.evento(this, "carga_on", "");
        else if (!ahora && antes) Disparo.evento(this, "carga_off", "");
        if (ahora != antes || p.getJobId() == ID_CARGA) programar(this);
        return false;
    }

    @Override
    public boolean onStopJob(JobParameters p) { return false; }
}
