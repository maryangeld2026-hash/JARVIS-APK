package co.jarvis.docente;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;

/** Jarvis: el servicio que mantiene la burbuja flotando (con su aviso fijo, como pide Android). */
public class BurbujaService extends Service {

    private static final String CANAL = "jarvis_burbuja";
    private WindowManager wm;
    private View burbuja;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        aviso();
        if (burbuja == null) crear();
        return START_STICKY;
    }

    private Intent abrirJarvis() {
        Intent i = new Intent(this, MainActivity.class);
        i.putExtra(BurbujaPlugin.EXTRA_TOQUE, true);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        return i;
    }

    private void aviso() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            NotificationChannel ch = new NotificationChannel(CANAL, "Burbuja de Jarvis", NotificationManager.IMPORTANCE_MIN);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getActivity(this, 7, abrirJarvis(), flags);
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(this, CANAL) : new Notification.Builder(this);
        Notification n = b.setSmallIcon(R.mipmap.ic_launcher_foreground)
            .setContentTitle("Jarvis está a la mano")
            .setContentText("Toca la burbuja para hablarle. Para quitarla: «quita la burbuja».")
            .setContentIntent(pi)
            .setOngoing(true)
            .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(71, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(71, n);
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private void crear() {
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        float d = getResources().getDisplayMetrics().density;
        int tam = (int) (60 * d);

        FrameLayout cont = new FrameLayout(this);
        GradientDrawable fondo = new GradientDrawable();
        fondo.setShape(GradientDrawable.OVAL);
        fondo.setColor(0xEE03060C);
        fondo.setStroke((int) (2 * d), 0xFF2EE6FF);
        cont.setBackground(fondo);
        cont.setElevation(8 * d);
        ImageView icono = new ImageView(this);
        icono.setImageResource(R.mipmap.ic_launcher_foreground);
        icono.setScaleType(ImageView.ScaleType.CENTER_CROP);
        cont.addView(icono, new FrameLayout.LayoutParams(tam, tam));

        int tipo = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        final WindowManager.LayoutParams lp = new WindowManager.LayoutParams(tam, tam, tipo,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.START;
        lp.x = getResources().getDisplayMetrics().widthPixels - tam - (int) (12 * d);
        lp.y = (int) (getResources().getDisplayMetrics().heightPixels * 0.55);

        cont.setOnTouchListener(new View.OnTouchListener() {
            private int x0, y0;
            private float tx, ty;
            private boolean movio;

            @Override
            public boolean onTouch(View v, MotionEvent e) {
                switch (e.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        x0 = lp.x; y0 = lp.y; tx = e.getRawX(); ty = e.getRawY(); movio = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        int dx = (int) (e.getRawX() - tx), dy = (int) (e.getRawY() - ty);
                        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) movio = true;
                        lp.x = x0 + dx; lp.y = y0 + dy;
                        wm.updateViewLayout(burbuja, lp);
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (!movio) startActivity(abrirJarvis());
                        return true;
                }
                return false;
            }
        });
        burbuja = cont;
        wm.addView(burbuja, lp);
    }

    @Override
    public void onDestroy() {
        if (burbuja != null && wm != null) {
            try { wm.removeView(burbuja); } catch (Exception ignored) { }
            burbuja = null;
        }
        super.onDestroy();
    }
}
