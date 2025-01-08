package org.fullstacked.editor

import android.app.Activity
import android.content.Intent
import android.content.SharedPreferences.OnSharedPreferenceChangeListener
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.webkit.ValueCallback
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import java.io.File

val buildTimestampPreferenceKey = "project-build-ts"

class MainActivity : ComponentActivity() {
    companion object {
        init {
            System.loadLibrary("editor-core")
        }
    }


    var editorWebViewComponent: WebViewComponent? = null
    var stackedProjectWebViewComponent: WebViewComponent? = null
    val projectsIdsInExternal = mutableListOf<String>()

    var externalProjectsBuildChangeListeners = mutableMapOf<String, OnSharedPreferenceChangeListener>()

    private external fun directories(
        root: String,
        config: String,
        editor: String,
    )

    private external fun callback()

    fun Callback(projectId: String, messageType: String, message: String) {
        if(projectId == "") {
            // open project
            if(messageType == "open") {
                val mainLooper = Looper.getMainLooper()
                val handler = Handler(mainLooper)
                handler.post {
                    val ts = System.currentTimeMillis()
                    println("BUILD TIMESTAMP [$message] [$ts]")
                    val sharedPreferences = this.getSharedPreferences(buildTimestampPreferenceKey, MODE_PRIVATE)
                    val editor = sharedPreferences.edit()
                    editor.putLong(message, ts)
                    editor.apply()
                    editor.commit()

                    if(this.projectsIdsInExternal.contains(message)) {
                        // brings external window in front
                        this.openProjectInAdjacentWindow(message)
                    }
                    else {
                        if(stackedProjectWebViewComponent != null) {
                            this.removeStackedProject()
                        }

                        if(editorWebViewComponent != null) {
                            (editorWebViewComponent?.view?.parent as ViewGroup).removeView(editorWebViewComponent?.view)
                        }

                        stackedProjectWebViewComponent = WebViewComponent(this, Instance(message))
                        this.setContentView(stackedProjectWebViewComponent?.view)
                    }
                }
            }
            // pass message to editor
            else {
                editorWebViewComponent?.onMessage(messageType, message)
            }
        }
        // probably for stacked project
        else if(stackedProjectWebViewComponent?.instance?.projectId == projectId) {
            stackedProjectWebViewComponent?.onMessage(message, messageType)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = this.filesDir.absolutePath + "/projects"
        val config = this.filesDir.absolutePath + "/.config"
        val editor = this.filesDir.absolutePath + "/editor"

        this.directories(
            root,
            config,
            editor
        )

        var deeplink: String? = null
        var projectIdExternal: String? = null
        val data: Uri? = intent?.data
        if(data != null && data.toString().isNotEmpty()) {
            val urlStr = data.toString()
            if(urlStr.startsWith("fullstacked://http")) {
                println("LAUNCH URL [$data]")
                deeplink = urlStr
            } else {
                projectIdExternal = urlStr.slice("fullstacked://".length..< urlStr.length)
                println("INTENT [$projectIdExternal]")
            }
        }

        // launch editor and maybe launch Url
        if(projectIdExternal == null) {
            val editorInstance = Instance( "", true)
            this.editorWebViewComponent = WebViewComponent(this, editorInstance)
            this.extractEditorFiles(editorInstance, editor)
            this.fileChooserResultLauncher = this.createFileChooserResultLauncher()
            this.setContentView(this.editorWebViewComponent?.view)
            callback()
            if(deeplink != null) {
                this.editorWebViewComponent?.onMessage("deeplink", deeplink)
            }
        }
        // launch single project
        else {
            this.stackedProjectWebViewComponent = WebViewComponent(this, Instance(projectIdExternal), true)
            this.setContentView(this.stackedProjectWebViewComponent?.view)

            var lastTs: Long = 0
            this.externalProjectsBuildChangeListeners[projectIdExternal] = OnSharedPreferenceChangeListener { sharedPreferences, _ ->
                val ts = sharedPreferences.getLong(projectIdExternal, 0L)
                println("BUILD TIMESTAMP 1 [$ts]")
                if(lastTs != ts) {
                    this.stackedProjectWebViewComponent?.webView?.reload()
                    lastTs = ts
                    println("BUILD TIMESTAMP 2 [$lastTs]")
                }
            }
            getSharedPreferences(buildTimestampPreferenceKey, MODE_PRIVATE).registerOnSharedPreferenceChangeListener(this.externalProjectsBuildChangeListeners[projectIdExternal])
        }

        this.onBackPressedDispatcher.addCallback {
            // in external project window
            if(editorWebViewComponent == null && stackedProjectWebViewComponent != null) {
                stackedProjectWebViewComponent?.back { didGoBack ->
                    if(!didGoBack) {
                        finish()
                    }
                }
            }
            // in top window
            else {
                // we have a stacked project
                if(stackedProjectWebViewComponent != null) {
                    stackedProjectWebViewComponent?.back { didGoBack ->
                        if(!didGoBack) {
                            removeStackedProject()
                        }
                    }
                }
                // we're in the editor
                else {
                    editorWebViewComponent?.back { didGoBack ->
                        if(!didGoBack) {
                            moveTaskToBack(true)
                        }
                    }
                }

            }
        }.isEnabled = true
    }

    override fun onDestroy() {
        super.onDestroy()

        if(stackedProjectWebViewComponent != null) {
            val buildTimestampPreferences = getSharedPreferences(buildTimestampPreferenceKey, MODE_PRIVATE)
            val editor = buildTimestampPreferences.edit()
            editor.remove(stackedProjectWebViewComponent?.instance?.projectId)
            editor.apply()
            editor.commit()
        }
    }

    private fun shouldExtractEditorFromZip(editorDir: String) : String? {
        val currentEditorDir = File(editorDir)
        val currentEditorDirContents = currentEditorDir.listFiles()
        val currentEditorBuildFile = currentEditorDirContents?.find { it.name == "build.txt" }

        val assetContents = this.assets.list("")
        assetContents?.forEach { println(it) }
        val editorZipFileName = assetContents?.find { it.startsWith("editor") }
        val editorZipNumber = editorZipFileName?.split("-")?.last()?.split(".")?.first()
        println("EDITOR VERSION BUILD $editorZipNumber")

        if(currentEditorBuildFile == null) {
            println("EDITOR VERSION NO CURRENT BUILD FILE")
            return editorZipNumber
        }

        val currentEditorBuildNumber = currentEditorBuildFile.readText()

        println("EDITOR VERSION CURRENT BUILD $currentEditorBuildNumber")

        if(editorZipNumber != currentEditorBuildNumber) {
            return editorZipNumber
        }

        return null
    }

    private fun extractEditorFiles(instanceEditor: Instance, editorDir: String) {
        val editorZipNumber = this.shouldExtractEditorFromZip(editorDir)

        if(editorZipNumber == null) {
            println("UNZIPPED SKIPPED !")
            return
        }

        val destination = editorDir.toByteArray()
        val zipData = this.assets.open("editor-$editorZipNumber.zip").readBytes()

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
            File("$editorDir/build.txt").writeText(editorZipNumber)
        } else {
            println("FAILED TO UNZIPPED")
        }
    }

