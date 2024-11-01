package org.fullstacked.editor

import io.ktor.util.encodeBase64
import okhttp3.OkHttpClient
import okhttp3.Request.Builder
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.InputStream
import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.attribute.BasicFileAttributes
import java.util.concurrent.TimeUnit

data class FetchResponse(
    val headers: MutableMap<String, String>,
    val statusCode: Int,
    val statusMessage: String,
    val body: ByteArray?
)

open class Adapter(
    val projectId: String,
    baseDirectory: String
) {
    val platform = "android"
    val fs: AdapterFS = AdapterFS(baseDirectory)

    open fun getFile(path: String) : InputStream? {
        val data = this.fs.readFile(path, false);
        if(data is AdapterError) return null
        return ByteArrayInputStream(data as ByteArray)
    }

    open fun callAdapterMethod(methodPath: ArrayList<String>, args: List<Any?>): Any? {
        if(methodPath.isEmpty()) return null

        when (methodPath.first()) {
            "platform" -> return this.platform
            "fs" -> return this.fsSwitch(methodPath[1], args)
            "fetch" -> return this.fetch(args)
            "fetchRaw" -> return this.fetchRaw(args)
            "broadcast" -> return this.broadcast(args)
        }

        return null
    }

    private fun broadcast(args: List<Any?>) : Boolean {
        val peerMessage = JSONObject()
        peerMessage.put("projectId", this.projectId)
        peerMessage.put("data", args[0] as String)
        InstanceEditor.singleton.push("sendData", peerMessage.toString())

        return true
    }

    private fun fsSwitch(method: String, args: List<Any?>) : Any? {
        when (method) {
            "readFile" -> {
                val utf8 = args.size > 1 && (args[1] as JSONObject).optString("encoding") == "utf8"
                return this.fs.readFile(args[0] as String, utf8)
            }
            "writeFile" -> {
                return this.fs.writeFile(args[0] as String, args[1]!!)
            }
            "writeFileMulti" -> {
                var i = 1;
                while(i < args.size) {
                    val file = args[i] as String
                    val data = args[i + 1]
                    val maybeError = this.fs.writeFile(file, data!!)
                    if(maybeError is AdapterError){
                        return maybeError
                    }
                    i += 2
                }
                return true
            }
            "unlink" -> return this.fs.unlink(args[0] as String)
            "readdir" -> {
                var recursive = false
                var withFileTypes = false
                if(args.size > 1) {
                    val opt = args[1] as JSONObject
                    recursive = opt.optBoolean("recursive")
                    withFileTypes = opt.optBoolean("withFileTypes")
                }

                return this.fs.readdir(args[0] as String, withFileTypes, recursive)
            }
            "mkdir" -> return this.fs.mkdir(args[0] as String)
            "rmdir" -> return this.fs.rmdir(args[0] as String)
            "stat" -> return this.fs.stat(args[0] as String)
            "lstat" -> return this.fs.stat(args[0] as String)
            "exists" -> return this.fs.exists(args[0] as String)
            "rename" -> return this.fs.rename(args[0] as String, args[1] as String)
        }

        return null
    }

    private fun fetch(args: List<Any?>) : JSONObject? {
        val url = args[0] as String

        var body: ByteArray? = null
        if(args.size > 1) {
            if(args[1] is String){
                body = (args[1] as String).toByteArray()
            } else if (args[1] is ByteArray) {
                body = args[1] as ByteArray
            }
        }

        var method = "GET"
        val headers = mutableMapOf<String, String>()
        var timeout = 15L
        var encoding = "utf8"

        if(args.size > 2) {
            val options = args[2] as JSONObject

            if(options.optString("method").isNotEmpty()) {
                method = options.getString("method")
            }

            if(options.optJSONObject("headers") != null) {
                options.getJSONObject("headers").keys().forEach { key ->
                    headers[key] = options.getJSONObject("headers").getString(key)
                }
            }

            if(options.optLong("timeout") != 0L) {
                timeout = options.getLong("timeout")
            }

            if(options.optString("encoding").isNotEmpty()) {
                encoding = options.getString("encoding")
            }
        }

        val response = this.fetchRequest(
            url,
            headers,
            method,
            timeout,
            body
        )

        if(response == null) {
            return null
        }

        val responseHeaders = JSONObject()
        response.headers.forEach { (key, value) ->
            responseHeaders.put(key, value)
        }

        val responseJSON = JSONObject()
        responseJSON.put("headers", responseHeaders)
        responseJSON.put("statusCode", response.statusCode)
        responseJSON.put("statusMessage", response.statusMessage)

        if(response.body != null) {
            if(encoding == "base64") {
                responseJSON.put("body", response.body.encodeBase64())
            } else {
                responseJSON.put("body", response.body.toString(Charsets.UTF_8))
            }
        } else {
            responseJSON.put("body", "")
        }

        return responseJSON
    }

    private fun fetchRaw(args: List<Any?>) : ByteArray? {
        val url = args[0] as String

        var body: ByteArray? = null
        if(args.size > 1) {
            if(args[1] is String){
                body = (args[1] as String).toByteArray()
            } else if (args[1] is ByteArray) {
                body = args[1] as ByteArray
            }
        }

        var method = "GET"
        val headers = mutableMapOf<String, String>()
        var timeout = 15L

        if(args.size > 2) {
            val options = args[2] as JSONObject

            if(options.optString("method").isNotEmpty()) {
                method = options.getString("method")
            }

            if(options.optJSONObject("headers") != null) {
                options.getJSONObject("headers").keys().forEach { key ->
                    headers[key] = options.getJSONObject("headers").getString(key)
                }
            }

            if(options.optLong("timeout") != 0L) {
                timeout = options.getLong("timeout")
            }
        }

        val response = this.fetchRequest(
            url,
            headers,
            method,
            timeout,
            body
        )

        if(response == null) {
            return null
        }

        return response.body
    }

    private fun fetchRequest(
        url: String,
        headers: MutableMap<String, String>,
        method: String,
        timeout: Long,
        body: ByteArray?
        ): FetchResponse? {
        val client = OkHttpClient.Builder()
            .connectTimeout(timeout, TimeUnit.SECONDS)
            .writeTimeout(timeout, TimeUnit.SECONDS)
            .readTimeout(timeout, TimeUnit.SECONDS)
            .build()

        var request: Builder? = null
        try {
            request = Builder()
                .url(url)
        } catch (e: Exception) { return null }

        request.method(method, body?.toRequestBody())

        headers.forEach { (key, value) ->
            request.addHeader(key, value)
        }

        if(body != null) {
            request.addHeader("content-length", body.size.toString())
        }

        val response: Response = try {
            client.newCall(request.build()).execute()
        } catch (e: Exception) { return null }

        val responseHeaders = mutableMapOf<String, String>()
        response.headers.forEach { (key, value) ->
            responseHeaders[key] = value
        }

        return FetchResponse(
            headers = responseHeaders,
            statusCode = response.code,
            statusMessage = response.message,
            body = response.body?.bytes()
        )
    }
}

