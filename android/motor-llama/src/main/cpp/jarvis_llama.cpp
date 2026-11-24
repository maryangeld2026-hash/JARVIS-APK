// Jarvis 3.29 · motor GGUF (llama.cpp) para la IA del celular.
// Basado en el ejemplo oficial de llama.cpp para Android (examples/llama.android, licencia MIT) y en la idea de
// PocketPal AI (MIT): cualquier modelo GGUF (Gemma, Qwen, Llama, Phi, LFM, SmolLM…) corre dentro del celular.
//
// Una conversación completa por llamada (sistema + mensajes), con la plantilla de chat del propio modelo (jinja).
// Lo que ya se procesó en la llamada anterior se reutiliza (el comienzo igual de la conversación): responde antes.
#include <jni.h>
#include <atomic>
#include <cmath>
#include <iomanip>
#include <mutex>
#include <sstream>
#include <string>
#include <vector>
#include <unistd.h>

#include "chat.h"
#include "common.h"
#include "llama.h"
#include "sampling.h"

#ifdef __ANDROID__
#include <android/log.h>
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, "JarvisLlama", __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "JarvisLlama", __VA_ARGS__)
#else
#include <cstdio>
#define LOGI(...) (fprintf(stderr, __VA_ARGS__), fputc('\n', stderr))
#define LOGE(...) (fprintf(stderr, __VA_ARGS__), fputc('\n', stderr))
#endif

static llama_model              * g_model = nullptr;
static llama_context            * g_ctx = nullptr;
static common_chat_templates_ptr  g_tmpls;
static std::vector<llama_token>   g_prev;          // lo que ya está en la memoria del contexto
static std::atomic<bool>          g_stop{false};
static std::mutex                 g_mx;
static int                        g_nctx = 4096;
static std::string                g_last_error;

static constexpr int BATCH = 512;

static std::string jstr(JNIEnv * env, jstring s) {
    if (!s) return "";
    const char * c = env->GetStringUTFChars(s, nullptr);
    std::string r(c ? c : "");
    if (c) env->ReleaseStringUTFChars(s, c);
    return r;
}

/** Java no acepta UTF-8 inválido en NewStringUTF (ni el «modified UTF-8» de 4 bytes): se arma con un arreglo de bytes. */
static jstring jnew(JNIEnv * env, const std::string & s) {
    jbyteArray arr = env->NewByteArray((jsize) s.size());
    env->SetByteArrayRegion(arr, 0, (jsize) s.size(), (const jbyte *) s.data());
    jclass cs = env->FindClass("java/lang/String");
    jmethodID ctor = env->GetMethodID(cs, "<init>", "([BLjava/lang/String;)V");
    jstring enc = env->NewStringUTF("UTF-8");
    jstring r = (jstring) env->NewObject(cs, ctor, arr, enc);
    env->DeleteLocalRef(arr); env->DeleteLocalRef(enc); env->DeleteLocalRef(cs);
    return r;
}

/** ¿Cuántos bytes al final de s son una letra UTF-8 todavía incompleta? */
static size_t utf8_incompleto(const std::string & s) {
    size_t n = s.size();
    for (size_t k = 1; k <= 4 && k <= n; k++) {
        unsigned char c = (unsigned char) s[n - k];
        if ((c & 0xC0) == 0x80) continue;                    // byte de continuación
        size_t len = (c & 0x80) == 0 ? 1 : (c & 0xE0) == 0xC0 ? 2 : (c & 0xF0) == 0xE0 ? 3 : (c & 0xF8) == 0xF0 ? 4 : 1;
        return len > k ? k : 0;
    }
    return 0;
}

static void liberar_todo() {
    if (g_ctx) { llama_free(g_ctx); g_ctx = nullptr; }
    g_tmpls.reset();
    if (g_model) { llama_model_free(g_model); g_model = nullptr; }
    g_prev.clear();
}

static int decodificar(const std::vector<llama_token> & toks, int desde, bool logits_al_final) {
    common_batch batch(g_ctx);
    for (int i = desde; i < (int) toks.size(); i += BATCH) {
        const int n = std::min((int) toks.size() - i, BATCH);
        batch.clear();
        for (int j = 0; j < n; j++) {
            const bool out = logits_al_final && (i + j == (int) toks.size() - 1);
            batch.add(toks[i + j], i + j, 0, out);
        }
        if (llama_process(g_ctx, LLAMA_PROCESS_TYPE_DECODE, batch.get()) != 0) return 1;
        if (g_stop.load()) return 2;
    }
    return 0;
}

