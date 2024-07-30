package org.fullstacked.editor

import android.os.Bundle
import androidx.activity.ComponentActivity

class MainActivity : ComponentActivity() {
    lateinit var instanceEditor: InstanceEditor

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        this.instanceEditor = InstanceEditor(this)
    }
}