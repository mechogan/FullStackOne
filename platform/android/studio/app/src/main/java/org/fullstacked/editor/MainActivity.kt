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

        this.directories(
            root,
            config,
            nodeModules,
            editor
        )

        val instanceEditor = Instance(true, "");

        this.extractEditorFiles(instanceEditor, editor)

        super.onCreate(savedInstanceState)
        this.fileChooserResultLauncher = this.createFileChooserResultLauncher()

        this.setContentView(WebViewComponent(this, instanceEditor).webView)
    }

    private fun extractEditorFiles(instanceEditor: Instance, editorDir: String) {
        // TODO: check extracted version vs current build
        // extract only if needed

        val destination = editorDir.toByteArray()
        val zipData = this.assets.open("editor.zip").readBytes()
        var payload = byteArrayOf(
            30, // UNZIP
            2   // STRING
        )
        payload += numberToBytes(destination.size)
        payload += destination
        payload += byteArrayOf(
            4 // BUFFER
        )
        payload += numberToBytes(zipData.size)
        payload += zipData

        // use absolute path to unzip to
        payload += byteArrayOf(
            1 // BOOLEAN
        )
        payload += numberToBytes(1)
        payload += byteArrayOf(
            1 // true
        )

        val unzipped = deserializeArgs(instanceEditor.callLib(payload))[0] as Boolean
        if(unzipped) {
            println("UNZIPPED !")
        } else {
            println("FAILED TO UNZIPPED")
        }
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