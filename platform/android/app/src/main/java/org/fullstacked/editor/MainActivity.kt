package org.fullstacked.editor

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.MimeTypeMap
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.io.InputStream

class MainActivity : ComponentActivity() {
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val webView = WebView(this)
        webView.setBackgroundColor(Color.TRANSPARENT)
        val webViewClient = WebViewClientCustom(this)
        webView.webViewClient = webViewClient
        webView.settings.javaScriptEnabled = true
        webView.loadUrl("http://localhost")
        webView.addJavascriptInterface(webViewClient, "Android")
        setContentView(webView)
    }
}

class WebViewClientCustom(private val context: Context) : WebViewClient() {
    private val reqBody = HashMap<Int, String>()

    @JavascriptInterface
    fun passFetchBody(reqId: Int, body: String){
        this.reqBody[reqId] = body
    }

    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
        super.onPageStarted(view, url, favicon)
        view?.evaluateJavascript("const originalFetch = window.fetch; let reqId = 0; window.fetch = (...args) => { if(args?.[1]) { const id = reqId++; args[1].headers = {...(args?.[1]?.headers || {}), \"request-id\": id};  Android.passFetchBody(id, args?.[1]?.body); } return originalFetch(...args) };", null)
    }

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
                this.context.assets.open(assetPath)
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


        if(inputStream != null) {
            val ext = MimeTypeMap.getFileExtensionFromUrl(pathname)
            return WebResourceResponse(
                MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext),
                "utf-8",
                inputStream
            )
        }

        println(pathname)

        var body: JSONArray? = null;
        val reqIdStr = request.requestHeaders["request-id"]
        if(reqIdStr != null) {
            val reqId = reqIdStr.toInt()
            if(this.reqBody[reqId] != null) {
                body = JSONArray(this.reqBody[reqId])
                this.reqBody.remove(reqId)
            }
        }

        val methodPath = pathname.split("/")
        var response: InputStream? = null
        var responseType = "text/plain"
        when (methodPath.first()) {
            "platform" -> { response = "android".byteInputStream() }
            "directories" -> {
                when (methodPath.elementAt(1)) {
                    "rootDirectory" -> response = this.context.filesDir.toString().byteInputStream()
                    "cacheDirectory" -> response = this.context.cacheDir.toString().byteInputStream()
                    "configDirectory" -> response = ".config".byteInputStream()
                    "nodeModulesDirectory" -> response = ".cache/node_modules".byteInputStream()
                }
            }
            "esbuild" -> {
                when (methodPath.elementAt(1)) {
                    "check" -> response = "1".byteInputStream()
                }
            }
            "connectivity" -> {
                when (methodPath.elementAt(1)) {
                    "name" -> response = android.os.Build.MODEL.byteInputStream()
                    "advertise" -> {
                        when (methodPath.elementAt(2)) {
                            "start" -> response = "1".byteInputStream()
                            "stop" -> response = "1".byteInputStream()
                        }
                    }
                    "browse" -> {
                        when (methodPath.elementAt(2)) {
                            "start" -> response = "1".byteInputStream()
                            "stop" -> response = "1".byteInputStream()
                        }
                    }
                }
            }
            "fs" -> {
                when (methodPath.elementAt(1)) {
                    "exists" -> {
                        var filePath = body?.get(0) as String

                        if(body.length() > 1 && body.getJSONObject(1)?.get("absolutePath") as Boolean) {
                            filePath = this.context.filesDir.toString() + "/" + (body.get(0) as String)
                        }

                        val f = File(filePath)

                        responseType = "application/json"

                        if(!f.exists()) {
                            response = "0".byteInputStream()
                        } else {
                            val jsonRes = JSONObject()
                            jsonRes.put("isFile", f.isFile)
                            response = jsonRes.toString().byteInputStream()
                        }
                    }
                    "readFile" -> {
                        if(body != null && body.length() > 1 && body.getJSONObject(1)?.get("absolutePath") as Boolean){
                            val filePath = this.context.filesDir.toString() + "/" + (body.get(0) as String)
                            val f = File(filePath)
                            response = f.readText(Charsets.UTF_8).byteInputStream()
                        } else {
                            responseType = "application/octet-stream"
                            response = this.context.assets.open(body?.get(0).toString())
                        }
                    }
                    "writeFile" -> {
                        var filePath =  body?.get(0) as String

                        if(body.length() > 2 && body.getJSONObject(2)?.get("absolutePath") as Boolean) {
                            filePath = this.context.filesDir.toString() + "/" + (body.get(0) as String)
                        }

                        val f = File(filePath)
                        val dir = f.path.split("/").dropLast(1).joinToString("/")
                        File(dir).mkdirs()

                        try {
                            if(body.getJSONObject(1).get("type") == "Uint8Array") {
                                val numberArr = body.getJSONObject(1).getJSONArray("data")
                                val byteArray = ByteArray(numberArr.length())
                                for (i in 0..<numberArr.length()) {
                                    byteArray[i] = numberArr.get(i).toString().toInt().toByte()
                                }
                                f.writeBytes(byteArray)
                            }
                        } catch (e: Exception) {
                            f.writeText(body.get(1) as String)
                        }

                        response = "1".byteInputStream()
                    }
                    "mkdir" -> {
                        val dir = File(body?.get(0) as String)
                        dir.mkdirs()
                        response = "1".byteInputStream()
                    }
                }
            }
        }

        if(response != null) {
            return WebResourceResponse(
                responseType,
                "utf-8",
                response
            )
        }

        return super.shouldInterceptRequest(view, request)
    }
}