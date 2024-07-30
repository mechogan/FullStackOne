package org.fullstacked.editor.connectivity

import org.fullstacked.editor.InstanceEditor
import org.fullstacked.editor.MainActivity
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

data class PeerNearby(
    val peer: Peer,
    val addresses: List<String>,
    val port: Int,
)

class Bonjour() : ServiceListener {
    private var jmdns: JmDNS? = null
    private val peersNearby = mutableListOf<PeerNearby>()

    private fun serializePeerNearby(peerNearby: PeerNearby) : JSONObject {
        val peerJson = JSONObject()
        peerJson.put("id", peerNearby.peer.id)
        peerJson.put("name", peerNearby.peer.name)

        val peerNearbyJson = JSONObject()
        peerNearbyJson.put("type", 1)
        peerNearbyJson.put("peer", peerJson)
        peerNearbyJson.put("port", peerNearby.port)
        peerNearbyJson.put("addresses", JSONArray(peerNearby.addresses))

        return peerNearbyJson
    }

    fun getPeersNearby(): JSONArray {
        val json = JSONArray()

        this.peersNearby.forEach { peerNearby ->
            json.put(this.serializePeerNearby(peerNearby))
        }

        return json
    }

    fun startBrowsing(){
        if(this.jmdns == null) {
            this.jmdns = JmDNS.create(InetAddress.getLocalHost())
        }
        this.jmdns?.addServiceListener("_fullstacked._tcp.local.", this)
        this.jmdns?.list("_fullstacked._tcp.local.")
    }
    fun stopBrowsing(){
        this.jmdns?.removeServiceListener("_fullstacked._tcp.local.", this)
    }
    fun peerNearbyIsDead(peerId: String){
        val peerNearby = this.peersNearby.find { peerNearby -> peerNearby.peer.id == peerId }
        if(peerNearby == null) return
        this.peersNearby.remove(peerNearby)
        this.onPeerNearby("lost", peerNearby)
    }

    override fun serviceAdded(event: ServiceEvent) {
//        println("Service added: " + event.info)
    }

    override fun serviceRemoved(event: ServiceEvent) {
//        println("Service removed: " + event.info)
        val peerId = event.name.split(".").first()
        this.peerNearbyIsDead(peerId)
    }

    override fun serviceResolved(event: ServiceEvent) {
//        println("Service resolved: " + event.info)

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
        this.onPeerNearby("new", peerNearby)
    }

    private fun onPeerNearby(eventType: String, peerNearby: PeerNearby) {
        val json = JSONObject()
        json.put("eventType", eventType)
        json.put("peerNearby", this.serializePeerNearby(peerNearby))
        InstanceEditor.singleton.push("peerNearby", json.toString())
    }
}