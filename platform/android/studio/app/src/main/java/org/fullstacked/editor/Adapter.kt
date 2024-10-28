package org.fullstacked.editor

import okhttp3.OkHttpClient
import okhttp3.Request.Builder
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.InputStream
import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.attribute.BasicFileAttributes
import java.util.concurrent.TimeUnit

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

    fun writeFile(path: String, data: ByteArray?, recursive: Boolean) : Any? {
        if(recursive) {
            val dir = path.split("/").dropLast(1)
            this.fs.mkdir(dir.joinToString("/"))
        }

        return this.fs.writeFile(path, data ?: byteArrayOf())
    }

    open fun callAdapterMethod(methodPath: ArrayList<String>, body: String?): Any? {
        if(methodPath.isEmpty()) return null

        val json = if(!body.isNullOrEmpty()) JSONArray(body) else JSONArray("[]")

        when (methodPath.first()) {
            "platform" -> return this.platform
            "fs" -> return this.fsSwitch(methodPath[1], json)
            "fetch" -> return this.fetch(json)
            "broadcast" -> return this.broadcast(json)
        }

        return null
    }

    private fun broadcast(json: JSONArray) : Boolean {
        val peerMessage = JSONObject()
        peerMessage.put("projectId", this.projectId)
        peerMessage.put("data", json.getString(0))
        InstanceEditor.singleton.push("sendData", peerMessage.toString())

        return true
    }

    private fun fsSwitch(method: String, json: JSONArray) : Any? {
        when (method) {
            "readFile" -> {
                if(json.length() == 0) {
                    return ""
                }

                var utf8 = false
                if(json.length() > 1) {
                    try {
                        val opt = json.getJSONObject(1)
                        utf8 = opt.getString("encoding") == "utf8"
                    } catch (_: Exception) {
                        try {
                            utf8 = json.getString(1) == "utf8"
                        } catch (_: Exception) { }
                    }
                }

                return this.fs.readFile(json.getString(0), utf8)
            }
            "writeFile" -> {
                var data: ByteArray? = null

                try {
                    if(json.getJSONObject(1).get("type") == "Uint8Array") {
                        val numberArr = json.getJSONObject(1).getJSONArray("data")
                        val byteArray = ByteArray(numberArr.length())
                        for (i in 0..<numberArr.length()) {
                            byteArray[i] = numberArr.get(i).toString().toInt().toByte()
                        }
                        data = byteArray
                    }
                }catch (e: Exception) {
                    data = json.getString(1).toByteArray()
                }

                var recursive = false
                if(json.length() > 2) {
                    try {
                        val opt = json.getJSONObject(2)
                        recursive = opt.getBoolean("recursive")
                    } catch (_: Exception) { }
                }

                return this.writeFile(json.getString(0), data, recursive)
            }
            "writeFileMulti" -> {
                var recursive = false
                if(json.length() > 1) {
                    val opt = json.getJSONObject(1)
                    try {
                        recursive = opt.getBoolean("recursive")
                    } catch (_: Exception) { }
                }

                val files = json.getJSONArray(0)
                for (i in 0..<files.length()) {
                    val file = files.getJSONObject(i)
                    var data: ByteArray? = null

                    try {
                        val uint8array = file.getJSONObject("data")
                        if(uint8array.get("type") == "Uint8Array") {
                            val numberArr = uint8array.getJSONArray("data")
                            val byteArray = ByteArray(numberArr.length())
                            for (index in 0..<numberArr.length()) {
                                byteArray[index] = numberArr.get(index).toString().toInt().toByte()
                            }
                            data = byteArray
                        }
                    }catch (e: Exception) {
                        data = file.getString("data").toByteArray()
                    }

                    val maybeError = this.writeFile(file.getString("path"), data, recursive)
                    if(maybeError != null && maybeError != true)
                        return maybeError
                }

                return true
            }
            "unlink" -> return this.fs.unlink(json.getString(0))
            "readdir" -> {
                var recursive = false
                var withFileTypes = false
                if(json.length() > 1) {
                    val opt = json.getJSONObject(1)
                    try {
                        recursive = opt.getBoolean("recursive")
                    } catch (_: Exception) { }
                    try {
                        withFileTypes = opt.getBoolean("withFileTypes")
                    } catch (_: Exception) { }
                }

                return this.fs.readdir(json.getString(0), withFileTypes, recursive)
            }
            "mkdir" -> return this.fs.mkdir(json.getString(0))
            "rmdir" -> return this.fs.rmdir(json.getString(0))
            "stat" -> return this.fs.stat(json.getString(0))
            "lstat" -> return this.fs.stat(json.getString(0))
            "exists" -> return this.fs.exists(json.getString(0))
            "rename" -> return this.fs.rename(json.getString(0), json.getString(1))
        }

        return null
    }

    private fun fetch(json: JSONArray): Any? {
        val client = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()

        var request: Builder? = null
        try {
            request = Builder()
                .url(json.getString(0))
        } catch (e: Exception) { return null }

        var utf8 = false
        var method = "GET"
        val headers = mutableMapOf<String, String>()
        var body: ByteArray? = null

        if(json.length() > 1) {
            val opt = json.getJSONObject(1)

            try {
                utf8 = opt.getString("encoding") == "utf8"
            } catch (_: Exception) { }

            try {
                method = opt.getString("method")
            } catch (_: Exception) { }

            try {
                val jsonHeaders = opt.getJSONObject("headers")
                for(key in jsonHeaders.keys()) {
                    headers[key] = jsonHeaders.getString(key)
                }
            } catch (_: Exception) { }

            try {
                val jsonBody = opt.getJSONObject("body")
                if(jsonBody.getString("type") == "Uint8Array") {
                    val numberArr = jsonBody.getJSONArray("data")
                    val byteArray = ByteArray(numberArr.length())
                    for (i in 0..<numberArr.length()) {
                        val numStr = numberArr.get(i).toString()
                        val num = numStr.toInt()
                        byteArray[i] = num.toByte()
                    }
                    body = byteArray
                }
            } catch (_: Exception) { }

            if(body == null) {
                try {
                    val jsonBody = opt.getString("body")
                    body = jsonBody.toByteArray()
                } catch (_: Exception) { }
            }
        }

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

        val responseJson = JSONObject()

        responseJson.put("statusCode", response.code)
        responseJson.put("statusMessage", response.message)

        val responseHeaders = JSONObject()
        response.headers.forEach { (key, value) ->
            responseHeaders.put(key, value)
        }
        responseJson.put("headers", responseHeaders)

        if(utf8) {
            if(response.body == null) {
                responseJson.put("body", "")
            } else {
                responseJson.put("body", response.body?.string() ?: "")
            }
        } else {
            val responseBody = JSONObject()
            responseBody.put("type", "Uint8Array")

            val responseBodyData = JSONArray()
            if(response.body != null) {
                response.body?.bytes()?.forEach { byte ->
                    responseBodyData.put(byte)
                }
            }
            responseBody.put("data", responseBodyData)

            responseJson.put("body", responseBody)
        }

        return responseJson
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

    fun writeFile(path: String, data: ByteArray) : Any {
        val itemPath = this.baseDirectory + "/" + path

        val file = File(itemPath);

        try {
            file.writeBytes(data)
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
        if(existsAndIsDirectory == null || !existsAndIsDirectory) return null
        val dir = File(itemPath)
        dir.deleteRecursively()
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