package org.fullstacked.editor

import android.app.DownloadManager
import android.content.Intent
import android.os.Environment
import android.provider.DocumentsContract
import org.fullstacked.editor.connectivity.Bonjour
import org.fullstacked.editor.connectivity.Peer
import org.fullstacked.editor.connectivity.PeerNearby
import org.fullstacked.editor.connectivity.WSS
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.io.InputStream
import kotlin.math.abs


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
            adapter = this.adapter,
            isEditor = true
        )

        if(this.webViewState != null) {
            webView.restoreState(this.webViewState!!)
        }

        this.webViewId = webView.id

        this.context.setContentView(webView)
    }
}

class AdapterEditor(
    projectId: String,
    private val baseDirectory: String,
): Adapter(projectId, baseDirectory) {
    private val webSocketServer = WSS()
    private val bonjour = Bonjour(webSocketServer)

    companion object {
        init {
            System.loadLibrary("editor")
        }
    }

    private external fun version(): String

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

    private fun esbuildSwitch(methodPath: List<String>, args: List<Any?>) : Any? {
        when (methodPath.first()) {
            "version" -> return version()
            "check" -> return true
            "baseJS" -> return convertInputStreamToString(InstanceEditor.singleton.context.assets.open("base.js"))
            "tmpFile" -> {
                when (methodPath.elementAt(1)) {
                    "write" -> {
                        val filePath = InstanceEditor.singleton.context.cacheDir.toString() + "/" + (args[0] as String)
                        val file = File(filePath)
                        file.writeText(args[1] as String)
                        return filePath
                    }
                    "unlink" -> {
                        val filePath = InstanceEditor.singleton.context.cacheDir.toString() + "/" + (args[0] as String)
                        val file = File(filePath)
                        file.delete()
                        return true
                    }
                }
            }
            "build" -> {
                val errors = build(
                    input = args[0] as String,
                    outdir = args[1] as String,
                    nodePath = this.baseDirectory + "/.cache/node_modules"
                )

                if (errors.isEmpty())
                    return true

                return JSONArray(errors)
            }
        }

        return null
    }

    private fun connectivitySwitch(methodPath: List<String>, args: List<Any?>) : Any? {
        when (methodPath.first()) {
            "name" -> return android.os.Build.MODEL
            "infos" -> {
                val infos = JSONObject()
                infos.put("port", this.webSocketServer.port)

                val addresses = Bonjour.getIpAddress()
                val infoAddresses = JSONArray()
                for (address in addresses)
                    infoAddresses.put(address)

                val networkInterface = JSONObject()
                networkInterface.put("name", "Active Network")
                networkInterface.put("addresses", infoAddresses)

                val networkInterfaces = JSONArray()
                networkInterfaces.put(networkInterface)

                infos.put("networkInterfaces", networkInterfaces)

                return infos
            }
            "peers" -> {
                when (methodPath.elementAt(1)) {
                    "nearby" -> {
                        val json = JSONArray()

                        this.bonjour.getPeersNearby().forEach { peerNearby ->
                            json.put(Bonjour.serializePeerNearby(peerNearby)) }

                        return json
                    }
                }
            }
            "advertise" -> {
                when (methodPath.elementAt(1)) {
                    "start" -> {
                        val peerJSON = args[0] as JSONObject
                        this.bonjour.startAdvertising(Peer(
                            id = peerJSON.getString("id"),
                            name = peerJSON.getString("name")
                        ))
                        return true
                    }
                    "stop" -> {
                        this.bonjour.stopAdvertising()
                        return true
                    }
                }
            }
            "browse" -> {
                when (methodPath.elementAt(1)) {
                    "start" -> {
                        this.bonjour.startBrowsing()
                        return true
                    }
                    "peerNearbyIsDead" -> {
                        this.bonjour.peerNearbyIsDead(args[0] as String)
                        return true
                    }
                    "stop" -> {
                        this.bonjour.stopBrowsing()
                        return true
                    }
                }
            }
            "open" -> {}
            "disconnect" -> {
                this.webSocketServer.disconnect(args[0] as String)
                return true
            }
            "trustConnection" -> {
                this.webSocketServer.trustConnection(args[0] as String)
                return true
            }
            "send" -> {
                this.webSocketServer.send(args[0] as String, args[1] as String, args[2] as Boolean)
                return true
            }
            "convey" -> {
                val projectId = args[0] as String
                val data = args[1] as String

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

    override fun callAdapterMethod(methodPath: ArrayList<String>, args: List<Any?>): Any? {
        when (methodPath.first()) {
            "migrate" -> {
                val projectJSON = args[0] as JSONObject
                val oldPath = projectJSON.getString("location")
                val newPath = projectJSON.getString("id")
                return this.fs.rename(oldPath, newPath)
            }
            "directories" -> return this.directoriesSwitch(methodPath.elementAt(1))
            "esbuild" -> return this.esbuildSwitch(methodPath.subList(1, methodPath.size), args)
            "connectivity" -> return this.connectivitySwitch(methodPath.subList(1, methodPath.size), args)
            "run" -> return this.run(args[0] as JSONObject)
            "open" -> {
                val project = args[0] as JSONObject
                val title = project.getString("title")
                val location = project.getString("location")

                val file = File(this.baseDirectory + "/" + location + "/" + title + ".zip")
                if(!file.exists()) return false

                val out = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).absolutePath + "/" + title + ".zip")
                file.copyTo(out, true)

                val intent = Intent(DownloadManager.ACTION_VIEW_DOWNLOADS)
                InstanceEditor.singleton.context.startActivity(intent)
                return true
            }
            "fs" -> {
                var absolutePath = false
                var utf8 = false

                for(arg in args) {
                    if (arg is JSONObject) {
                        absolutePath = absolutePath || arg.optBoolean("absolutePath")
                        utf8 = utf8 || arg.optString("encoding") == "utf8"
                    }
                }

                if (absolutePath) return super.callAdapterMethod(methodPath, args)

                if (args.isEmpty()) return null

                val file = this.getFile(args[0] as String)

                if (file != null && utf8) {
                    return convertInputStreamToString(file)
                }

                return file
            }
        }


        return super.callAdapterMethod(methodPath, args)
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