package co.jarvis.docente;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

/**
 * Jarvis: la actividad de Capacitor, con dos agregados
 *  · reenvía al inicio de sesión de Google la respuesta de los permisos (Calendario, Classroom, Forms, Drive);
 *  · registra la burbuja flotante y le avisa cuando la tocaste (la app se abre para escucharte);
 *  · registra «Jarvis» en segundo plano y, cuando te oye, se muestra aunque el celular esté bloqueado.
 */
public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BurbujaPlugin.class);
        registerPlugin(EscuchaPlugin.class);
        registerPlugin(OidoPlugin.class);
        registerPlugin(IALocalPlugin.class);
        registerPlugin(VentanaPlugin.class);
        registerPlugin(CalendarioPlugin.class);
        registerPlugin(EscanerPlugin.class);
        super.onCreate(savedInstanceState);
        // 3.0.2: con la letra del celular muy grande, la barra de arriba no cabía y el botón de Ajustes quedaba por fuera
        try {
            android.webkit.WebSettings ws = getBridge().getWebView().getSettings();
            ws.setTextZoom(Math.min(ws.getTextZoom(), 115));
        } catch (Exception ignored) { }
        BurbujaPlugin.revisarToque(getIntent());
        porDespertar(getIntent());
        entrada(getIntent());
        SilencioReceiver.programar(this);
    }

    /** 3.4: atajos, widget, botón de asistente y «Compartir › Jarvis» (lo compartido se lee en otro hilo). */
    private void entrada(Intent intent) {
        if (intent == null) return;
        final Intent copia = new Intent(intent);
        intent.removeExtra("atajo");
        if (Intent.ACTION_SEND.equals(intent.getAction()) || Intent.ACTION_SEND_MULTIPLE.equals(intent.getAction())) {
            intent.setAction(Intent.ACTION_MAIN);
            new Thread(() -> VentanaPlugin.recibir(getApplicationContext(), copia), "jarvis-compartir").start();
        } else VentanaPlugin.recibir(getApplicationContext(), copia);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        BurbujaPlugin.revisarToque(intent);
        porDespertar(intent);
        entrada(intent);
    }

    /** Si se abrió porque dijiste «Jarvis»: se muestra aunque el celular esté bloqueado y enciende la pantalla. */
    private void porDespertar(Intent intent) {
        if (intent == null || !intent.getBooleanExtra(EscuchaPlugin.EXTRA_DESPERTAR, false)) return;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        EscuchaPlugin.revisar(intent);
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == EscanerPlugin.REQ) { EscanerPlugin.resultado(resultCode, data); return; }
        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            PluginHandle handle = getBridge().getPlugin("SocialLogin");
            if (handle == null) return;
            Plugin plugin = handle.getInstance();
            if (!(plugin instanceof SocialLoginPlugin)) return;
            ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
        }
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
