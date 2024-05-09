import Foundation
import Network
import SwiftyJSON


struct Peer: Codable {
    var name: String
    var addresses: [String]
    var port: Int
}

class Bonjour {
    static var singleton: Bonjour?
    var ws: [URLSessionWebSocketTask] = []
    
    func browse(){
        let browser = NWBrowser(for: .bonjourWithTXTRecord(type: "_fullstacked._tcp", domain: nil), using: .tcp)
        browser.stateUpdateHandler = { newState in
            print("browser did change state, new: \(newState)")
        }
        browser.browseResultsChangedHandler = { updated, changes in
            print("browser results did change:")
            for change in changes {
                switch change {
                case .added(let result):
                    print(result)
                    switch result.metadata {
                        case.bonjour(let record):
                        if let addressesStr = record["addresses"], let portStr = record["port"] {
                            let peer = Peer(name: result.endpoint.debugDescription, addresses: addressesStr.split(separator: ",").map({String($0)}), port: Int(portStr)!)
                            let json = try! JSONEncoder().encode(peer)
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
        browser.start(queue: .main)
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
            case .failure(let error):
                print("WebSocket failed")
            }
        })
    }
    
    func pair(addresses: [String], port: Int, completionHandler: @escaping (_ success: Bool) -> Void) {
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

            self.pair(addresses: addrs, port: port, completionHandler: completionHandler)
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
