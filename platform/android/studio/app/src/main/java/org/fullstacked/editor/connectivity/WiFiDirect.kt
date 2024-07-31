package org.fullstacked.editor.connectivity

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.wifi.p2p.WifiP2pManager
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import org.fullstacked.editor.InstanceEditor

@SuppressLint("MissingPermission")
class WiFiDirect : BroadcastReceiver() {
    private val channel: WifiP2pManager.Channel
    private val manager: WifiP2pManager = InstanceEditor.singleton.context.getSystemService(Context.WIFI_P2P_SERVICE) as WifiP2pManager
    private val intentFilter = IntentFilter()
    private var registeredIntent: Intent? = null
    private val locationPermissionRequest: ActivityResultLauncher<Array<String>>

    init {
        this.intentFilter.addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION)
        this.intentFilter.addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
        this.intentFilter.addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
        this.intentFilter.addAction(WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION)

        this.channel = manager.initialize(InstanceEditor.singleton.context, InstanceEditor.singleton.context.mainLooper, null)

        this.locationPermissionRequest = InstanceEditor.singleton.context.registerForActivityResult(
                ActivityResultContracts.RequestMultiplePermissions()
                ) { permissions ->
            when {
                permissions.getOrDefault(android.Manifest.permission.ACCESS_FINE_LOCATION, false) -> {
                    this.registeredIntent = InstanceEditor.singleton.context.registerReceiver(this, this.intentFilter)
                    this.manager.discoverPeers(this.channel, object : WifiP2pManager.ActionListener {
                        override fun onSuccess() {
                            println("Discovering WiFi Direct Peers")
                        }

                        override fun onFailure(reasonCode: Int) {
                            println("ERROR: Failed to start WiFi Direct discovery")
                        }
                    })
                } else -> { }
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        when(intent.action) {
            WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION -> {
                // Determine if Wi-Fi Direct mode is enabled or not, alert
                // the Activity.
                val state = intent.getIntExtra(WifiP2pManager.EXTRA_WIFI_STATE, -1)
                val isWifiP2pEnabled = state == WifiP2pManager.WIFI_P2P_STATE_ENABLED
            }
            WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> {

                // The peer list has changed! We should probably do something about
                // that.

            }
            WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {

                // Connection state changed! We should probably do something about
                // that.

            }
            WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION -> {

            }
        }
    }

    fun startBrowsing() {
        this.locationPermissionRequest.launch(arrayOf(android.Manifest.permission.ACCESS_FINE_LOCATION))
    }
    fun stopBrowsing() {
        if(this.registeredIntent != null) {
            InstanceEditor.singleton.context.unregisterReceiver(this)
            this.registeredIntent = null
        }
    }

}