    fun removeStackedProject(){
        if(stackedProjectWebViewComponent != null) {
            stackedProjectWebViewComponent?.webView?.destroy()
            (stackedProjectWebViewComponent?.view?.parent as ViewGroup).removeView(stackedProjectWebViewComponent?.view)
            stackedProjectWebViewComponent = null
        }

        if(editorWebViewComponent != null) {
            this.setContentView(editorWebViewComponent?.view)
        }
    }

    fun openProjectInAdjacentWindow(projectId: String) {
        val intent = Intent(Intent.ACTION_VIEW)
        intent.data = Uri.parse("fullstacked://$projectId")
        intent.addFlags(Intent.FLAG_ACTIVITY_LAUNCH_ADJACENT)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(intent)

        if(!this.projectsIdsInExternal.contains(projectId)) {
            this.projectsIdsInExternal.add(projectId)

            if(stackedProjectWebViewComponent?.instance?.projectId == projectId) {
                removeStackedProject()
            }

            this.externalProjectsBuildChangeListeners[projectId] = OnSharedPreferenceChangeListener { sharedPreferences, _ ->
                if(!sharedPreferences.contains(projectId)) {
                    this.projectsIdsInExternal.remove(projectId)
                    this.externalProjectsBuildChangeListeners.remove(projectId)
                }
            }

            getSharedPreferences(buildTimestampPreferenceKey, MODE_PRIVATE).registerOnSharedPreferenceChangeListener(this.externalProjectsBuildChangeListeners[projectId])
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