package org.fullstacked.editor

import android.os.Bundle
import org.fullstacked.editor.connectivity.Bonjour
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.io.InputStream


val editorProject = Project(
    location = "",
    id = "org.fullstacked.editor",
    title = "FullStacked"
)

class InstanceEditor(var context: MainActivity) : Instance(
    project = editorProject,
    init = false
) {
    companion object {
        lateinit var singleton: InstanceEditor
        fun initialized(): Boolean = this::singleton.isInitialized
    }

    val instances = mutableListOf<Instance>()

    init {
        singleton = this

        this.adapter = AdapterEditor(
            projectId = editorProject.id,
            baseDirectory = this.context.filesDir.toString()
        )

        this.render()
    }

    override fun render() {
        val webView = createWebView(
            ctx = this.context,
            adapter = this.adapter
        )

        if(this.webViewState != null) {
            webView.restoreState(this.webViewState!!)
        }

        this.webViewId = webView.id

        println("ICICICICI ${this.context.isDestroyed}")
        this.context.setContentView(webView)
    }
}

class AdapterEditor(
    projectId: String,
    private val baseDirectory: String,
): Adapter(projectId, baseDirectory) {
    private val bonjour = Bonjour()

    companion object {
        init {
            System.loadLibrary("editor")
        }
    }

    private external fun build(
        input: String,
        outdir: String,
        nodePath: String,
    ): String

    override fun getFile(path: String): InputStream? {
        return try {
            InstanceEditor.singleton.context.assets.open(path)
        } catch (e: IOException) {
            null
        }
    }

    private fun directoriesSwitch(directory: String): String? {
        when (directory) {
            "rootDirectory" -> return this.baseDirectory
            "cacheDirectory" -> return InstanceEditor.singleton.context.cacheDir.toString()
            "configDirectory" -> return ".config"
            "nodeModulesDirectory" -> return ".cache/node_modules"
        }

        return null
    }

    private fun esbuildSwitch(methodPath: List<String>, body: String?) : Any? {
        when (methodPath.first()) {
            "check" -> return true
            "baseJS" -> return convertInputStreamToString(InstanceEditor.singleton.context.assets.open("base.js"))
            "tmpFile" -> {
                when (methodPath.elementAt(1)) {
                    "write" -> {
                        val json = JSONArray(body)
                        val filePath = InstanceEditor.singleton.context.cacheDir.toString() + "/" + json.getString(0)
                        val file = File(filePath)
                        file.writeText(json.getString(1), Charsets.UTF_8)
                        return filePath
                    }
                    "unlink" -> {
                        val json = JSONArray(body)
                        val filePath = InstanceEditor.singleton.context.cacheDir.toString() + "/" + json.getString(0)
                        val file = File(filePath)
                        file.delete()
                        return true
                    }
                }
            }
            "build" -> {
                val json = JSONArray(body)

                val errors = build(
                    input = json.getString(0),
                    outdir = json.getString(1),
                    nodePath = this.baseDirectory + "/.cache/node_modules"
                )

                if (errors.isEmpty())
                    return true

                return JSONArray(errors)
            }
        }

        return null
    }

    private fun connectivitySwitch(methodPath: List<String>, body: String?) : Any? {
        when (methodPath.first()) {
            "name" -> return android.os.Build.MODEL
            "infos" -> return false
            "peers" -> {
                when (methodPath.elementAt(1)) {
                    "nearby" -> return this.bonjour.getPeersNearby()
                }
            }
            "advertise" -> {
                when (methodPath.elementAt(1)) {
                    "start" -> return true
                    "stop" -> return true
                }
            }
            "browse" -> {
                when (methodPath.elementAt(1)) {
                    "start" -> {
                        this.bonjour.startBrowsing()
                        return true
                    }
                    "peerNearbyIsDead" -> {
                        val args = JSONArray(body)
                        this.bonjour.peerNearbyIsDead(args.getString(0))
                        return true
                    }
                    "stop" -> {
                        this.bonjour.stopBrowsing()
                        return true
                    }
                }
            }
            "open" -> return true
            "disconnect" -> return true
            "trustConnection" -> return true
            "send" -> return true
            "convey" -> {
                var projectId = ""
                var data = ""

                val args = JSONArray(body)
                try{
                    projectId = args.getString(0)
                }catch (_: Exception) { }
                try{
                    data = args.getString(1)
                }catch (_: Exception) { }

                InstanceEditor.singleton.instances.forEach { instance ->
                    if(instance.project.id == projectId) {
                        instance.push("peerData", data)
                    }
                }

                return true
            }
        }
        return null
    }

    private fun run(project: JSONObject): Boolean {
        InstanceEditor.singleton.context.runOnUiThread {
            val instance = Instance(
                project = Project(
                    id = project.getString("id"),
                    title = project.getString("title"),
                    location = project.getString("location")
                )
            )
            InstanceEditor.singleton.instances.add(instance)
        }

        return true
    }

    override fun callAdapterMethod(methodPath: ArrayList<String>, body: String?): Any? {
        when (methodPath.first()) {
            "directories" -> return this.directoriesSwitch(methodPath.elementAt(1))
            "esbuild" -> return this.esbuildSwitch(methodPath.subList(1, methodPath.size), body)
            "connectivity" -> return this.connectivitySwitch(methodPath.subList(1, methodPath.size), body)
            "run" -> return this.run(JSONArray(body).getJSONObject(0))
            "fs" -> {
                var absolutePath = false
                var utf8 = false
                val json = if (!body.isNullOrEmpty()) JSONArray(body) else JSONArray("[]")

                // writeFile
                if (json.length() > 2) {
                    try {
                        val opt = JSONObject(json.getString(2))
                        absolutePath = opt.getBoolean("absolutePath")
                    } catch (_: Exception) {
                    }
                }
                // readFile, writeFileMulti
                else if (json.length() > 1) {
                    try {
                        val opt = JSONObject(json.getString(1))
                        absolutePath = opt.getBoolean("absolutePath")
                    } catch (_: Exception) {
                    }
                    try {
                        val opt = JSONObject(json.getString(1))
                        utf8 = opt.getString("encoding") == "utf8"
                    } catch (_: Exception) {
                    }
                }

                if (absolutePath) return super.callAdapterMethod(methodPath, body)

                if (json.length() == 0) return null

                val file = this.getFile(json.getString(0))

                if (file != null && utf8) {
                    return convertInputStreamToString(file)
                }

                return file
            }
        }


        return super.callAdapterMethod(methodPath, body)
    }
}


fun convertInputStreamToString(inputStream: InputStream): String {
    val result = ByteArrayOutputStream()
    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
    var length: Int
    while ((inputStream.read(buffer).also { length = it }) != -1) {
        result.write(buffer, 0, length)
    }

    return result.toString("UTF-8")
}