package org.fullstacked.editor

import android.content.Context
import androidx.activity.ComponentActivity
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.io.InputStream

val editorProject = Project(
    location = "",
    id = "org.fullstacked.editor",
    title = "FullStacked"
)

class InstanceEditor(context: ComponentActivity) : Instance(
    project = editorProject,
    context = context,
    init = false
) {
    init {
        this.adapter = AdapterEditor(
            projectId = editorProject.id,
            baseDirectory = this.context.filesDir.toString(),
            context = context
        )

        this.webView = createWebView(
            ctx = this.context,
            adapter = this.adapter
        )

        this.context.setContentView(this.webView)
    }
}

class AdapterEditor(
    projectId: String,
    private val baseDirectory: String,
    private val context: Context
): Adapter(projectId, baseDirectory) {

    override fun getFile(path: String): InputStream? {
        return try {
            this.context.assets.open(path)
        } catch (e: IOException) {
            null
        }
    }

    override fun callAdapterMethod(methodPath: ArrayList<String>, body: String?): Any? {
        when (methodPath.first()) {
            "directories" -> {
                when (methodPath.elementAt(1)) {
                    "rootDirectory" -> return this.baseDirectory
                    "cacheDirectory" -> return this.context.cacheDir.toString()
                    "configDirectory" -> return ".config"
                    "nodeModulesDirectory" -> return ".cache/node_modules"
                }
            }
            "fs" -> {
                var absolutePath = false
                val json = if(!body.isNullOrEmpty()) JSONArray(body) else JSONArray("[]")

                if(json.length() > 2) {
                    try {
                        val opt = JSONObject(json.optString(2))
                        absolutePath = opt.getBoolean("absolutePath")
                    } catch (_: Exception) {}
                } else if(json.length() > 1) {
                    try {
                        val opt = JSONObject(json.optString(1))
                        absolutePath = opt.getBoolean("absolutePath")
                    } catch (_: Exception) {}
                }

                if(absolutePath) return super.callAdapterMethod(methodPath, body)

                if(json.length() == 0) return null

                return this.getFile(json.getString(0))
            }
            "esbuild" -> {
                when (methodPath.elementAt(1)) {
                    "check" -> return true
                }
            }
            "connectivity" -> {
                when (methodPath.elementAt(1)) {
                    "name" -> return android.os.Build.MODEL
                    "infos" -> return false
                    "advertise" -> {
                        when (methodPath.elementAt(2)) {
                            "start" -> return true
                            "stop" -> return true
                        }
                    }
                    "browse" -> {
                        when (methodPath.elementAt(2)) {
                            "start" -> return true
                            "stop" -> return true
                        }
                    }
                }
            }
        }


        return super.callAdapterMethod(methodPath, body)
    }
}
