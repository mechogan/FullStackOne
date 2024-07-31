package org.fullstacked.editor

import android.annotation.SuppressLint
import android.app.ActionBar.LayoutParams
import android.graphics.Color
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.MimeTypeMap
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.InputStream
import java.net.URLDecoder


var id = 0

@SuppressLint("SetJavaScriptEnabled")
fun createWebView(
    ctx: MainActivity,
    adapter: Adapter,
    isEditor: Boolean = false
) : WebView {
    WebView.setWebContentsDebuggingEnabled(true)
    val webView = WebView(ctx)

    webView.id = id
    id++

    val bgColor = if(isEditor) Color.TRANSPARENT else Color.WHITE
    webView.setBackgroundColor(bgColor)

    val webViewClient = WebViewClientCustom(adapter)
    webView.webViewClient = webViewClient
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
            this.getWebview()?.evaluateJavascript("window.push(\"$messageType\", `${message}`)", null)
        }
    }
}

class WebViewClientCustom(
    private val adapter: Adapter
) : WebViewClient() {
    private val reqBody = HashMap<Int, String>()

    @JavascriptInterface
    fun passRequestBody(reqId: Int, body: String){
        this.reqBody[reqId] = body
    }

    override fun shouldInterceptRequest(
        view: WebView?,
        request: WebResourceRequest?
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
            val ext = MimeTypeMap.getFileExtensionFromUrl(pathname)
            return WebResourceResponse(
                MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext),
                "",
                inputStream
            )
        }

        println(pathname)

        // we jump into the adapter methods
        var body: String? = null;
        val reqIdStr = request.requestHeaders["request-id"]
        if(reqIdStr != null) {
            val reqId = reqIdStr.toInt()
            if(this.reqBody[reqId] != null) {
                body = this.reqBody[reqId]
                this.reqBody.remove(reqId)
            }
        }

        // maybe in query param
        val maybeBody = request.url.getQueryParameter("body")
        if(maybeBody != null) {
            body = URLDecoder.decode(maybeBody, "UTF-8")
        }

        val methodPath = ArrayList(pathname.split("/"))

        val response = when (val maybeResponseData = this.adapter.callAdapterMethod(methodPath, body)) {
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
}