extern "C" JNIEXPORT void JNICALL
Java_co_jarvis_motores_Llama_init(JNIEnv * env, jclass, jstring jdir) {
    const std::string dir = jstr(env, jdir);
    if (!dir.empty()) ggml_backend_load_all_from_path(dir.c_str());
    llama_backend_init();
}

/** → 0 bien; 1 no cargó el modelo; 2 no se pudo crear el contexto (memoria). */
extern "C" JNIEXPORT jint JNICALL
Java_co_jarvis_motores_Llama_cargar(JNIEnv * env, jclass, jstring jruta, jint n_ctx, jint hilos) {
    std::lock_guard<std::mutex> lk(g_mx);
    liberar_todo();
    llama_model_params mp = llama_model_default_params();
    mp.n_gpu_layers = 0;
    const std::string ruta = jstr(env, jruta);
    g_model = llama_model_load_from_file(ruta.c_str(), mp);
    if (!g_model) { g_last_error = "no cargó el modelo"; return 1; }
    llama_context_params cp = llama_context_default_params();
    const int entrenado = llama_model_n_ctx_train(g_model);
    g_nctx = std::max(1024, std::min((int) n_ctx, entrenado > 0 ? entrenado : (int) n_ctx));
    int nh = hilos > 0 ? hilos : std::max(2, std::min(4, (int) sysconf(_SC_NPROCESSORS_ONLN) - 2));
    cp.n_ctx = g_nctx;
    cp.n_batch = BATCH;
    cp.n_ubatch = BATCH;
    cp.n_threads = nh;
    cp.n_threads_batch = nh;
    g_ctx = llama_init_from_model(g_model, cp);
    if (!g_ctx) { liberar_todo(); g_last_error = "sin memoria para el contexto"; return 2; }
    g_tmpls = common_chat_templates_init(g_model, "");
    g_prev.clear();
    LOGI("modelo cargado: ctx %d, %d hilos", g_nctx, nh);
    return 0;
}

extern "C" JNIEXPORT void JNICALL
Java_co_jarvis_motores_Llama_detener(JNIEnv *, jclass) { g_stop.store(true); }

/**
 * La respuesta a una conversación. roles/textos: system, user, assistant… (el último, del usuario).
 * escucha.token(String textoHastaAhora) → false para parar. Devuelve el texto completo (o "" si falló; ver error()).
 */
