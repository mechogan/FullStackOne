import Foundation
import Network
import SwiftyJSON


class Bonjour: NSObject, URLSessionWebSocketDelegate {
    static var singleton: Bonjour?
    var ws: [URLSessionWebSocketTask] = []
    
    func browse(){
        let browser = NWBrowser(for: .bonjour(type: "_fullstacked._tcp", domain: nil), using: .tcp)
        browser.stateUpdateHandler = { newState in
            print("browser did change state, new: \(newState)")
        }
        browser.browseResultsChangedHandler = { updated, changes in
            print("browser results did change:")
            for change in changes {
                switch change {
                case .added(let result):
                    let connection = NWConnection(to: result.endpoint, using: .tcp)

                    connection.stateUpdateHandler = { state in
                        switch state {
                        case .ready:
                            if let innerEndpoint = connection.currentPath?.remoteEndpoint,
                               case .hostPort(let host, let port) = innerEndpoint {
                                if(host.debugDescription.hasPrefix("::1")) {
                                    return
                                }
                                
                                let peer = "{ \"name\": \"\(result.endpoint)\", \"addresses\": [\"\(host)\"], \"port\": \(port) }"
                                
                                DispatchQueue.main.async {
                                    InstanceEditor.singleton?.push(messageType: "nearbyPeer", message: peer)
                                }
                                
                                connection.cancel()
                            }
                        default:
                            break
                        }
                    }
                    
                    connection.start(queue: .main)
                    
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
                break
            default:
                print("Unhandled WebSocket Message")
            }
            self.receive(ws: ws)
        })
    }
    
    func pair(host: String, port: Int) {
        print(host, port)
        let ip = String(host.split(separator: "%").first!)
        let hostname = ip.split(separator: ":").count > 1
            ? "[\(ip)]" // ipv6
            : ip        // ipv4
        let session = URLSession(configuration: .default, delegate: self, delegateQueue: OperationQueue())
        let urlString = "ws://" + hostname + ":" + String(port)
        let url = URL(string: urlString)
        let webSocket = session.webSocketTask(with: url!)
        ws.append(webSocket)
        self.receive(ws: webSocket)
        webSocket.resume()
    }
    
    
}
