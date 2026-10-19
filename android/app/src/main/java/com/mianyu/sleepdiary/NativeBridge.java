package com.mianyu.sleepdiary;

import android.webkit.JavascriptInterface;

/**
 * The only surface exposed to the local web app. All methods are deliberately
 * narrow: HTTP POST for the user's own AI endpoint, SAF backup read/write and
 * system-bar colours. No arbitrary file paths or storage permissions.
 */
public final class NativeBridge {
    private final MainActivity activity;

    NativeBridge(MainActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void postJson(String requestId, String url, String headersJson, String body) {
        activity.nativePostJson(requestId, url, headersJson, body);
    }

    @JavascriptInterface
    public void saveTextFile(String requestId, String fileName, String mimeType, String content) {
        activity.nativeSaveTextFile(requestId, fileName, mimeType, content);
    }

    @JavascriptInterface
    public void pickTextFile(String requestId) {
        activity.nativePickTextFile(requestId);
    }

    @JavascriptInterface
    public void setSystemBars(String color, boolean dark) {
        activity.nativeSetSystemBars(color, dark);
    }
}
