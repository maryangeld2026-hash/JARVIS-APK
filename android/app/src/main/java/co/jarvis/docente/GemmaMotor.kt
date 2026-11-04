package co.jarvis.docente

import android.content.Context
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.MessageCallback
import com.google.ai.edge.litertlm.SamplerConfig
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Jarvis 3.12: Gemma 4 (E2B o E4B) dentro del celular, con LiteRT-LM de Google.
 * 3.13: también ve fotos y oye audio. Arranca en este orden (si un paso falla, prueba el siguiente):
 *   1) texto + imágenes + audio con la GPU   2) lo mismo con el procesador   3) solo texto con el procesador.
 * La GPU solo se intenta con 10,5 GB de RAM o más, y si alguna vez se cerró la app al cargarla, no se vuelve a intentar.
 * Nada sale del celular. Se carga al usarla y se libera sola cuando no se usa (ver IALocalPlugin).
 */
class GemmaMotor(ctx: Context, val ruta: String, gpu: Boolean) {
    private val engine: Engine
    val backend: String
    val multimodal: Boolean
    @Volatile private var conv: Conversation? = null

    init {
        val prefs = ctx.getSharedPreferences("jarvis_gemma", 0)
        val cache = ctx.cacheDir.path
        var e: Engine? = null
        var b = "CPU"
        var mm = false
        val probarGpu = gpu && !prefs.getBoolean("gpuMala", false)
        if (probarGpu) {
            // si la app se cierra aquí (falla nativa de la GPU), al volver se sabe y no se repite
            prefs.edit().putBoolean("cargandoGpu", true).commit()
            try {
                e = Engine(EngineConfig(modelPath = ruta, backend = Backend.GPU(), visionBackend = Backend.GPU(), audioBackend = Backend.CPU(), maxNumTokens = 4096, maxNumImages = 4, cacheDir = cache))
                e.initialize(); b = "GPU"; mm = true
            } catch (t: Throwable) { try { e?.close() } catch (_: Throwable) { }; e = null }
            prefs.edit().putBoolean("cargandoGpu", false).apply()
        }
        if (e == null) {
            try {
                e = Engine(EngineConfig(modelPath = ruta, backend = Backend.CPU(), visionBackend = Backend.CPU(), audioBackend = Backend.CPU(), maxNumTokens = 4096, maxNumImages = 4, cacheDir = cache))
                e.initialize(); b = "CPU"; mm = true
            } catch (t: Throwable) { try { e?.close() } catch (_: Throwable) { }; e = null }
        }
        if (e == null) {
            e = Engine(EngineConfig(modelPath = ruta, backend = Backend.CPU(), maxNumTokens = 4096, cacheDir = cache))
            e.initialize(); b = "CPU"; mm = false
        }
        engine = e
        backend = b
        multimodal = mm
    }

    companion object {
        /** ¿La última vez la app se cerró cargando la GPU? Entonces la GPU queda marcada como mala en este celular. */
        @JvmStatic fun revisarCaida(ctx: Context) {
            val p = ctx.getSharedPreferences("jarvis_gemma", 0)
            if (p.getBoolean("cargandoGpu", false)) p.edit().putBoolean("cargandoGpu", false).putBoolean("gpuMala", true).apply()
        }
    }

    /** historial: pares (rol, texto) con rol «user» o «assistant». imagenes y audios: rutas de archivos (jpg / wav). */
    fun generar(sistema: String, historial: List<Array<String>>, ultimo: String, imagenes: List<String>, audios: List<String>, maxTokens: Int, temperatura: Double, parcial: (String) -> Unit): String {
        val ini = historial.map { if (it[0] == "user") Message.user(it[1]) else Message.model(it[1]) }
        val c = engine.createConversation(
            ConversationConfig(
                systemInstruction = if (sistema.isBlank()) null else Contents.of(sistema),
                initialMessages = ini,
                samplerConfig = SamplerConfig(topK = 64, topP = 0.95, temperature = temperatura),
                maxOutputToken = maxTokens,
            )
        )
        conv = c
        val partes = mutableListOf<Content>(Content.Text(ultimo))
        if (multimodal) {
            imagenes.take(4).forEach { partes.add(Content.ImageFile(it)) }
            audios.take(1).forEach { partes.add(Content.AudioFile(it)) }
        }
        val sb = StringBuilder()
        val fin = CountDownLatch(1)
        var error: Throwable? = null
        try {
            c.sendMessageAsync(Message.user(Contents.of(partes)), object : MessageCallback {
                override fun onMessage(message: Message) { sb.append(message.toString()); parcial(sb.toString()) }
                override fun onDone() { fin.countDown() }
                override fun onError(throwable: Throwable) { error = throwable; fin.countDown() }
            })
            if (!fin.await(4, TimeUnit.MINUTES)) { try { c.cancelProcess() } catch (_: Throwable) { } }
        } finally {
            conv = null
            try { c.close() } catch (_: Throwable) { }
        }
        error?.let { if (sb.isEmpty()) throw it }
        return sb.toString()
    }

    fun detener() { try { conv?.cancelProcess() } catch (_: Throwable) { } }

    fun cerrar() { detener(); try { engine.close() } catch (_: Throwable) { } }
}
