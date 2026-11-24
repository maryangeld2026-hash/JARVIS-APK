package co.jarvis.docente

import android.content.Context
import android.content.Intent
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.Period
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/**
 * Jarvis 3.31 · Health Connect (la «Conexión Salud» de Android): pasos, sueño y pulso que guardan el celular,
 * el reloj o apps como Fitbit y Samsung Health. Solo lectura, y solo lo que aceptes. Se llama desde Java en otro hilo.
 */
object SaludMotor {
    @JvmField val PERMISOS: Set<String> = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
    )

    /** "listo" | "actualizar" (hay que instalar o actualizar Health Connect) | "no" */
    @JvmStatic
    fun estado(ctx: Context): String = when (HealthConnectClient.getSdkStatus(ctx)) {
        HealthConnectClient.SDK_AVAILABLE -> "listo"
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "actualizar"
        else -> "no"
    }

    @JvmStatic
    fun intentPermisos(ctx: Context): Intent = PermissionController.createRequestPermissionResultContract().createIntent(ctx, PERMISOS)

    @JvmStatic
    fun concedidos(ctx: Context): Int = try {
        runBlocking { HealthConnectClient.getOrCreate(ctx).permissionController.getGrantedPermissions().count { it in PERMISOS } }
    } catch (e: Throwable) { 0 }

    /** {pasos:[{dia, n}], sueno:[{ini, fin}], pulso:{prom, min, max}} de los últimos `dias` días (lo que tenga permiso). */
    @JvmStatic
    fun resumen(ctx: Context, dias: Int): String {
        val c = HealthConnectClient.getOrCreate(ctx)
        val zona = ZoneId.systemDefault()
        val hoy = LocalDate.now(zona)
        val o = JSONObject()
        runBlocking {
            try {
                val r = c.aggregateGroupByPeriod(AggregateGroupByPeriodRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(hoy.minusDays((dias - 1).toLong()).atStartOfDay(), hoy.plusDays(1).atStartOfDay()),
                    timeRangeSlicer = Period.ofDays(1)))
                val l = JSONArray()
                for (g in r) { val n = g.result[StepsRecord.COUNT_TOTAL] ?: 0L; if (n > 0) l.put(JSONObject().put("dia", g.startTime.toLocalDate().toString()).put("n", n)) }
                o.put("pasos", l)
            } catch (e: Throwable) { o.put("pasosError", e.javaClass.simpleName) }
            try {
                val fin = Instant.now(); val ini = fin.minus((dias + 1).toLong(), ChronoUnit.DAYS)
                val r = c.readRecords(ReadRecordsRequest(SleepSessionRecord::class, TimeRangeFilter.between(ini, fin)))
                val l = JSONArray()
                for (s in r.records) l.put(JSONObject().put("ini", s.startTime.toEpochMilli()).put("fin", s.endTime.toEpochMilli()))
                o.put("sueno", l)
            } catch (e: Throwable) { o.put("suenoError", e.javaClass.simpleName) }
            try {
                val fin = Instant.now(); val ini = fin.minus(1, ChronoUnit.DAYS)
                val r = c.aggregate(AggregateRequest(setOf(HeartRateRecord.BPM_AVG, HeartRateRecord.BPM_MIN, HeartRateRecord.BPM_MAX), TimeRangeFilter.between(ini, fin)))
                val prom = r[HeartRateRecord.BPM_AVG]
                if (prom != null) o.put("pulso", JSONObject().put("prom", prom).put("min", r[HeartRateRecord.BPM_MIN] ?: 0).put("max", r[HeartRateRecord.BPM_MAX] ?: 0))
            } catch (e: Throwable) { o.put("pulsoError", e.javaClass.simpleName) }
        }
        return o.toString()
    }
}
