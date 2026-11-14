package cl.dacaram.entrenavozv2;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.JavascriptInterface;
import android.view.WindowManager;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import java.util.Locale;

public class MainActivity extends Activity {
    private WebView web;
    private TextToSpeech tts;
    private volatile boolean speechReady = false;

    private void informBrowser(int id) {
        runOnUiThread(() -> { if(web != null) web.evaluateJavascript("window.__nativeTtsComplete(" + id + ")", null); });
    }
    public class VoiceBridge {
        @JavascriptInterface public void speak(String message, int id, double rate) {
            runOnUiThread(() -> {
                if (tts == null || !speechReady) { informBrowser(id); return; }
                tts.setSpeechRate((float)Math.max(.75, Math.min(1.3,rate)));
                android.os.Bundle params = new android.os.Bundle();
                int result = tts.speak(message, TextToSpeech.QUEUE_FLUSH, params, String.valueOf(id));
                if (result == TextToSpeech.ERROR) informBrowser(id);
            });
        }
        @JavascriptInterface public void stop() { runOnUiThread(() -> { if(tts != null) tts.stop(); }); }
    }
    @Override protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(android.graphics.Color.rgb(8,19,33));
        getWindow().setNavigationBarColor(android.graphics.Color.rgb(8,19,33));
        web = new WebView(this);
        web.setBackgroundColor(android.graphics.Color.rgb(8,19,33));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setMediaPlaybackRequiresUserGesture(false);
        web.getSettings().setAllowFileAccess(true);
        web.getSettings().setDefaultTextEncodingName("utf-8");
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new VoiceBridge(), "AndroidSpeech");
        setContentView(web);
        tts = new TextToSpeech(getApplicationContext(), status -> {
            if(status == TextToSpeech.SUCCESS) {
                int result = tts.setLanguage(Locale.forLanguageTag("es-CL"));
                if(result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED)
                    tts.setLanguage(new Locale("es", "ES"));
                speechReady=true;
            }
        });
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) {}
            @Override public void onDone(String id) { try { informBrowser(Integer.parseInt(id)); } catch(Exception ignored) {} }
            @Override public void onError(String id) { try { informBrowser(Integer.parseInt(id)); } catch(Exception ignored) {} }
        });
        web.loadUrl("file:///android_asset/index.html");
    }
    @Override protected void onPause() { super.onPause(); if(tts!=null)tts.stop(); }
    @Override protected void onDestroy() {
        if(tts!=null){tts.stop();tts.shutdown();tts=null;}
        if(web!=null){web.destroy();web=null;}
        super.onDestroy();
    }
}