data class AdapterError(
    val code: String,
    val path: String,
    val syscall: String,
)

class AdapterFS(private val baseDirectory: String) {
    // @return null if doesn't exist, true if exists and directory, false if exists and is file
    private fun itemExistsAndIsDirectory (path: String) : Boolean? {
        val item = File(path)
        if(!item.exists()) return null
        return item.isDirectory
    }

    fun readFile(path: String, utf8: Boolean) : Any {
        val itemPath = this.baseDirectory + "/" + path

        val existsAndIsDirectory = this.itemExistsAndIsDirectory(itemPath)
        if(existsAndIsDirectory == null || existsAndIsDirectory) {
            return AdapterError(
                code = if(existsAndIsDirectory != null) "EISDIR" else "ENOENT",
                path = path,
                syscall = "open"
            )
        }

        val file = File(itemPath)
        return if(utf8)
            file.readText(Charsets.UTF_8)
        else
            file.readBytes()
    }

    fun writeFile(path: String, strOrData: Any) : Any {
        val itemPath = this.baseDirectory + "/" + path

        val dir = itemPath.split("/").dropLast(1)
        File(dir.joinToString("/")).mkdirs()

        val file = File(itemPath);

        try {
            if(strOrData is String) {
                file.writeText(strOrData)
            } else {
                file.writeBytes(strOrData as ByteArray)
            }
        } catch (e: Exception) {
            return AdapterError(
                code = "ENOENT",
                path = path,
                syscall = "open"
            )
        }

        return true
    }

