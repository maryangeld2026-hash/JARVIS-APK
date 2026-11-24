package co.jarvis.docente

import com.google.mlkit.genai.common.DownloadStatus
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import kotlinx.coroutines.runBlocking

/**
 * Jarvis 3.30 · Gemini Nano: la IA que Google pone dentro de algunos celulares (AICore), por la API de ML Kit (Prompt API).
 * No ocupa espacio de Jarvis ni necesita internet para responder. Solo en los celulares que la traen.
 * Se llama desde Java en un hilo aparte (las funciones esperan).
 */
object NanoMotor {
    private var modelo: GenerativeModel? = null
    private class Parar : RuntimeException()

    private fun m(): GenerativeModel = modelo ?: Generation.getClient().also { modelo = it }

    /** "disponible" | "descargable" | "descargando" | "no" */
    @JvmStatic
    fun estado(): String = try {
        runBlocking {
            when (m().checkStatus()) {
                FeatureStatus.AVAILABLE -> "disponible"
                FeatureStatus.DOWNLOADABLE -> "descargable"
                FeatureStatus.DOWNLOADING -> "descargando"
                else -> "no"
            }
        }
    } catch (e: Throwable) { "no" }

    fun interface Progreso { fun en(bytes: Long) }

    /** Pide a Android que baje Gemini Nano. → "" si quedó, o el error. */
    @JvmStatic
    fun descargar(p: Progreso): String = try {
        var error = ""
        runBlocking {
            m().download().collect { s ->
                when (s) {
                    is DownloadStatus.DownloadProgress -> p.en(s.totalBytesDownloaded)
                    is DownloadStatus.DownloadFailed -> error = s.toString()
                    else -> {}
                }
            }
        }
        error
    } catch (e: Throwable) { e.message ?: "falló la descarga" }

    fun interface Escucha { fun parcial(textoHastaAhora: String): Boolean }

    /** La respuesta (va avisando lo que lleva; si escucha devuelve false, para). */
    @JvmStatic
    fun generar(prompt: String, escucha: Escucha): String {
        val sb = StringBuilder()
        try {
            runBlocking {
                m().generateContentStream(prompt).collect { ch ->
                    sb.append(ch.candidates.firstOrNull()?.text ?: "")
                    if (!escucha.parcial(sb.toString())) throw Parar()
                }
            }
        } catch (e: Parar) { /* lo paraste */ }
        return sb.toString().trim()
    }

    @JvmStatic
    fun cerrar() { try { modelo?.close() } catch (e: Throwable) { }; modelo = null }
}
