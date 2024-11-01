package org.fullstacked.editor

import android.annotation.SuppressLint
import android.app.ActionBar.LayoutParams
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.MimeTypeMap
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONArray
import org.json.JSONObject
import java.io.InputStream
import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import java.util.Base64


var id = 0

@SuppressLint("SetJavaScriptEnabled")
fun createWebView(
    ctx: MainActivity,
    adapter: Adapter,
    isEditor: Boolean = false,
) : WebView {
    WebView.setWebContentsDebuggingEnabled(true)
    val webView = WebView(ctx)

    webView.id = id
    id++

    val bgColor = if(isEditor) Color.TRANSPARENT else Color.WHITE
    webView.setBackgroundColor(bgColor)
    val webViewClient = WebViewClientCustom(adapter)
    webView.webViewClient = webViewClient
    webView.webChromeClient = object : WebChromeClient() {
        override fun onShowFileChooser(webView: WebView?, filePathCallback: ValueCallback<Array<Uri>>?, fileChooserParams: FileChooserParams?): Boolean {
            try {
                InstanceEditor.singleton.context.fileChooserValueCallback = filePathCallback;
                InstanceEditor.singleton.context.fileChooserResultLauncher.launch(fileChooserParams?.createIntent())
            } catch (_: Exception) { }
            return true
        }
    }
    webView.settings.javaScriptEnabled = true
    webView.loadUrl("http://localhost")
    webView.addJavascriptInterface(webViewClient, "Android")

    return webView
}

data class Project(val location: String, val id: String, val title: String)

open class Instance(val project: Project, val init: Boolean = true) {
    lateinit var adapter: Adapter
    var webViewId: Int = -1
    var webViewState: Bundle? = null

    init {
        if(init) {
            this.adapter = Adapter(
                projectId = this.project.id,
                baseDirectory = InstanceEditor.singleton.context.filesDir.toString() + "/" + this.project.location
            )

            this.render()
        }
    }

    open fun render(){
        val webView = createWebView(
            ctx = InstanceEditor.singleton.context,
            adapter = this.adapter
        )

        val params = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        InstanceEditor.singleton.context.addContentView(webView, params)

        this.webViewId = webView.id
    }

    fun getWebview(): WebView? {
        return InstanceEditor.singleton.context.findViewById(this.webViewId)

    }

    fun back(callback: (didGoBack: Boolean) -> Unit) {
        this.getWebview()?.evaluateJavascript("window.back?.()") { result ->
            callback(result == "true")
        }
    }

    fun push(messageType: String, message: String){
        InstanceEditor.singleton.context.runOnUiThread {
            this.getWebview()?.evaluateJavascript("window.push(\"$messageType\", `${message.replace("\\", "\\\\")}`)", null)
        }
    }
}

