package org.fullstacked.editor

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.ValueCallback
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import java.lang.Thread.sleep
import kotlin.concurrent.thread

class MainActivity : ComponentActivity() {
    lateinit var fileChooserResultLauncher: ActivityResultLauncher<Intent>
    var fileChooserValueCallback: ValueCallback<Array<Uri>>? = null
    private fun createFileChooserResultLauncher(): ActivityResultLauncher<Intent> {
        return this.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            if (it.resultCode == Activity.RESULT_OK) {
                fileChooserValueCallback?.onReceiveValue(arrayOf(Uri.parse(it?.data?.dataString)));
            } else {
                fileChooserValueCallback?.onReceiveValue(null)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        this.fileChooserResultLauncher = this.createFileChooserResultLauncher()

        if(!InstanceEditor.initialized()) {
            InstanceEditor(this)
        } else {
            InstanceEditor.singleton.context = this
            InstanceEditor.singleton.render()
            InstanceEditor.singleton.instances.forEach { instance -> instance.render() }
        }

        this.onBackPressedDispatcher.addCallback {
            if(InstanceEditor.singleton.instances.size == 0) {
                InstanceEditor.singleton.back { didGoBack ->
                    if(!didGoBack) {
                        moveTaskToBack(true)
                    }
                }
            } else {
                val lastInstance = InstanceEditor.singleton.instances.last()
                lastInstance.back { didGoBack ->
                    if(!didGoBack) {
                        val webview = lastInstance.getWebview();
                        (webview?.parent as ViewGroup).removeView(webview)
                        InstanceEditor.singleton.instances.remove(lastInstance)
                    }
                }
            }
        }.isEnabled = true

        val data: Uri? = intent?.data
        if(data != null && data.toString().isNotEmpty()) {
            println("LAUNCH URL [$data]")
            var webViewClient: WebViewClientCustom? = InstanceEditor.singleton.getWebview()?.webViewClient as WebViewClientCustom
            thread {
                while(webViewClient?.ready != true) {
                    sleep(1000)
                    InstanceEditor.singleton.context.runOnUiThread {
                        webViewClient =
                            InstanceEditor.singleton.getWebview()?.webViewClient as WebViewClientCustom
                    }
                }
                InstanceEditor.singleton.push("launchURL", data.toString())
            }
        }
    }
}