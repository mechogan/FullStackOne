package org.fullstacked.editor.connectivity

import android.content.Context
import android.net.ConnectivityManager
import android.net.LinkAddress
import android.net.LinkProperties
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import okhttp3.WebSocket
import org.fullstacked.editor.InstanceEditor
import org.json.JSONArray
import org.json.JSONObject
import java.net.InetAddress
import javax.jmdns.JmDNS
import javax.jmdns.ServiceEvent
import javax.jmdns.ServiceListener

data class Peer(
    val id: String,
    val name: String,
)

data class PeerNearby (
    val peer: Peer,
    val addresses: List<String>,
    val port: Int,
)

class Bonjour(private val webSocketServer: WSS) : ServiceListener {
    companion object {
        const val serviceType = "_fullstacked._tcp"

        fun serializePeerNearby(peerNearby: PeerNearby, type: Int = 1) : JSONObject {
            val peerJson = JSONObject()
            peerJson.put("id", peerNearby.peer.id)
            peerJson.put("name", peerNearby.peer.name)

            val peerNearbyJson = JSONObject()
            peerNearbyJson.put("type", type)
            peerNearbyJson.put("peer", peerJson)
            peerNearbyJson.put("port", peerNearby.port)
            peerNearbyJson.put("addresses", JSONArray(peerNearby.addresses))

            return peerNearbyJson
        }

        fun onPeerNearby(eventType: String, peerNearby: PeerNearby) {
            val json = JSONObject()
            json.put("eventType", eventType)
            json.put("peerNearby", serializePeerNearby(peerNearby))
            InstanceEditor.singleton.push("peerNearby", json.toString())
        }

        fun getIpAddress(): List<LinkAddress> {
            val connectivityManager = InstanceEditor.singleton.context.getSystemService(Context.CONNECTIVITY_SERVICE)
            if (connectivityManager is ConnectivityManager) {
                val link =  connectivityManager.getLinkProperties(connectivityManager.activeNetwork) as LinkProperties
                return link.linkAddresses
            }

            return listOf()
        }
    }
    private var jmdns: JmDNS? = null
    private val peersNearby = mutableListOf<PeerNearby>()


    fun getPeersNearby(): List<PeerNearby> {
        return this.peersNearby
    }

    fun startBrowsing(){
        if(this.jmdns == null) {
            val addr = InetAddress.getLocalHost()
            val hostname = InetAddress.getByName(addr.hostName).toString()
            this.jmdns = JmDNS.create(addr, hostname)
        }
        this.jmdns?.addServiceListener("$serviceType.local.", this)
        this.jmdns?.list("$serviceType.local.")
    }
    fun stopBrowsing(){
        this.jmdns?.removeServiceListener("$serviceType.local.", this)
    }
    fun peerNearbyIsDead(peerId: String){
        val peerNearby = this.peersNearby.find { peerNearby -> peerNearby.peer.id == peerId }
        if(peerNearby == null) return
        this.peersNearby.remove(peerNearby)
        onPeerNearby("lost", peerNearby)
    }

    override fun serviceAdded(event: ServiceEvent) {
        println("Service added: " + event.info)

        val info = this.jmdns?.getServiceInfo(event.type, event.name)
        println("Service added info: $info")
    }

    override fun serviceRemoved(event: ServiceEvent) {
        println("Service removed: " + event.info)
        val peerId = event.name.split(".").first()
        this.peerNearbyIsDead(peerId)
    }

    override fun serviceResolved(event: ServiceEvent) {
        println("Service resolved: " + event.info)

        val peerId = event.name.split(".").first()

        if(this.peersNearby.find { peerNearby -> peerNearby.peer.id == peerId } != null) return

        val peer = Peer(
            id = peerId,
            name = event.info.getPropertyString("_d")
        )
        val peerNearby = PeerNearby(
            peer = peer,
            port = event.info.getPropertyString("port").toInt(),
            addresses = event.info.getPropertyString("addresses").split(","),
        )

        this.peersNearby.add(peerNearby)
        onPeerNearby("new", peerNearby)
    }

    private var serviceListener : NsdManager.RegistrationListener? = null

    fun startAdvertising(me: Peer){
        if(this.serviceListener != null) {
            this.stopAdvertising()
        }

        val serviceInfo = NsdServiceInfo().apply {
            serviceName = me.id
            serviceType = Bonjour.serviceType
            port = webSocketServer.port

            var ipv4 = ""
            val ipAddresses = getIpAddress()
            for (address in ipAddresses){
                if(address.toString().contains("::")) continue
                ipv4 = address.toString().split("/").first()
                break;
            }

            println("REGISTRATION $ipv4")
            setAttribute("_d", me.name)
            setAttribute("port", webSocketServer.port.toString())
            setAttribute("addresses", ipv4)
        }

        this.serviceListener = object : NsdManager.RegistrationListener {
            override fun onRegistrationFailed(p0: NsdServiceInfo?, p1: Int) {
                println("REGISTRATION FAILED")
            }

            override fun onUnregistrationFailed(p0: NsdServiceInfo?, p1: Int) {
                println("REGISTRATION unregister FAILED")
            }

            override fun onServiceRegistered(p0: NsdServiceInfo?) {
                println("REGISTRATION SUCCESS")
            }

            override fun onServiceUnregistered(p0: NsdServiceInfo?) {
                println("REGISTRATION done")
            }
        }

        (InstanceEditor.singleton.context.getSystemService(Context.NSD_SERVICE) as NsdManager).apply {
            registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, serviceListener)
        }
    }

    fun stopAdvertising(){
        if(this.serviceListener == null) return

        (InstanceEditor.singleton.context.getSystemService(Context.NSD_SERVICE) as NsdManager).apply {
            unregisterService(serviceListener)
        }
        this.serviceListener = null
    }
}