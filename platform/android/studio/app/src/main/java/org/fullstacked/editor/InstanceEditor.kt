package org.fullstacked.editor

import androidx.activity.ComponentActivity
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
    private val context: ComponentActivity,
): Adapter(projectId, baseDirectory) {
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
            this.context.assets.open(path)
        } catch (e: IOException) {
            null
        }
    }

    private fun directoriesSwitch(directory: String): String? {
        when (directory) {
            "rootDirectory" -> return this.baseDirectory
            "cacheDirectory" -> return this.context.cacheDir.toString()
            "configDirectory" -> return ".config"
            "nodeModulesDirectory" -> return ".cache/node_modules"
        }

        return null
    }

    private fun esbuildSwitch(methodPath: List<String>, body: String?) : Any? {
        when (methodPath.first()) {
            "check" -> return true
            "baseJS" -> return convertInputStreamToString(this.context.assets.open("base.js"))
            "tmpFile" -> {
                when (methodPath[1]) {
                    "write" -> {
                        val json = JSONArray(body)
                        val filePath = this.context.cacheDir.toString() + "/" + json.getString(0)
                        val file = File(filePath)
                        file.writeText(json.getString(1), Charsets.UTF_8)
                        return filePath
                    }
                    "unlink" -> {
                        val json = JSONArray(body)
                        val filePath = this.context.cacheDir.toString() + "/" + json.getString(0)
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

    private fun run(project: JSONObject): Boolean {
        this.context.runOnUiThread {
            Instance(
                context = this.context,
                project = Project(
                    id = project.getString("id"),
                    title = project.getString("title"),
                    location = project.getString("location")
                )
            )
        }

        return true
    }

    override fun callAdapterMethod(methodPath: ArrayList<String>, body: String?): Any? {
        when (methodPath.first()) {
            "directories" -> return this.directoriesSwitch(methodPath.elementAt(1))
            "esbuild" -> return this.esbuildSwitch(methodPath.subList(1, methodPath.size), body)
            "run" -> return this.run(JSONArray(body).getJSONObject(0))
            "fs" -> {
                var absolutePath = false
                var utf8 = false
                val json = if(!body.isNullOrEmpty()) JSONArray(body) else JSONArray("[]")

                // writeFile
                if(json.length() > 2) {
                    try {
                        val opt = JSONObject(json.getString(2))
                        absolutePath = opt.getBoolean("absolutePath")
                    } catch (_: Exception) {}
                }
                // readFile, writeFileMulti
                else if(json.length() > 1) {
                    try {
                        val opt = JSONObject(json.getString(1))
                        absolutePath = opt.getBoolean("absolutePath")
                    } catch (_: Exception) {}
                    try {
                        val opt = JSONObject(json.getString(1))
                        utf8 = opt.getString("encoding") == "utf8"
                    } catch (_: Exception) {}
                }

                if(absolutePath) return super.callAdapterMethod(methodPath, body)

                if(json.length() == 0) return null

                val file = this.getFile(json.getString(0))

                if(file != null && utf8) {
                    return convertInputStreamToString(file)
                }

                return file
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


fun convertInputStreamToString(inputStream: InputStream): String {
    val result = ByteArrayOutputStream()
    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
    var length: Int
    while ((inputStream.read(buffer).also { length = it }) != -1) {
        result.write(buffer, 0, length)
    }

    return result.toString("UTF-8")
}