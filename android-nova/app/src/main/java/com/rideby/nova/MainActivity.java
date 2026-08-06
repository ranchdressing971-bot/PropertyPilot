package com.rideby.nova;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

import java.util.Locale;
import java.util.UUID;

/**
 * Full-screen Nova shell for a burner phone — Alexa-style always-on mic page.
 */
public class MainActivity extends AppCompatActivity {
    private static final int REQ_MIC = 42;
    private WebView webView;
    private PermissionRequest pendingWebPermission;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private String pendingSpeakText = null;
    private String currentUtteranceId = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webView = new WebView(this);
        setContentView(webView);
        enterImmersive();
        setupWebView();

        if (hasMicPermission()) {
            loadNova();
        } else {
            ActivityCompat.requestPermissions(
                this,
                new String[]{Manifest.permission.RECORD_AUDIO},
                REQ_MIC
            );
        }
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " RideByNova/1.0");

        if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
            WebSettingsCompat.setForceDark(settings, WebSettingsCompat.FORCE_DARK_OFF);
        }

        initTts();
        webView.addJavascriptInterface(new NovaNativeBridge(), "NovaNative");

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean wantsAudio = false;
                    for (String res : request.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) {
                            wantsAudio = true;
                            break;
                        }
                    }
                    if (!wantsAudio) {
                        request.deny();
                        return;
                    }
                    if (hasMicPermission()) {
                        request.grant(request.getResources());
                    } else {
                        pendingWebPermission = request;
                        ActivityCompat.requestPermissions(
                            MainActivity.this,
                            new String[]{Manifest.permission.RECORD_AUDIO},
                            REQ_MIC
                        );
                    }
                });
            }
        });
    }

    private void initTts() {
        tts = new TextToSpeech(this, status -> {
            if (status != TextToSpeech.SUCCESS || tts == null) {
                ttsReady = false;
                notifySpeakDone();
                return;
            }
            int lang = tts.setLanguage(Locale.US);
            if (lang == TextToSpeech.LANG_MISSING_DATA || lang == TextToSpeech.LANG_NOT_SUPPORTED) {
                lang = tts.setLanguage(Locale.getDefault());
            }
            ttsReady = lang != TextToSpeech.LANG_MISSING_DATA
                && lang != TextToSpeech.LANG_NOT_SUPPORTED;

            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String utteranceId) {
                    // no-op
                }

                @Override
                public void onDone(String utteranceId) {
                    onUtteranceFinished(utteranceId);
                }

                @Override
                @Deprecated
                public void onError(String utteranceId) {
                    onUtteranceFinished(utteranceId);
                }

                @Override
                public void onError(String utteranceId, int errorCode) {
                    onUtteranceFinished(utteranceId);
                }

                @Override
                public void onStop(String utteranceId, boolean interrupted) {
                    onUtteranceFinished(utteranceId);
                }
            });

            if (pendingSpeakText != null) {
                String queued = pendingSpeakText;
                pendingSpeakText = null;
                if (ttsReady) {
                    speakInternal(queued);
                } else {
                    notifySpeakDone();
                }
            }
        });
    }

    private void speakInternal(String text) {
        if (text == null) return;
        String clipped = text.trim();
        if (clipped.isEmpty()) {
            notifySpeakDone();
            return;
        }
        if (clipped.length() > 2500) {
            clipped = clipped.substring(0, 2500);
        }

        if (tts == null || !ttsReady) {
            pendingSpeakText = clipped;
            return;
        }

        currentUtteranceId = UUID.randomUUID().toString();
        Bundle params = new Bundle();
        tts.speak(clipped, TextToSpeech.QUEUE_FLUSH, params, currentUtteranceId);
    }

    private void stopTts() {
        pendingSpeakText = null;
        String id = currentUtteranceId;
        currentUtteranceId = null;
        if (tts != null) {
            tts.stop();
        }
        if (id != null) {
            notifySpeakDone();
        }
    }

    private void onUtteranceFinished(String utteranceId) {
        if (utteranceId == null) return;
        synchronized (this) {
            if (!utteranceId.equals(currentUtteranceId)) return;
            currentUtteranceId = null;
        }
        notifySpeakDone();
    }

    private void notifySpeakDone() {
        runOnUiThread(() -> {
            if (webView == null) return;
            webView.evaluateJavascript(
                "(function(){try{if(typeof window.__novaOnSpeakDone==='function')"
                    + "{window.__novaOnSpeakDone();}}catch(e){}})();",
                null
            );
        });
    }

    /**
     * Bridge for free device TTS when Web Speech API has no voices in WebView.
     * JS: window.NovaNative.speak(text) / stop(); done via window.__novaOnSpeakDone.
     */
    private class NovaNativeBridge {
        @JavascriptInterface
        public void speak(String text) {
            runOnUiThread(() -> speakInternal(text));
        }

        @JavascriptInterface
        public void stop() {
            runOnUiThread(() -> stopTts());
        }
    }

    private void loadNova() {
        webView.loadUrl(getString(R.string.nova_url));
    }

    private boolean hasMicPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            == PackageManager.PERMISSION_GRANTED;
    }

    private void enterImmersive() {
        View decor = getWindow().getDecorView();
        decor.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersive();
    }

    @Override
    public void onConfigurationChanged(@NonNull Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Keep immersive fullscreen after rotate; WebView resizes in place.
        enterImmersive();
        if (webView != null) {
            webView.requestLayout();
        }
    }

    @Override
    public void onRequestPermissionsResult(
        int requestCode,
        @NonNull String[] permissions,
        @NonNull int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_MIC) return;

        boolean granted = grantResults.length > 0
            && grantResults[0] == PackageManager.PERMISSION_GRANTED;

        if (pendingWebPermission != null) {
            if (granted) {
                pendingWebPermission.grant(pendingWebPermission.getResources());
            } else {
                pendingWebPermission.deny();
                Toast.makeText(this, "Mic permission needed for Nova", Toast.LENGTH_LONG).show();
            }
            pendingWebPermission = null;
        }

        if (granted) {
            if (webView.getUrl() == null) loadNova();
        } else {
            Toast.makeText(this, "Allow microphone so Nova can listen", Toast.LENGTH_LONG).show();
            loadNova();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        pendingSpeakText = null;
        currentUtteranceId = null;
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
        ttsReady = false;
        super.onDestroy();
    }
}
