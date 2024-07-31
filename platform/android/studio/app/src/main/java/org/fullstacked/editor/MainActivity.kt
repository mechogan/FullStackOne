package org.fullstacked.editor

import android.os.Bundle
import android.view.ViewGroup
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.addCallback

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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
    }
}