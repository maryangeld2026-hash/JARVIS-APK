package co.jarvis.docente

import android.content.Context
import com.google.ai.edge.litertlm.Backend
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
 * Usa la GPU si el celular tiene memoria de sobra (12 GB o más); si no, el procesador (más seguro).
 * Nada sale del celular. Se carga al usarla y se libera sola cuando no se usa (ver IALocalPlugin).
 */
class GemmaMotor(ctx: Context, val ruta: String, gpu: Boolean) {
    private val engine: Engine
    val backend: String
    @Volatile private var conv: Conversation? = null

    init {
        var e: Engine? = null
        var b = "CPU"
        if (gpu) {
            try {
                e = Engine(EngineConfig(modelPath = ruta, backend = Backend.GPU(), maxNumTokens = 4096, cacheDir = ctx.cacheDir.path))
                e.initialize(); b = "GPU"
            } catch (t: Throwable) { try { e?.close() } catch (_: Throwable) { }; e = null }
        }
        if (e == null) {
            e = Engine(EngineConfig(modelPath = ruta, backend = Backend.CPU(), maxNumTokens = 4096, cacheDir = ctx.cacheDir.path))
            e.initialize()
        }
        engine = e
        backend = b
    }

    /** historial: pares (rol, texto) con rol «user» o «assistant». parcial recibe el texto acumulado. */
    fun generar(sistema: String, historial: List<Array<String>>, ultimo: String, maxTokens: Int, temperatura: Double, parcial: (String) -> Unit): String {
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
        val sb = StringBuilder()
        val fin = CountDownLatch(1)
        var error: Throwable? = null
        try {
            c.sendMessageAsync(Message.user(ultimo), object : MessageCallback {
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