class WebViewClientCustom(
    private val adapter: Adapter,
) : WebViewClient() {
    var ready = false
    private val reqBody = HashMap<Int, ByteArray>()

    // https://stackoverflow.com/a/45506857
    // Base64 seems faster
    @JavascriptInterface
    fun passRequestBody(reqId: Int, body: String?) {
        if(body != null)
            this.reqBody[reqId] = Base64.getDecoder().decode(body)
    }

    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
        super.onPageStarted(view, url, favicon)
        this.ready = false
    }

    override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)
        this.ready = true
    }

    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        if(request?.url?.host == "localhost") return super.shouldOverrideUrlLoading(view, request)

        InstanceEditor.singleton.context.startActivity(
            Intent(Intent.ACTION_VIEW, request?.url)
        )
        return true
    }

    override fun shouldInterceptRequest(
        view: WebView?,
        request: WebResourceRequest?,
    ): WebResourceResponse? {
        if(request?.url?.host != "localhost") return super.shouldInterceptRequest(view, request);

        var pathname = request.url?.path ?: ""
        if(pathname.endsWith("/")){
            pathname = pathname.slice(0..<pathname.length - 1)
        }
        if(pathname.startsWith("/")) {
            pathname = pathname.slice(1..<pathname.length)
        }

        // try for index.html
        val maybeIndexHTML = (if(pathname.isEmpty()) "" else "$pathname/") + "index.html"
        var inputStream: InputStream? = this.adapter.getFile(maybeIndexHTML)
        if(inputStream != null){
            pathname = maybeIndexHTML
        }

        // try for built file
        if(
            pathname.endsWith(".js") ||
            pathname.endsWith(".css") ||
            pathname.endsWith(".map")
        ) {
            val maybeBuiltFile = ".build/$pathname"
            inputStream = this.adapter.getFile(maybeBuiltFile)
        }

        // try for the actual pathname
        if(inputStream == null) {
            inputStream = this.adapter.getFile(pathname)
        }

        // if we managed to get a file, respond
        if(inputStream != null) {
            var ext = MimeTypeMap.getFileExtensionFromUrl(pathname)
            if(ext == "mjs") ext = "js"
            val mimeType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext)
            return WebResourceResponse(
                mimeType,
                "",
                inputStream
            )
        }

        println(pathname)

        // we jump into the adapter methods
        var args: List<Any?>? = null;
        val reqIdStr = request.requestHeaders["request-id"]
        if(reqIdStr != null) {
            val reqId = reqIdStr.toInt()
            if(this.reqBody[reqId] != null) {
                args = this.deserializeArgs(this.reqBody[reqId]!!)
                this.reqBody.remove(reqId)
            }
        }

        // maybe in query param
        val maybeBody = request.url.getQueryParameter("body")
        if(maybeBody != null) {
            val queryArgs = mutableListOf<Any?>()
            val argsJSON = JSONArray(URLDecoder.decode(maybeBody, "UTF-8"))
            var i = 0
            while (i < argsJSON.length()) {
                if(argsJSON.optInt(i) != 0) {
                    queryArgs.add(argsJSON.getInt(i))
                } else if(argsJSON.optJSONObject(i) != null) {
                    queryArgs.add(argsJSON.getJSONObject(i))
                } else {
                    queryArgs.add((argsJSON.getString(i)))
                }

                i++
            }
            args = queryArgs
        }

        val methodPath = ArrayList(pathname.split("/"))

        if(args == null) {
            args = listOf()
        }

        val response = when (val maybeResponseData = this.adapter.callAdapterMethod(methodPath, args)) {
            is InputStream -> {
                WebResourceResponse(
                    "application/octet-stream",
                    "binary",
                    maybeResponseData
                )
            }

            is String -> {
                WebResourceResponse(
                    "text/plain",
                    "utf-8",
                    200,
                    "success",
                    mapOf("content-length" to maybeResponseData.toByteArray().size.toString()),
                    maybeResponseData.byteInputStream()
                )
            }

            is AdapterError -> {
                val json = JSONObject()
                json.put("code", maybeResponseData.code)
                json.put("path", maybeResponseData.path)
                json.put("syscall", maybeResponseData.syscall)
                val jsonStr = json.toString()
                WebResourceResponse(
                    "application/json",
                    "utf-8",
                    299,
                    "error",
                    mapOf("content-length" to jsonStr.toByteArray().size.toString()),
                    jsonStr.byteInputStream()
                )
            }

            is ByteArray -> {
                WebResourceResponse(
                    "application/octet-stream",
                    "binary",
                    200,
                    "success",
                    mapOf("content-length" to maybeResponseData.size.toString()),
                    maybeResponseData.inputStream()
                )
            }

            is Boolean -> {
                WebResourceResponse(
                    "application/json",
                    "utf-8",
                    200,
                    "success",
                    mapOf("content-length" to "1"),
                    (if (maybeResponseData) "1" else "0").byteInputStream()
                )
            }

            is List<*> -> {
                val jsonStr = JSONArray(maybeResponseData).toString()
                WebResourceResponse(
                    "application/json",
                    "utf-8",
                    200,
                    "success",
                    mapOf("content-length" to jsonStr.toByteArray().size.toString()),
                    jsonStr.byteInputStream()
                )
            }

            is Map<*, *> -> {
                val jsonStr = JSONObject(maybeResponseData).toString()
                WebResourceResponse(
                    "application/json",
                    "utf-8",
                    200,
                    "success",
                    mapOf("content-length" to jsonStr.toByteArray().size.toString()),
                    jsonStr.byteInputStream()
                )
            }

            is JSONObject -> {
                val jsonStr = maybeResponseData.toString()
                WebResourceResponse(
                    "application/json",
                    "utf-8",
                    200,
                    "success",
                    mapOf("content-length" to jsonStr.toByteArray().size.toString()),
                    jsonStr.byteInputStream()
                )
            }

            is JSONArray -> {
                val jsonStr = maybeResponseData.toString()
                WebResourceResponse(
                    "application/json",
                    "utf-8",
                    200,
                    "success",
                    mapOf("content-length" to jsonStr.toByteArray().size.toString()),
                    jsonStr.byteInputStream()
                )
            }

            else -> {
                WebResourceResponse(
                    "text/plain",
                    "utf-8",
                    404,
                    "not found",
                    mapOf(),
                    "Not Found".byteInputStream()
                )
            }
        }

        return response
    }

    private fun bytesToNumber(bytes: ByteArray) : Int {
        return ((bytes[0].toUByte().toUInt() shl 24) or
                (bytes[1].toUByte().toUInt() shl 16) or
                (bytes[2].toUByte().toUInt() shl 8) or
                (bytes[3].toUByte().toUInt() shl 0)).toInt()

    }

    private fun deserializeNumber(bytes: ByteArray): Int {
        val negative = bytes[0].toInt() == 1

        var n = 0u
        for ((i, byte) in bytes.withIndex()) {
            if(i != 0) {
                n += byte.toUByte().toUInt() shl ((i - 1) * 8)
            }
        }

        if(negative) {
            return 0 - n.toInt()
        } else {
            return n.toInt()
        }
    }

    private fun deserializeArgs(data: ByteArray) : MutableList<Any?> {
        val args = mutableListOf<Any?>()

        var cursor = 0
        while(cursor < data.size) {
            val type = DataType.from(data[cursor])
            cursor += 1
            val length = this.bytesToNumber(data.slice(cursor..< cursor + 4).toByteArray())
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
                DataType.NUMBER ->
                    args.add(this.deserializeNumber(arg))
                DataType.JSON ->
                    args.add(JSONObject(String(arg, StandardCharsets.UTF_8)))
                DataType.UINT8ARRAY ->
                    args.add(arg)
            }
        }

        return args
    }
}

enum class DataType(val type: Byte) {
    UNDEFINED(0),
    BOOLEAN(1),
    STRING(2),
    NUMBER(3),
    JSON(4),
    UINT8ARRAY(5);

    companion object {
        fun from(value: Byte) = entries.first { it.type == value }
    }
}