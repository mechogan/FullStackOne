package org.fullstacked.editor

import android.os.Bundle
import androidx.activity.ComponentActivity

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        println("ICICICICIICICI")
        super.onCreate(savedInstanceState)
        if(!InstanceEditor.initialized()) {
            InstanceEditor(this)
        } else {
            InstanceEditor.singleton.context = this
            InstanceEditor.singleton.render()
            InstanceEditor.singleton.instances.forEach {instance -> instance.render()}
        }
    }
}