    fun unlink(path: String): Any {
        val itemPath = this.baseDirectory + "/" + path

        val existsAndIsDirectory = this.itemExistsAndIsDirectory(itemPath)
        if(existsAndIsDirectory == null || existsAndIsDirectory) {
            return AdapterError(
                code = if(existsAndIsDirectory != null) "EISDIR" else "ENOENT",
                path = path,
                syscall = "unlink"
            )
        }

        val file = File(itemPath)
        file.delete()

        return true
    }

    fun readdir(path: String, withFileTypes: Boolean, recursive: Boolean): Any {
        val itemPath = this.baseDirectory + "/" + path

        val existsAndIsDirectory = this.itemExistsAndIsDirectory(itemPath)
        if(existsAndIsDirectory == null || !existsAndIsDirectory) {
            return AdapterError(
                code = if (existsAndIsDirectory != null) "ENOTDIR" else "ENOENT",
                path = path,
                syscall = "open"
            )
        }

        val dir = File(itemPath)
        val files = arrayListOf<Map<String, Any>>()

        if(recursive) {
            val directories = arrayListOf<String>()
            var didEnter = false
            dir.walk()
                .onEnter { currentDir -> didEnter = true; directories.add(currentDir.name) }
                .onLeave { _ ->
                    directories.removeAt(directories.lastIndex)
                }
                .forEach {
                    if(it.absolutePath != dir.absolutePath) {
                        val directoryName = directories.subList(1, directories.size).joinToString("/")
                        if(didEnter && it.isDirectory) {
                            files.add(mapOf(
                                "name" to directoryName,
                                "isDirectory" to it.isDirectory
                            ))
                        }else if(directoryName.isNotEmpty()) {
                            files.add(mapOf(
                                "name" to  directoryName + "/" + it.name,
                                "isDirectory" to it.isDirectory
                            ))
                        } else {
                            files.add(mapOf(
                                "name" to it.name,
                                "isDirectory" to it.isDirectory
                            ))
                        }
                        didEnter = false;
                    }
                }
        } else {
            dir.listFiles()?.forEach {
                files.add(
                    mapOf(
                        "name" to it.name,
                        "isDirectory" to it.isDirectory
                    )
                )
            }
        }

        if (!withFileTypes) return files.map { item -> item["name"] }

        return files
    }

    fun mkdir(path: String): Boolean {
        val itemPath = this.baseDirectory + "/" + path
        val dir = File(itemPath)
        dir.mkdirs()
        return true
    }

    fun rmdir(path: String): Boolean? {
        val itemPath = this.baseDirectory + "/" + path
        val existsAndIsDirectory = this.itemExistsAndIsDirectory(itemPath)
        if(existsAndIsDirectory != null && existsAndIsDirectory) {
            val dir = File(itemPath)
            dir.deleteRecursively()
        }
        return true
    }

    fun stat(path: String) : Any {
        val itemPath = this.baseDirectory + "/" + path

        val existsAndIsDirectory = this.itemExistsAndIsDirectory(itemPath)

        if(existsAndIsDirectory == null) {
            return AdapterError(
                code = "ENOENT",
                path = path,
                syscall = "stat"
            )
        }

        val item = Files.readAttributes(Paths.get(itemPath), BasicFileAttributes::class.java)

        return mapOf(
            "size" to item.size(),
            "isDirectory" to item.isDirectory,
            "isFile" to item.isRegularFile,
            "ctime" to item.creationTime().toString(),
            "ctimeMs" to item.creationTime().toMillis(),
            "mtime" to item.lastModifiedTime().toString(),
            "mtimeMs" to item.lastModifiedTime().toMillis()
        )
    }

    fun exists(path: String) : Any {
        val itemPath = this.baseDirectory + "/" + path

        val existsAndIsDirectory = this.itemExistsAndIsDirectory(itemPath)
        if(existsAndIsDirectory == null) return false

        return mapOf(
            "isFile" to !existsAndIsDirectory
        )
    }

    fun rename(oldPath: String, newPath: String) : Any {
        val oldFile = File(this.baseDirectory + "/" + oldPath)
        val newFile = File(this.baseDirectory + "/" + newPath)

        oldFile.renameTo(newFile)

        return true
    }
}