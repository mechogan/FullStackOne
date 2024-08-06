package org.fullstacked.editor.connectivity

import org.fullstacked.editor.InstanceEditor
import org.json.JSONObject
import java.util.UUID
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.websocket.*
import io.ktor.websocket.CloseReason
import io.ktor.websocket.Frame
import io.ktor.websocket.close
import io.ktor.websocket.readText
import kotlinx.coroutines.runBlocking

data class WsConnection(
    val id: String,
    var trusted: Boolean,
    val send: suspend (String) -> Unit,
    val close: suspend () -> Unit
)

class WSS {
    val port = 14000
    val connections = mutableListOf<WsConnection>()

    init {
        embeddedServer(Netty, port = this.port) {
            install(WebSockets)
            routing {
                get("/ping") {
                    call.respondText("pong")
                }
                webSocket {
                    val id = UUID.randomUUID().toString()

                    try {
                        println("WEBSOCKET CONNECTED")
                        connections.add(WsConnection(
                            id = id,
                            trusted = false,
                            send = { data -> outgoing.send(Frame.Text(data)) },
                            close = { close(CloseReason(CloseReason.Codes.NORMAL, "disconnected")) }
                        ))

                        val peerConnectionJSON = JSONObject()
                        peerConnectionJSON.put("id", id)
                        peerConnectionJSON.put("type", 2)
                        peerConnectionJSON.put("state", "open")

                        InstanceEditor.singleton.push("peerConnection", peerConnectionJSON.toString())

                        for(frame in incoming) {
                            println("WEBSOCKET message from $id")
                            // Binary message not yet supported
                            frame as? Frame.Text ?: continue
                            val data = frame.readText()
                            val peerMessageJSON = JSONObject()
                            peerMessageJSON.put("id", id)
                            peerMessageJSON.put("data", data)
                            InstanceEditor.singleton.push("peerData", peerMessageJSON.toString())
                        }

                        removeConnection(id)
                    } finally {
                        removeConnection(id)
                    }
                }
            }
        }.start(wait = false)
    }

    fun trustConnection(id: String) {
        val peerConnection = this.connections.find { wsConnection -> wsConnection.id == id }
        if(peerConnection == null) return
        peerConnection.trusted = true
    }

    fun send(id: String, data: String, pairing: Boolean) {
        val peerConnection = this.connections.find { wsConnection -> wsConnection.id == id }
        if(peerConnection == null || (!peerConnection.trusted && !pairing)) return
        runBlocking {
            peerConnection.send(data)
        }
    }

    fun disconnect(id: String) {
        val peerConnection = this.connections.find { wsConnection -> wsConnection.id == id}
        if(peerConnection == null) return

        runBlocking {
            peerConnection.close()
        }
    }

    private fun removeConnection(id: String) {
        val peerConnection = this.connections.find { wsConnection -> wsConnection.id == id}
        if(peerConnection == null) return

        this.connections.remove(peerConnection)

        val peerConnectionJSON = JSONObject()
        peerConnectionJSON.put("id", id)
        peerConnectionJSON.put("type", 2)
        peerConnectionJSON.put("state", "close")

        InstanceEditor.singleton.push("peerConnection", peerConnectionJSON.toString())
    }
}