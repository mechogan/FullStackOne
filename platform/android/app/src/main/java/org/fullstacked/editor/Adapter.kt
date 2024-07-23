package org.fullstacked.editor

import org.json.JSONArray
import java.io.File
import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.attribute.BasicFileAttributes

open class Adapter(val projectId: String, baseDirectory: String) {
    val platform = "android"
    val fs: AdapterFS = AdapterFS(baseDirectory)

    fun callAdapterMethod(methodPath: ArrayList<String>, body: String?, done: (maybeData: Any?) -> Void): Void? {
        if(methodPath.isEmpty()) return done(null)

        val json = if(!body.isNullOrEmpty()) JSONArray(body) else JSONArray("[]")

        val writeFile : (String, ByteArray?, Boolean) -> Any? = { path, data, recursive ->
            if(recursive) {
                val dir = path.split("/").dropLast(1)
                this.fs.mkdir(dir.joinToString("/"))
            }
            if(data != null) {
                this.fs.writeFile(path, data)
            }
        }

        when (methodPath.first()) {
            "platform" -> return done(this.platform)
            "fs" -> {
                when (methodPath[1]) {
                    "readFile" -> {
                        var utf8 = false
                        if(json.length() > 1) {
                            val opt = json.getJSONObject(1)
                            try {
                                utf8 = opt.getString("encoding") == "utf8"
                            } catch (_: Exception) { }
                        }
                        return done(this.fs.readFile(json.getString(0), utf8))
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
                            val opt = json.getJSONObject(2)
                            try {
                                recursive = opt.getBoolean("recursive")
                            } catch (_: Exception) { }
                        }

                        return done(writeFile(json.getString(0), data, recursive))
                    }
                    "writeFileMulti" -> {
                        var recursive = false
                        if(json.length() > 2) {
                            val opt = json.getJSONObject(2)
                            try {
                                recursive = opt.getBoolean("recursive")
                            } catch (_: Exception) { }
                        }


                        val files = json.getJSONArray(0)
                        for (i in 0..files.length()) {
                            val file = files.getJSONObject(i)
                            var data: ByteArray? = null

                            try {
                                val uint8array = file.getJSONObject("data")
                                if(uint8array.get("type") == "Uint8Array") {
                                    val numberArr = uint8array.getJSONArray("data")
                                    val byteArray = ByteArray(numberArr.length())
                                    for (i in 0..<numberArr.length()) {
                                        byteArray[i] = numberArr.get(i).toString().toInt().toByte()
                                    }
                                    data = byteArray
                                }
                            }catch (e: Exception) {
                                data = file.getString("data").toByteArray()
                            }

                            val maybeError = writeFile(file.getString("path"), data, recursive)
                            if(maybeError != null)
                                return done(maybeError)
                        }

                        return done(true)
                    }
                    "unlink" -> done(this.fs.unlink(json.getString(0)))
                    "readdir" -> {
                        var recursive = false
                        var withFileTypes = false
                        if(json.length() > 1) {
                            val opt = json.getJSONObject(1)
                            try {
                                recursive = opt.getBoolean("recursive")
                                withFileTypes = opt.getBoolean("withFileTypes")
                            } catch (_: Exception) { }
                        }

                        return done(this.fs.readdir(json.getString(0), withFileTypes, recursive))
                    }
                    "mkdir" -> done(this.fs.mkdir(json.getString(0)))
                    "rmdir" -> done(this.fs.rmdir(json.getString(0)))
                    "stat" -> done(this.fs.stat(json.getString(0)))
                    "lstat" -> done(this.fs.stat(json.getString(0)))
                    "exists" -> done(this.fs.exists(json.getString(0)) ?: false)
                }
            }
        }

        return null
    }
}

data class AdapterError(val code: String, val path: String, val syscall: String)

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

    fun unlink(path: String) {
        val itemPath = this.baseDirectory + "/" + path

        val existsAndIsDirectory = this.itemExistsAndIsDirectory(itemPath)
        if(existsAndIsDirectory == null || existsAndIsDirectory) return

        val file = File(itemPath)
        file.delete()
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
        val files = arrayListOf<File>()

        if(recursive)
            dir.walk().forEach { files.add(it) }
        else
            dir.listFiles()?.forEach { files.add(it) }

        if (!withFileTypes) return files.map { file -> file.name }

        val filesWithTypes = files.map { file -> mapOf(
            "name" to file.name,
            "isDirectory" to file.isDirectory
        )}

        return filesWithTypes
    }

    fun mkdir(path: String) {
        val itemPath = this.baseDirectory + "/" + path
        val dir = File(itemPath)
        dir.mkdirs()
    }

    fun rmdir(path: String) {
        val itemPath = this.baseDirectory + "/" + path
        val existsAndIsDirectory = this.itemExistsAndIsDirectory(itemPath)
        if(existsAndIsDirectory == null || !existsAndIsDirectory) return
        val dir = File(itemPath)
        dir.deleteRecursively()
    }

    fun stat(path: String) : Any? {
        val itemPath = this.baseDirectory + "/" + path

        val existsAndIsDirectory = this.itemExistsAndIsDirectory(itemPath)

        if(existsAndIsDirectory == null) {
            return  AdapterError(
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

    fun exists(path: String) : Any? {
        val itemPath = this.baseDirectory + "/" + path

        val existsAndIsDirectory = this.itemExistsAndIsDirectory(itemPath)
        if(existsAndIsDirectory == null) return null

        return mapOf(
            "isFile" to !existsAndIsDirectory
        )
    }

}