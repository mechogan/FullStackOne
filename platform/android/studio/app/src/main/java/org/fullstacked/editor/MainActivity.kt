package org.fullstacked.editor

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.webkit.ValueCallback
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.attribute.BasicFileAttributes
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream


class MainActivity : ComponentActivity() {
    companion object {
        init {
            System.loadLibrary("editor-core")
        }
    }

    private external fun directories(
        root: String,
        config: String,
        nodeModules: String,
        editor: String,
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        val root = File(Environment.DIRECTORY_DOCUMENTS + "/FullStacked").absolutePath
        val config = this.filesDir.absolutePath + "/.config"
        val nodeModules = "$root/node_modules"
        val editor = this.filesDir.absolutePath + "/editor"

        this.extractEditorFiles(editor)

        this.directories(
            root,
            config,
            nodeModules,
            editor
        )

        super.onCreate(savedInstanceState)
        this.fileChooserResultLauncher = this.createFileChooserResultLauncher()

        this.setContentView(WebViewComponent(this, Instance(true, "")).webView)
    }

    private fun extractEditorFiles(editorDir: String) {
        // TODO: check extracted version vs current build
        // extract only if needed

        val editorZip = ZipInputStream(this.assets.open("editor.zip"))
        var entry: ZipEntry? = editorZip.nextEntry
        while (entry != null) {
            if(entry.isDirectory) {
                val f = File(editorDir + "/" + entry.name)
                f.mkdirs()
            } else {
                val outStream = FileOutputStream(editorDir + "/" + entry.name)
                val outBuffer = BufferedOutputStream(outStream)
                val tmpBuffer = ByteArray(2048)
                var read = 0
                while ((editorZip.read(tmpBuffer).also { read = it }) != -1) {
                    outBuffer.write(tmpBuffer, 0, read)
                }

                editorZip.closeEntry()
                outBuffer.close()
                outStream.close()
            }
            entry = editorZip.nextEntry
        }

        val stat = Files.readAttributes(Paths.get(editorDir + "/index.html"), BasicFileAttributes::class.java)
        println(stat.size())
    }


    lateinit var fileChooserResultLauncher: ActivityResultLauncher<Intent>
    var fileChooserValueCallback: ValueCallback<Array<Uri>>? = null
    private fun createFileChooserResultLauncher(): ActivityResultLauncher<Intent> {
        return this.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            if (it.resultCode == Activity.RESULT_OK) {
                fileChooserValueCallback?.onReceiveValue(arrayOf(Uri.parse(it?.data?.dataString)))
            } else {
                fileChooserValueCallback?.onReceiveValue(null)
            }
        }
    }
}