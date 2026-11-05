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
import com.google.ai.edge.litertlm.SpeculativeDecodingConfig
import com.google.ai.edge.litertlm.SpeculativeDecodingMode
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
    /** 3.19: ve fotos / oye audio (Gemma 4 hace las dos; Qwen 3.5 «VL» solo ve). */
    val multimodal: Boolean
    var oye: Boolean = false
        private set
    /** 3.19: Qwen 3.5 (y otros modelos LiteRT-LM que no son Gemma): sin audio, sin MTP, procesador y una conversación nueva cada vez. */
    val qwen: Boolean = ruta.substringAfterLast('/').lowercase().let { it.contains("qwen") || !it.contains("gemma") }
    val nombre: String = if (qwen) "Qwen 3.5" else "Gemma"
    @Volatile private var conv: Conversation? = null

    init {
        val prefs = ctx.getSharedPreferences("jarvis_gemma", 0)
        val cache = ctx.cacheDir.path
        var e: Engine? = null
        var b = "CPU"
        var mm = false
        var au = false
        val vl = ruta.lowercase().contains("-vl")
        if (qwen) {
            // Qwen 3.5: en Android va mejor con el procesador (la GPU tarda más de un minuto en cargar y gasta más memoria)
            if (vl) {
                try { e = Engine(EngineConfig(modelPath = ruta, backend = Backend.CPU(), visionBackend = Backend.CPU(), maxNumTokens = TOKENS, maxNumImages = 1, cacheDir = cache)); e.initialize(); mm = true }
                catch (t: Throwable) { try { e?.close() } catch (_: Throwable) { }; e = null }
            }
            if (e == null) { e = Engine(EngineConfig(modelPath = ruta, backend = Backend.CPU(), maxNumTokens = TOKENS, cacheDir = cache)); e.initialize(); mm = false }
        }
        val probarGpu = !qwen && gpu && !prefs.getBoolean("gpuMala", false)
        if (probarGpu) {
            // si la app se cierra aquí (falla nativa de la GPU), al volver se sabe y no se repite
            prefs.edit().putBoolean("cargandoGpu", true).commit()
            try {
                e = Engine(EngineConfig(modelPath = ruta, backend = Backend.GPU(), visionBackend = Backend.GPU(), audioBackend = Backend.CPU(), maxNumTokens = TOKENS, maxNumImages = 4, cacheDir = cache, speculativeDecodingConfig = RAPIDO))
                e.initialize(); b = "GPU"; mm = true; au = true
            } catch (t: Throwable) { try { e?.close() } catch (_: Throwable) { }; e = null }
            prefs.edit().putBoolean("cargandoGpu", false).apply()
        }
        if (e == null) {
            try {
                e = Engine(EngineConfig(modelPath = ruta, backend = Backend.CPU(), visionBackend = Backend.CPU(), audioBackend = Backend.CPU(), maxNumTokens = TOKENS, maxNumImages = 4, cacheDir = cache, speculativeDecodingConfig = RAPIDO))
                e.initialize(); b = "CPU"; mm = true; au = true
            } catch (t: Throwable) { try { e?.close() } catch (_: Throwable) { }; e = null }
        }
        if (e == null) {
            try { e = Engine(EngineConfig(modelPath = ruta, backend = Backend.CPU(), maxNumTokens = TOKENS, cacheDir = cache, speculativeDecodingConfig = RAPIDO)); e.initialize() }
            catch (t: Throwable) { try { e?.close() } catch (_: Throwable) { }; e = Engine(EngineConfig(modelPath = ruta, backend = Backend.CPU(), maxNumTokens = TOKENS, cacheDir = cache)); e.initialize() }
            b = "CPU"; mm = false
        }
        engine = e!!
        backend = b
        multimodal = mm
        oye = au && mm
    }

    companion object {
        /** 3.15: memoria de la conversación (instrucción + historia + respuesta). Antes 4096: las respuestas largas se cortaban. */
        const val TOKENS = 8192
        /** 3.15: predicción de varias palabras a la vez (MTP), solo cuando de verdad acelera. */
        val RAPIDO = SpeculativeDecodingConfig(mode = SpeculativeDecodingMode.ADAPTIVE)
        /** ¿La última vez la app se cerró cargando la GPU? Entonces la GPU queda marcada como mala en este celular. */
        @JvmStatic fun revisarCaida(ctx: Context) {
            val p = ctx.getSharedPreferences("jarvis_gemma", 0)
            if (p.getBoolean("cargandoGpu", false)) p.edit().putBoolean("cargandoGpu", false).putBoolean("gpuMala", true).apply()
        }
    }

    // 3.15: la conversación abierta se reutiliza si sigue la misma charla: Gemma no vuelve a leer la instrucción ni la historia
    private var abierta: Conversation? = null
    private var firma = ""
    private val usuarios = mutableListOf<String>()

    /** historial: pares (rol, texto) con rol «user» o «assistant». imagenes y audios: rutas de archivos (jpg / wav). */
    fun generar(sistema: String, historial: List<Array<String>>, ultimo: String, imagenes: List<String>, audios: List<String>, maxTokens: Int, temperatura: Double, parcial: (String) -> Unit): String {
        val users = historial.filter { it[0] == "user" }.map { it[1] }
        val f = sistema.hashCode().toString() + "|" + temperatura
        val media = multimodal && (imagenes.isNotEmpty() || audios.isNotEmpty())
        var c = abierta
        if (c == null || f != firma || media || users != usuarios || usuarios.size >= 8 || qwen) {
            try { abierta?.close() } catch (_: Throwable) { }
            abierta = null
            val ini = historial.map { if (it[0] == "user") Message.user(it[1]) else Message.model(it[1]) }
            c = engine.createConversation(
                ConversationConfig(
                    systemInstruction = if (sistema.isBlank()) null else Contents.of(sistema),
                    initialMessages = ini,
                    samplerConfig = if (qwen) SamplerConfig(topK = 20, topP = 0.8, temperature = temperatura) else SamplerConfig(topK = 64, topP = 0.95, temperature = temperatura),
                    maxOutputToken = maxTokens,
                )
            )
            usuarios.clear(); usuarios.addAll(users); firma = f
        }
        conv = c
        val partes = mutableListOf<Content>(Content.Text(ultimo))
        if (multimodal) {
            imagenes.take(if (qwen) 1 else 4).forEach { partes.add(Content.ImageFile(it)) }
            if (oye) audios.take(1).forEach { partes.add(Content.AudioFile(it)) }
        }
        val sb = StringBuilder()
        val fin = CountDownLatch(1)
        var error: Throwable? = null
        var ok = false
        try {
            c.sendMessageAsync(Message.user(Contents.of(partes)), object : MessageCallback {
                override fun onMessage(message: Message) { sb.append(message.toString()); parcial(sb.toString()) }
                override fun onDone() { fin.countDown() }
                override fun onError(throwable: Throwable) { error = throwable; fin.countDown() }
            })
            if (!fin.await(5, TimeUnit.MINUTES)) { try { c.cancelProcess() } catch (_: Throwable) { } }
            ok = error == null
        } finally {
            conv = null
            if (ok && !media && !qwen) { abierta = c; usuarios.add(ultimo) }          // queda abierta para la próxima pregunta
            else { try { c.close() } catch (_: Throwable) { }; if (abierta === c) abierta = null; usuarios.clear(); firma = "" }
        }
        error?.let { if (sb.isEmpty()) throw it }
        return sb.toString()
    }

    fun detener() { try { conv?.cancelProcess() } catch (_: Throwable) { } }

    fun cerrar() { detener(); try { abierta?.close() } catch (_: Throwable) { }; abierta = null; try { engine.close() } catch (_: Throwable) { } }
}