extern "C" JNIEXPORT jstring JNICALL
Java_co_jarvis_motores_Llama_generar(JNIEnv * env, jclass, jobjectArray jroles, jobjectArray jtextos,
                                     jint max_tokens, jfloat temp, jboolean pensar, jobject escucha) {
    std::lock_guard<std::mutex> lk(g_mx);
    g_stop.store(false);
    g_last_error.clear();
    if (!g_model || !g_ctx) { g_last_error = "el modelo no está cargado"; return jnew(env, ""); }

    // 1) la conversación con la plantilla del modelo
    common_chat_templates_inputs in;
    const jsize n = env->GetArrayLength(jroles);
    for (jsize i = 0; i < n; i++) {
        common_chat_msg m;
        m.role = jstr(env, (jstring) env->GetObjectArrayElement(jroles, i));
        m.content = jstr(env, (jstring) env->GetObjectArrayElement(jtextos, i));
        in.messages.push_back(m);
    }
    in.add_generation_prompt = true;
    in.use_jinja = true;
    in.enable_thinking = pensar;
    std::string prompt;
    std::vector<std::string> paradas;
    try {
        common_chat_params p = common_chat_templates_apply(g_tmpls.get(), in);
        prompt = p.prompt.str();
        paradas = p.additional_stops;
    } catch (const std::exception & e) {
        // plantilla jinja rara: la sencilla de llama.cpp
        try { in.use_jinja = false; common_chat_params p = common_chat_templates_apply(g_tmpls.get(), in); prompt = p.prompt.str(); }
        catch (const std::exception & e2) { g_last_error = std::string("plantilla: ") + e2.what(); return jnew(env, ""); }
    }

    // 2) a tokens; se reutiliza lo que ya estaba (el comienzo igual)
    std::vector<llama_token> toks = common_tokenize(g_ctx, prompt, true, true);
    const int espacio = g_nctx - std::max(64, (int) max_tokens) - 8;
    if ((int) toks.size() > espacio) {
        g_last_error = "la conversación es muy larga para este modelo";
        LOGE("prompt de %d tokens, cabe %d", (int) toks.size(), espacio);
        return jnew(env, "");
    }
    size_t comun = 0;
    while (comun < g_prev.size() && comun < toks.size() && g_prev[comun] == toks[comun]) comun++;
    if (comun == toks.size() && comun > 0) comun--;                   // el último se decodifica otra vez para tener sus logits
    llama_memory_seq_rm(llama_get_memory(g_ctx), 0, (llama_pos) comun, -1);
    g_prev.resize(comun);
    if (decodificar(toks, (int) comun, true) != 0) {
        g_prev.clear();
        llama_memory_clear(llama_get_memory(g_ctx), false);
        g_last_error = g_stop.load() ? "detenido" : "falló al leer la conversación";
        return jnew(env, "");
    }
    g_prev = toks;

    // 3) generar
    common_params_sampling sp;
    sp.temp = temp;
    sp.top_k = 40; sp.top_p = 0.95f; sp.min_p = 0.05f;
    sp.penalty_repeat = 1.08f; sp.penalty_last_n = 128;
    common_sampler * smpl = common_sampler_init(g_model, sp);

    jclass cls = escucha ? env->GetObjectClass(escucha) : nullptr;
    jmethodID mtoken = cls ? env->GetMethodID(cls, "token", "(Ljava/lang/String;)Z") : nullptr;
    const llama_vocab * vocab = llama_model_get_vocab(g_model);
    std::string salida, pendiente;
    common_batch batch(g_ctx);
    int pos = (int) toks.size();
    for (int k = 0; k < max_tokens && !g_stop.load(); k++) {
        if (pos >= g_nctx - 2) break;
        const llama_token t = common_sampler_sample(smpl, g_ctx, -1);
        common_sampler_accept(smpl, t, true);
        if (llama_vocab_is_eog(vocab, t)) break;
        pendiente += common_token_to_piece(g_ctx, t, false);
        const size_t inc = utf8_incompleto(pendiente);
        salida += pendiente.substr(0, pendiente.size() - inc);
        pendiente = pendiente.substr(pendiente.size() - inc);
        bool parar = false;
        for (const auto & s : paradas) {
            if (!s.empty() && salida.size() >= s.size() && salida.compare(salida.size() - s.size(), s.size(), s) == 0) { salida.resize(salida.size() - s.size()); parar = true; }
        }
        batch.clear();
        batch.add(t, pos, 0, true);
        if (llama_process(g_ctx, LLAMA_PROCESS_TYPE_DECODE, batch.get()) != 0) { g_last_error = "falló al generar"; break; }
        g_prev.push_back(t);
        pos++;
        if (parar) break;
        if (mtoken && (k % 2 == 1)) {
            jstring js = jnew(env, salida);
            const jboolean seguir = env->CallBooleanMethod(escucha, mtoken, js);
            env->DeleteLocalRef(js);
            if (env->ExceptionCheck()) { env->ExceptionClear(); break; }
            if (!seguir) break;
        }
    }
    common_sampler_free(smpl);
    if (cls) env->DeleteLocalRef(cls);
    return jnew(env, salida);
}

/** Qué tan rápido va este celular con el modelo cargado: palabras (tokens) por segundo al leer y al escribir. */
extern "C" JNIEXPORT jstring JNICALL
Java_co_jarvis_motores_Llama_prueba(JNIEnv * env, jclass, jint pp, jint tg) {
    std::lock_guard<std::mutex> lk(g_mx);
    if (!g_model || !g_ctx) return jnew(env, "{}");
    llama_memory_clear(llama_get_memory(g_ctx), false);
    g_prev.clear();
    common_batch batch(g_ctx);
    pp = std::min((int) pp, std::min(BATCH, g_nctx / 2));
    batch.clear();
    for (int i = 0; i < pp; i++) batch.add(0, i, 0, i == pp - 1);
    const int64_t t0 = ggml_time_us();
    llama_process(g_ctx, LLAMA_PROCESS_TYPE_DECODE, batch.get());
    const int64_t t1 = ggml_time_us();
    for (int i = 0; i < tg; i++) {
        batch.clear();
        batch.add(0, pp + i, 0, true);
        llama_process(g_ctx, LLAMA_PROCESS_TYPE_DECODE, batch.get());
    }
    const int64_t t2 = ggml_time_us();
    llama_memory_clear(llama_get_memory(g_ctx), false);
    char desc[128]; llama_model_desc(g_model, desc, sizeof(desc));
    std::ostringstream o;
    o << std::fixed << std::setprecision(1)
      << "{\"leer\":" << (pp / ((t1 - t0) / 1e6)) << ",\"escribir\":" << (tg / ((t2 - t1) / 1e6))
      << ",\"gb\":" << (double) llama_model_size(g_model) / 1073741824.0
      << ",\"desc\":\"" << desc << "\"}";
    return jnew(env, o.str());
}

