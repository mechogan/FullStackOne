package org.fullstacked.editor

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
                        val json = JSONArray(body)
                        val peerJSON = json.getJSONObject(0)
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
            "open" -> {
                val peerNearbyJSON = JSONArray(body).getJSONObject(0)
                val peerJSON = peerNearbyJSON.getJSONObject("peer")
                val peerNearby = PeerNearby(
                    peer = Peer(
                        id = peerJSON.getString("id"),
                        name = peerJSON.getString("name")
                    ),
                    addresses = listOf(peerNearbyJSON.getJSONArray("addresses").getString(0)),
                    port = peerNearbyJSON.getString("port").toInt()
                )

                return true
            }
            "disconnect" -> {
                val json = JSONArray(body)
                this.webSocketServer.disconnect(json.getString(0))
                return true
            }
            "trustConnection" -> {
                val json = JSONArray(body)
                this.webSocketServer.trustConnection(json.getString(0))
                return true
            }
            "send" -> {
                val json = JSONArray(body);
                this.webSocketServer.send(json.getString(0), json.getString(1), json.getBoolean(2))
                return true
            }
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
            "open" -> {
                val projectJSON = JSONArray(body).getJSONObject(0)
                val title = projectJSON.getString("title")
                val location = projectJSON.getString("location")

                val file = File(this.baseDirectory + "/" + location + "/" + title + ".zip")
                if(!file.exists()) return false

                val out = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).absolutePath + "/" + title + ".zip")
                file.copyTo(out, true)

                val intent = Intent(Intent.ACTION_VIEW)
                intent.setType(DocumentsContract.Document.MIME_TYPE_DIR)
                InstanceEditor.singleton.context.startActivity(intent)
                return true
            }
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