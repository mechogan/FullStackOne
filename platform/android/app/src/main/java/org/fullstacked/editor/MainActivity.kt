package org.fullstacked.editor

import android.annotation.SuppressLint
import android.content.res.AssetManager
import android.graphics.Color
import android.os.Bundle
import android.webkit.MimeTypeMap
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import java.io.IOException
import java.io.InputStream

class MainActivity : ComponentActivity() {
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val webView = WebView(this)
        webView.setBackgroundColor(Color.TRANSPARENT)
        webView.webViewClient = WebViewClientCustom(this.assets)
        webView.settings.javaScriptEnabled = true
        webView.loadUrl("http://localhost")
        setContentView(webView)
    }
}

class WebViewClientCustom(assetManager: AssetManager) : WebViewClient() {
    private val assetsManager: AssetManager = assetManager;

    override fun shouldInterceptRequest(
        view: WebView?,
        request: WebResourceRequest?
    ): WebResourceResponse? {
        if(request?.url?.host != "localhost") return super.shouldInterceptRequest(view, request);

        val path = request.url?.path.toString()

        var pathname = path.split("?").first()
        if(pathname.endsWith("/")){
            pathname = pathname.slice(0..<pathname.length - 1)
        }
        if(pathname.startsWith("/")) {
            pathname = pathname.slice(1..<pathname.length)
        }

        val getFile: (String) -> InputStream? = { assetPath ->
            try {
                this.assetsManager.open(assetPath)
            } catch (e: IOException) {
                null
            }
        }

        val maybeIndexHTML = (if(pathname.isEmpty()) "" else "$pathname/") + "index.html"
        var inputStream: InputStream? = getFile(maybeIndexHTML)
        if(inputStream != null){
            pathname = maybeIndexHTML
        } else {
            inputStream = getFile(pathname)
        }

        if(inputStream == null) {
            return super.shouldInterceptRequest(view, request)
        }

        val ext = MimeTypeMap.getFileExtensionFromUrl(pathname)

        return WebResourceResponse(MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext), "utf-8", inputStream)
    }
}