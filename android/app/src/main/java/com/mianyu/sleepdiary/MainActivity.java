package com.mianyu.sleepdiary;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Insets;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {

    private static final String APP_HOST = "app.local";
    private static final String START_URL = "https://app.local/index.html";
    private static final String PREFS_NAME = "mianyu_native";
    private static final String PREF_BAR_COLOR = "bar_color";
    private static final String PREF_BAR_DARK = "bar_dark";
    private static final int REQUEST_SAVE = 41;
    private static final int REQUEST_OPEN = 42;
    private static final int MAX_HTTP_BYTES = 4 * 1024 * 1024;
    private static final int MAX_BACKUP_BYTES = 8 * 1024 * 1024;

    private FrameLayout root;
    private WebView webView;
    private ExecutorService io;
    private SharedPreferences prefs;
    private int barColor;
    private boolean barDark;
    private boolean webViewRevealed;

    private String pendingSaveId;
    private String pendingSaveName;
    private String pendingSaveMime;
    private String pendingSaveContent;
    private String pendingOpenId;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        io = Executors.newCachedThreadPool();
        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        barColor = prefs.getInt(PREF_BAR_COLOR, getColor(R.color.app_background));
        barDark = prefs.getBoolean(PREF_BAR_DARK, false);

        configureWindow();

        root = new FrameLayout(this);
        root.setBackgroundColor(barColor);
        webView = new WebView(this);
        configureWebView();
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));
        setContentView(root);
        setupInsets();
        applySystemBarPalette(barColor, barDark, false);

        webView.loadUrl(START_URL);
        root.postDelayed(this::revealWebView, 2600);
    }

    private void configureWindow() {
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            window.setNavigationBarColor(Color.TRANSPARENT);
        } else {
            window.setNavigationBarColor(Color.BLACK);
        }
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attributes = window.getAttributes();
            attributes.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(attributes);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false);
        } else {
            int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
            window.getDecorView().setSystemUiVisibility(flags);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadsImagesAutomatically(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setTextZoom(100);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setGeolocationEnabled(false);
        settings.setSaveFormData(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " MianyuApp/0.2.0");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            settings.setForceDark(WebSettings.FORCE_DARK_OFF);
        }

        webView.setBackgroundColor(barColor);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setAlpha(0f);
        WebView.setWebContentsDebuggingEnabled(false);
        webView.addJavascriptInterface(new NativeBridge(this), "MianyuNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) return null;
                if (!APP_HOST.equals(uri.getHost())) return emptyResponse(403, "Blocked");
                return serveAsset(uri);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !APP_HOST.equals(request.getUrl().getHost());
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !APP_HOST.equals(Uri.parse(url).getHost());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (APP_HOST.equals(Uri.parse(url).getHost())) {
                    view.postDelayed(MainActivity.this::revealWebView, 80);
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
    }

    private void revealWebView() {
        if (webViewRevealed || webView == null) return;
        webViewRevealed = true;
        webView.animate().alpha(1f).setDuration(190).start();
    }

    private void setupInsets() {
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            int left = 0;
            int top = 0;
            int right = 0;
            int bottom = 0;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Insets bars = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                Insets ime = insets.getInsets(WindowInsets.Type.ime());
                left = bars.left;
                top = bars.top;
                right = bars.right;
                bottom = Math.max(bars.bottom, ime.bottom);
            } else {
                left = insets.getSystemWindowInsetLeft();
                top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight();
                bottom = Math.max(insets.getSystemWindowInsetBottom(), 0);
            }
            view.setPadding(left, top, right, bottom);
            return insets;
        });
        root.requestApplyInsets();
    }

    private WebResourceResponse serveAsset(Uri uri) {
        String path = uri.getPath();
        if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
        if (path.contains("..") || path.contains("\\")) return emptyResponse(404, "Not Found");

        try {
            InputStream stream = getAssets().open("www" + path);
            String mime = mimeType(path);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            String encoding = isTextMime(mime) ? "UTF-8" : null;
            return new WebResourceResponse(mime, encoding, 200, "OK", headers, stream);
        } catch (IOException error) {
            return emptyResponse(404, "Not Found");
        }
    }

    private WebResourceResponse emptyResponse(int status, String reason) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        return new WebResourceResponse(
                "text/plain", "UTF-8", status, reason, headers,
                new ByteArrayInputStream(new byte[0])
        );
    }

    private static String mimeType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "text/javascript";
        if (lower.endsWith(".json") || lower.endsWith(".webmanifest")) return "application/json";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".ico")) return "image/x-icon";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".ttf")) return "font/ttf";
        return "application/octet-stream";
    }

    private static boolean isTextMime(String mime) {
        return mime.startsWith("text/")
                || "application/json".equals(mime)
                || "image/svg+xml".equals(mime);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript(
                "(function(){try{return !!(window.mianyuHandleBack && window.mianyuHandleBack());}catch(e){return false}})()",
                value -> {
                    if ("true".equals(value)) return;
                    if (webView.canGoBack()) webView.goBack();
                    else moveTaskToBack(true);
                }
        );
    }

    /* ------------------------------------------------------------------
       Native bridge callbacks
       ------------------------------------------------------------------ */

    void nativePostJson(String requestId, String url, String headersJson, String body) {
        io.execute(() -> performPost(requestId, url, headersJson, body));
    }

    private void performPost(String requestId, String urlString, String headersJson, String body) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(urlString);
            if (!"http".equalsIgnoreCase(url.getProtocol()) && !"https".equalsIgnoreCase(url.getProtocol())) {
                throw new IllegalArgumentException("Only http(s) endpoints are supported");
            }
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(20000);
            connection.setReadTimeout(45000);
            connection.setDoOutput(true);
            connection.setDoInput(true);
            connection.setUseCaches(false);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("User-Agent", "Mianyu/0.2.0 (Android)");
            JSONObject headers = new JSONObject(headersJson == null || headersJson.isEmpty() ? "{}" : headersJson);
            Iterator<String> keys = headers.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                connection.setRequestProperty(key, headers.optString(key, ""));
            }

            byte[] requestBody = (body == null ? "" : body).getBytes(StandardCharsets.UTF_8);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(requestBody);
                output.flush();
            }

            int status = connection.getResponseCode();
            InputStream responseStream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            String responseBody = readLimited(responseStream, MAX_HTTP_BYTES);
            notifyHttp(requestId, true, status, responseBody, "");
        } catch (Exception error) {
            notifyHttp(requestId, false, 0, "", readableError(error));
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private void notifyHttp(String requestId, boolean networkOk, int status, String body, String error) {
        String js = "window.__mianyuHttpResult("
                + quote(requestId) + ","
                + networkOk + ","
                + status + ","
                + quote(body) + ","
                + quote(error) + ");";
        callJavascript(js);
    }

    void nativeSaveTextFile(String requestId, String fileName, String mimeType, String content) {
        runOnUiThread(() -> {
            if (pendingSaveId != null) {
                notifyFile(pendingSaveId, false, "", "cancelled");
            }
            pendingSaveId = requestId;
            pendingSaveName = fileName;
            pendingSaveMime = mimeType;
            pendingSaveContent = content;
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(mimeType == null || mimeType.isEmpty() ? "application/json" : mimeType);
            intent.putExtra(Intent.EXTRA_TITLE,
                    fileName == null || fileName.isEmpty() ? "mianyu-backup.json" : fileName);
            try {
                startActivityForResult(intent, REQUEST_SAVE);
            } catch (ActivityNotFoundException error) {
                pendingSaveId = null;
                pendingSaveContent = null;
                notifyFile(requestId, false, "", "没有可用的文件选择器");
            }
        });
    }

    void nativePickTextFile(String requestId) {
        runOnUiThread(() -> {
            if (pendingOpenId != null) {
                notifyFile(pendingOpenId, false, "", "cancelled");
            }
            pendingOpenId = requestId;
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                    "application/json", "text/plain", "application/octet-stream"
            });
            try {
                startActivityForResult(intent, REQUEST_OPEN);
            } catch (ActivityNotFoundException error) {
                pendingOpenId = null;
                notifyFile(requestId, false, "", "没有可用的文件选择器");
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_SAVE) {
            final String id = pendingSaveId;
            final String content = pendingSaveContent;
            pendingSaveId = null;
            pendingSaveContent = null;
            Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
            if (id == null) return;
            if (uri == null) {
                notifyFile(id, false, "", "cancelled");
                return;
            }
            io.execute(() -> {
                try (OutputStream output = getContentResolver().openOutputStream(uri)) {
                    if (output == null) throw new IOException("No output stream");
                    output.write((content == null ? "" : content).getBytes(StandardCharsets.UTF_8));
                    output.flush();
                    notifyFile(id, true, "", "");
                } catch (Exception error) {
                    notifyFile(id, false, "", readableError(error));
                }
            });
            return;
        }
        if (requestCode == REQUEST_OPEN) {
            final String id = pendingOpenId;
            pendingOpenId = null;
            Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
            if (id == null) return;
            if (uri == null) {
                notifyFile(id, false, "", "cancelled");
                return;
            }
            io.execute(() -> {
                try (InputStream input = getContentResolver().openInputStream(uri)) {
                    if (input == null) throw new IOException("No input stream");
                    String text = readLimited(input, MAX_BACKUP_BYTES);
                    if (text.startsWith("\uFEFF")) text = text.substring(1);
                    notifyFile(id, true, text, "");
                } catch (Exception error) {
                    notifyFile(id, false, "", readableError(error));
                }
            });
        }
    }

    private void notifyFile(String requestId, boolean ok, String data, String message) {
        String js = "window.__mianyuFileResult("
                + quote(requestId) + ","
                + ok + ","
                + quote(data) + ","
                + quote(message) + ");";
        callJavascript(js);
    }

    void nativeSetSystemBars(String color, boolean dark) {
        int parsed = barColor;
        try {
            parsed = Color.parseColor(color);
        } catch (Exception ignored) {
            // Fall back to the previous colour.
        }
        int finalColor = parsed;
        runOnUiThread(() -> applySystemBarPalette(finalColor, dark, true));
    }

    private void applySystemBarPalette(int color, boolean dark, boolean remember) {
        barColor = color;
        barDark = dark;
        if (root != null) root.setBackgroundColor(color);
        if (webView != null) webView.setBackgroundColor(color);
        Window window = getWindow();
        window.setBackgroundDrawable(new ColorDrawable(color));
        window.setStatusBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            window.setNavigationBarColor(Color.TRANSPARENT);
        } else {
            window.setNavigationBarColor(Color.BLACK);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(dark ? 0 : mask, mask);
            }
        } else {
            int flags = window.getDecorView().getSystemUiVisibility();
            flags |= View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
            if (dark) {
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            } else {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (dark) flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                else flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            window.getDecorView().setSystemUiVisibility(flags);
        }

        if (remember && prefs != null) {
            prefs.edit()
                    .putInt(PREF_BAR_COLOR, color)
                    .putBoolean(PREF_BAR_DARK, dark)
                    .apply();
        }
    }

    private String readLimited(InputStream input, int maxBytes) throws IOException {
        if (input == null) return "";
        try (InputStream in = input; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int total = 0;
            int read;
            while ((read = in.read(buffer)) != -1) {
                total += read;
                if (total > maxBytes) throw new IOException("内容过大");
                out.write(buffer, 0, read);
            }
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private void callJavascript(String js) {
        WebView current = webView;
        if (current == null) return;
        current.post(() -> {
            if (webView != null) webView.evaluateJavascript(js, null);
        });
    }

    private static String quote(String value) {
        return JSONObject.quote(value == null ? "" : value)
                .replace("\u2028", "\\u2028")
                .replace("\u2029", "\\u2029");
    }

    private static String readableError(Throwable error) {
        if (error == null) return "未知错误";
        String message = error.getMessage();
        if (message == null || message.trim().isEmpty()) return error.getClass().getSimpleName();
        return message.length() > 180 ? message.substring(0, 180) : message;
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            root.removeView(webView);
            webView.removeJavascriptInterface("MianyuNative");
            webView.destroy();
            webView = null;
        }
        if (io != null) io.shutdownNow();
        super.onDestroy();
    }
}
