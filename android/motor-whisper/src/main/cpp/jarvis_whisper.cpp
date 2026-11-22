// Jarvis 3.29 · dictado sin internet con whisper.cpp (licencia MIT), como PocketPal AI.
// Audio de 16 kHz (mono, float) → texto en el idioma pedido.
#include <jni.h>
#include <mutex>
#include <string>
#include <thread>
#include "whisper.h"

static whisper_context * g_w = nullptr;
static std::mutex g_mx;

static std::string jstr(JNIEnv * env, jstring s) {
    if (!s) return "";
    const char * c = env->GetStringUTFChars(s, nullptr);
    std::string r(c ? c : "");
    if (c) env->ReleaseStringUTFChars(s, c);
    return r;
}
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

extern "C" JNIEXPORT jint JNICALL
Java_co_jarvis_motores_Whisper_cargar(JNIEnv * env, jclass, jstring jruta) {
    std::lock_guard<std::mutex> lk(g_mx);
    if (g_w) { whisper_free(g_w); g_w = nullptr; }
    whisper_context_params cp = whisper_context_default_params();
    cp.use_gpu = false;
    const std::string ruta = jstr(env, jruta);
    g_w = whisper_init_from_file_with_params(ruta.c_str(), cp);
    return g_w ? 0 : 1;
}

/** pcm: 16 kHz mono en [-1, 1]. idioma: "es", "en"… o "auto". pista: palabras que ayudan (nombres, «Jarvis»). */
extern "C" JNIEXPORT jstring JNICALL
Java_co_jarvis_motores_Whisper_transcribir(JNIEnv * env, jclass, jfloatArray jpcm, jstring jidioma, jint hilos, jstring jpista) {
    std::lock_guard<std::mutex> lk(g_mx);
    if (!g_w) return jnew(env, "");
    const std::string idioma = jstr(env, jidioma), pista = jstr(env, jpista);
    whisper_full_params p = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    p.print_realtime = false; p.print_progress = false; p.print_timestamps = false; p.print_special = false;
    p.translate = false;
    p.language = idioma.empty() ? "es" : idioma.c_str();
    p.detect_language = idioma == "auto";
    int nh = hilos > 0 ? hilos : (int) std::max(2u, std::min(4u, std::thread::hardware_concurrency()));
    p.n_threads = nh;
    p.no_context = true;
    p.single_segment = false;
    p.suppress_blank = true;
    p.no_timestamps = true;
    if (!pista.empty()) p.initial_prompt = pista.c_str();
    jsize n = env->GetArrayLength(jpcm);
    jfloat * pcm = env->GetFloatArrayElements(jpcm, nullptr);
    int r = whisper_full(g_w, p, pcm, n);
    env->ReleaseFloatArrayElements(jpcm, pcm, JNI_ABORT);
    if (r != 0) return jnew(env, "");
    std::string out;
    const int ns = whisper_full_n_segments(g_w);
    for (int i = 0; i < ns; i++) out += whisper_full_get_segment_text(g_w, i);
    // quita los espacios del comienzo y las «alucinaciones» típicas del silencio
    size_t a = out.find_first_not_of(" \t\n");
    out = a == std::string::npos ? "" : out.substr(a);
    return jnew(env, out);
}

extern "C" JNIEXPORT void JNICALL
Java_co_jarvis_motores_Whisper_liberar(JNIEnv *, jclass) {
    std::lock_guard<std::mutex> lk(g_mx);
    if (g_w) { whisper_free(g_w); g_w = nullptr; }
}
