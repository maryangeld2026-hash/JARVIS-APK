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
        super.onCreate(savedInstanceState);
        BurbujaPlugin.revisarToque(getIntent());
        porDespertar(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        BurbujaPlugin.revisarToque(intent);
        porDespertar(intent);
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
