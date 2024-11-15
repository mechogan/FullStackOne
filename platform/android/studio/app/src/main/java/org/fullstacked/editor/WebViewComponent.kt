package org.fullstacked.editor

import android.annotation.SuppressLint
import android.graphics.Color
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import java.nio.charset.StandardCharsets
import java.util.Base64

class WebViewComponent(val ctx: MainActivity, val instance: Instance) : WebViewClient() {
    val webView = createWebView(this)

    // https://stackoverflow.com/a/45506857
    // Bridging with Base64 seems faster...
    @JavascriptInterface
    fun bridge(payloadBase64: String) : String {
        val payload = Base64.getDecoder().decode(payloadBase64)
        val response = instance.callLib(payload)
        return Base64.getEncoder().encodeToString(response)
    }

    fun onMessage(messageType: String, message: String){
        val mainLooper = Looper.getMainLooper()
        val handler = Handler(mainLooper)
        handler.post {
            this.webView.evaluateJavascript("window.onmessage(`$messageType`, `$message`)", null)
        }
    }

    override fun shouldInterceptRequest(
        view: WebView?,
        request: WebResourceRequest?
    ): WebResourceResponse? {
        if(request?.url?.host != "localhost") {
            return super.shouldInterceptRequest(view, request)
        }

        val pathname = request.url?.path ?: "/"

        println("request: $pathname")

        if(pathname == "/platform") {
            return WebResourceResponse(
                "text/plain",
                "utf-8",
                "android".byteInputStream()
            )
        }


        // static file serving

        val pathnameData = pathname.toByteArray()
        var payload = byteArrayOf(
            1, // static file method
            2  // STRING
        )
        payload += numberToBytes(pathnameData.size)
        payload += pathnameData

        val response = this.instance.callLib(payload)
        val args = deserializeArgs(response)

        if(args.size == 0) {
            return WebResourceResponse(
                "text/plain",
                "utf-8",
                404,
                "Not Found",
                mapOf(),
                "Not Found".byteInputStream()
            )
        }

        return WebResourceResponse(
            args[0] as String,
            "",
            (args[1] as ByteArray).inputStream()
        )
    }
}

@SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
fun createWebView(delegate: WebViewComponent) : WebView {
    WebView.setWebContentsDebuggingEnabled(true)
    val webView = WebView(delegate.ctx)

    val bgColor = if(delegate.instance.isEditor) Color.TRANSPARENT else Color.WHITE
    webView.setBackgroundColor(bgColor)
    webView.webViewClient = delegate
    webView.webChromeClient = object : WebChromeClient() {
        override fun onShowFileChooser(webView: WebView?, filePathCallback: ValueCallback<Array<Uri>>?, fileChooserParams: FileChooserParams?): Boolean {
            try {
                delegate.ctx.fileChooserValueCallback = filePathCallback;
                delegate.ctx.fileChooserResultLauncher.launch(fileChooserParams?.createIntent())
            } catch (_: Exception) { }
            return true
        }
    }
    webView.settings.javaScriptEnabled = true
    webView.loadUrl("http://localhost")
    webView.addJavascriptInterface(delegate, "android")

    return webView
}

fun numberToBytes(num: Int) : ByteArray {
    val bytes = ByteArray(4)
    bytes[0] = ((num.toUInt() and 0xff000000u) shr 24).toByte()
    bytes[1] = ((num.toUInt() and 0x00ff0000u) shr 16).toByte()
    bytes[2] = ((num.toUInt() and 0x0000ff00u) shr  8).toByte()
    bytes[3] = ((num.toUInt() and 0x000000ffu) shr  0).toByte()
    return bytes
}

private fun bytesToNumber(bytes: ByteArray) : Int {
    return ((bytes[0].toUByte().toUInt() shl 24) or
            (bytes[1].toUByte().toUInt() shl 16) or
            (bytes[2].toUByte().toUInt() shl 8) or
            (bytes[3].toUByte().toUInt() shl 0)).toInt()

}

fun deserializeArgs(data: ByteArray) : MutableList<Any?> {
    val args = mutableListOf<Any?>()

    var cursor = 0
    while(cursor < data.size) {
        val type = DataType.from(data[cursor])
        cursor += 1
        val length = bytesToNumber(data.slice(cursor..< cursor + 4).toByteArray())
        cursor += 4
        val arg = data.slice(cursor..< cursor + length).toByteArray()
        cursor += length

        when (type) {
            DataType.UNDEFINED ->
                args.add(null)
            DataType.BOOLEAN ->
                if(arg[0].toInt() == 1) {
                    args.add(true)
                }else {
                    args.add(false)
                }
            DataType.STRING ->
                args.add(String(arg, StandardCharsets.UTF_8))
            DataType.NUMBER -> {
                args.add(null)
                println("Deserializing number is not implemented on Android")
            }
            DataType.UINT8ARRAY ->
                args.add(arg)
        }
    }

    return args
}

enum class DataType(val type: Byte) {
    UNDEFINED(0),
    BOOLEAN(1),
    STRING(2),
    NUMBER(3),
    UINT8ARRAY(4);

    companion object {
        fun from(value: Byte) = entries.first { it.type == value }
    }
}