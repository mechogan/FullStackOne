import Foundation
import UIKit
import Network
import SwiftyJSON


struct Peer: Codable {
    var id: String
    var name: String
    var addresses: [String]?
    var port: Int?
}

class Bonjour {
    static var singleton: Bonjour?
    let id = UUID().uuidString
    var ws: [URLSessionWebSocketTask] = []
    var browser: NWBrowser?
    
    func browse(){
        self.browser = NWBrowser(for: .bonjourWithTXTRecord(type: "_fullstacked._tcp", domain: nil), using: .tcp)
        self.browser!.stateUpdateHandler = { newState in
            print("browser did change state, new: \(newState)")
        }
        self.browser!.browseResultsChangedHandler = { updated, changes in
            print("browser results did change:")
            for change in changes {
                switch change {
                case .added(let result):
                    print(result)
                    switch result.metadata {
                        case.bonjour(let record):
                        if let addressesStr = record["addresses"], let portStr = record["port"] {
                            let peerID = String(result.endpoint.debugDescription.split(separator: ".").first!)
                            let nearbyPeer = Peer(id: peerID, name: record["_d"] ?? result.endpoint.debugDescription, addresses: addressesStr.split(separator: ",").map({String($0)}), port: Int(portStr)!)
                            let json = try! JSONEncoder().encode(nearbyPeer)
                            
                            DispatchQueue.main.async {
                                InstanceEditor.singleton?.push(messageType: "nearbyPeer", message: String(data: json, encoding: .utf8)!)
                            }
                        }
                        default: break
                    }
                case .removed(let result):
                    print("- \(result.endpoint)")
                case .changed(old: let old, new: let new, flags: _):
                    print("± \(old.endpoint) \(new.endpoint)")
                case .identical:
                    fallthrough
                @unknown default:
                    print("?")
                }
            }
        }
        self.browser!.start(queue: .main)
    }
    
    func receive(ws: URLSessionWebSocketTask){
        ws.receive(completionHandler: { result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let data):
                    for instance in RunningInstances.singleton!.instances {
                        instance.push(messageType: "peerData", message: data)
                    }
                    break
                default:
                    print("Unhandled WebSocket Binary Message")
                }
                self.receive(ws: ws)
                break
            case .failure(_):
                print("WebSocket failed")
            }
        })
    }
    
    func pair(id: String,
              name: String,
              addresses: [String],
              port: Int,
              completionHandler: @escaping (_ success: Bool) -> Void) {
        if (addresses.count == 0) {
            completionHandler(false)
            return
        }
        var paired = false
        
        var addrs = addresses
        let address = addrs.removeFirst()
        
        let hostname = address.split(separator: ":").count > 1
            ? "[\(address)]" // ipv6
            : address        // ipv4
        let urlString = "ws://" + hostname + ":" + String(port)
        
        print("Trying to pair with \(urlString)")
        
        let wsDelegate = WSDelegate(
            onOpen: { ws in
                print("Paired with \(urlString)")
                paired = true
                completionHandler(true)
                self.ws.append(ws)
                self.receive(ws: ws)
                
                let selfPeer = Peer(id: self.id, name: UIDevice.current.name)
                let selfPeerJson = try! JSONEncoder().encode(selfPeer)
                ws.send(URLSessionWebSocketTask.Message.string(String(data: selfPeerJson, encoding: .utf8)!), completionHandler: {_ in })
                
                let peer = Peer(id: id, name: name)
                let peerJson = try! JSONEncoder().encode(peer)
                DispatchQueue.main.async {
                    InstanceEditor.singleton?.push(messageType: "peer", message: String(data: peerJson, encoding: .utf8)!)
                }
            }
        );
        
        let session = URLSession(configuration: .default, delegate: wsDelegate, delegateQueue: OperationQueue())
        let url = URL(string: urlString)
        let webSocket = session.webSocketTask(with: url!)
        webSocket.resume()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            if(paired) {
                return;
            }
            
            print("Failed to pair with \(urlString). Continuing...")

            self.pair(id: id, name: name, addresses: addrs, port: port, completionHandler: completionHandler)
        }
    }
}


class WSDelegate: NSObject, URLSessionWebSocketDelegate {
    let onOpen: (_ ws: URLSessionWebSocketTask) -> Void
    
    init(onOpen: @escaping (_ ws: URLSessionWebSocketTask) -> Void) {
        self.onOpen = onOpen
    }
    
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
        self.onOpen(webSocketTask)
    }
}