extern "C" JNIEXPORT jstring JNICALL
Java_co_jarvis_motores_Llama_info(JNIEnv * env, jclass) { return jnew(env, llama_print_system_info()); }

extern "C" JNIEXPORT jstring JNICALL
Java_co_jarvis_motores_Llama_error(JNIEnv * env, jclass) { return jnew(env, g_last_error); }

extern "C" JNIEXPORT void JNICALL
Java_co_jarvis_motores_Llama_liberar(JNIEnv *, jclass) {
    g_stop.store(true);
    std::lock_guard<std::mutex> lk(g_mx);
    liberar_todo();
}

// ============================================================================ 3.30 · BÚSQUEDA POR SIGNIFICADO
// Un segundo modelo, solo para «embeddings» (EmbeddingGemma 300M): convierte un texto en un vector de números;
// textos que dicen lo mismo con otras palabras quedan cerca. Va aparte del modelo de conversación.
static llama_model   * g_emodel = nullptr;
static llama_context * g_ectx = nullptr;
static std::mutex      g_emx;
static int             g_ectx_n = 1024;

static void liberar_emb() {
    if (g_ectx) { llama_free(g_ectx); g_ectx = nullptr; }
    if (g_emodel) { llama_model_free(g_emodel); g_emodel = nullptr; }
}

/** → 0 bien; 1 no cargó el modelo; 2 sin memoria; 3 el modelo no sirve para embeddings. */
extern "C" JNIEXPORT jint JNICALL
Java_co_jarvis_motores_Llama_cargarEmb(JNIEnv * env, jclass, jstring jruta, jint hilos) {
    std::lock_guard<std::mutex> lk(g_emx);
    liberar_emb();
    llama_model_params mp = llama_model_default_params();
    mp.n_gpu_layers = 0;
    const std::string ruta = jstr(env, jruta);
    g_emodel = llama_model_load_from_file(ruta.c_str(), mp);
    if (!g_emodel) return 1;
    const int entrenado = llama_model_n_ctx_train(g_emodel);
    g_ectx_n = std::max(256, std::min(1024, entrenado > 0 ? entrenado : 1024));
    llama_context_params cp = llama_context_default_params();
    int nh = hilos > 0 ? hilos : std::max(2, std::min(4, (int) sysconf(_SC_NPROCESSORS_ONLN) - 2));
    cp.n_ctx = g_ectx_n;
    cp.n_batch = g_ectx_n;
    cp.n_ubatch = g_ectx_n;                                  // sin causalidad: toda la frase en un solo lote
    cp.n_seq_max = 1;
    cp.n_threads = nh;
    cp.n_threads_batch = nh;
    cp.embeddings = true;
    g_ectx = llama_init_from_model(g_emodel, cp);
    if (!g_ectx) { liberar_emb(); return 2; }
    if (llama_pooling_type(g_ectx) == LLAMA_POOLING_TYPE_NONE) { liberar_emb(); return 3; }
    LOGI("modelo de búsqueda cargado: ctx %d, %d dimensiones", g_ectx_n, llama_model_n_embd_out(g_emodel));
    return 0;
}

/** El vector (normalizado, largo 1) de un texto; null si falla. */
extern "C" JNIEXPORT jfloatArray JNICALL
Java_co_jarvis_motores_Llama_embeber(JNIEnv * env, jclass, jstring jtexto) {
    std::lock_guard<std::mutex> lk(g_emx);
    if (!g_ectx) return nullptr;
    std::vector<llama_token> toks = common_tokenize(g_ectx, jstr(env, jtexto), true, true);
    if (toks.empty()) return nullptr;
    if ((int) toks.size() > g_ectx_n) toks.resize(g_ectx_n);
    llama_memory_clear(llama_get_memory(g_ectx), true);
    common_batch batch(g_ectx);
    batch.clear();
    for (int i = 0; i < (int) toks.size(); i++) batch.add(toks[i], i, 0, true);
    if (llama_process(g_ectx, LLAMA_PROCESS_TYPE_DECODE, batch.get()) < 0) return nullptr;
    const float * e = llama_get_embeddings_seq(g_ectx, 0);
    if (!e) return nullptr;
    const int n = llama_model_n_embd_out(g_emodel);
    std::vector<float> out(n);
    common_embd_normalize(e, out.data(), n, 2);
    jfloatArray r = env->NewFloatArray(n);
    env->SetFloatArrayRegion(r, 0, n, out.data());
    return r;
}

extern "C" JNIEXPORT void JNICALL
Java_co_jarvis_motores_Llama_liberarEmb(JNIEnv *, jclass) { std::lock_guard<std::mutex> lk(g_emx); liberar_emb(); }
