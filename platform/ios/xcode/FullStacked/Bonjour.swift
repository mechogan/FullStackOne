import Foundation
import UIKit
import Network
import SwiftyJSON


struct PeerNearbyBonjour: Codable {
    var id: String
    var name: String
    var addresses: [String]
    var port: Int
}

// Connectivity > Browser
class Bonjour {
    var browser: NWBrowser?
    var peersNearby: [NWEndpoint: PeerNearbyBonjour] = [:];
    
    var onPeerNearby: ((_ eventType: String, _ peerNearbyBonjour: PeerNearbyBonjour) -> Void)?;
    
    func getPeersNearby() -> JSON {
        print(self.peersNearby.count)
        let json = JSON(self.peersNearby.values.map({peerNearby in
            return [
                "peer": [
                    "id": peerNearby.id,
                    "name": peerNearby.name,
                ],
                "type": 1,
                "addresses": JSON(peerNearby.addresses),
                "port": peerNearby.port
            ]
        }))
        
        return json
    }
    func startBrowsing() {
        self.browser?.cancel()
        
        self.browser = NWBrowser(for: .bonjourWithTXTRecord(type: "_fullstacked._tcp", domain: nil), using: .tcp)
        
        self.browser!.browseResultsChangedHandler = { updated, changes in
            for change in changes {
                switch change {
                case .added(let result):
                    switch result.metadata {
                        case.bonjour(let record):
                        print(record)
                        if let addressesStr = record["addresses"], let portStr = record["port"] {
                            let peerID = String(result.endpoint.debugDescription.split(separator: ".").first!)
                            let peerNearby = PeerNearbyBonjour(id: peerID, name: record["_d"] ?? result.endpoint.debugDescription, addresses: addressesStr.split(separator: ",").map({String($0)}), port: Int(portStr)!)
                            
                            self.peersNearby[result.endpoint] = peerNearby
                            self.onPeerNearby?("new", peerNearby)
                        }
                        default: break
                    }
                case .removed(let result):
                    if let peerNearby = self.peersNearby[result.endpoint] {
                        self.onPeerNearby?("lost", peerNearby)
                        self.peersNearby.removeValue(forKey: result.endpoint)
                    }
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
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) {
            if(self.browser != nil) {
                self.startBrowsing()
            }
        }
    }
    func stopBrowsing() {
        self.browser?.cancel()
        self.browser = nil
    }
    
    func peerNearbyIsDead(id: String) {
        if let peerNearby = self.peersNearby.enumerated().first(where: { peerNearby in
            return id == peerNearby.element.value.id
        }) {
            self.onPeerNearby?("lost", peerNearby.element.value)
            self.peersNearby.removeValue(forKey: peerNearby.element.key)
        }
    }
}
