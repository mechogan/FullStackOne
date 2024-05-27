import MultipeerConnectivity
import Foundation

struct MCPeer {
    let peer: Peer
    let mcPeer: MCPeerID
    var connected: Bool
}

class Multipeer: NSObject, MCSessionDelegate, MCNearbyServiceAdvertiserDelegate, MCNearbyServiceBrowserDelegate {
    private let serviceType = "fullstacked-ios"
    private let myPeerId = MCPeerID(displayName: UIDevice.current.name)
    let serviceAdvertiser: MCNearbyServiceAdvertiser
    let serviceBrowser: MCNearbyServiceBrowser
    let session: MCSession
    var seenPeers: [String : MCPeer] = [:]
    
    override init(){
        session = MCSession(peer: myPeerId, securityIdentity: nil, encryptionPreference: .none)
        serviceAdvertiser = MCNearbyServiceAdvertiser(peer: myPeerId, discoveryInfo: nil, serviceType: serviceType)
        serviceBrowser = MCNearbyServiceBrowser(peer: myPeerId, serviceType: serviceType)

        super.init()
        
        session.delegate = self
        serviceAdvertiser.delegate = self
        serviceBrowser.delegate = self
    }
    
    
    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {
        print("ServiceAdvertiser didNotStartAdvertisingPeer: \(String(describing: error))")
    }

    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        print("didReceiveInvitationFromPeer \(peerID)")
        invitationHandler(true, self.session);
    }
    
    func pair(peerID: String) {
        let mcPeer = self.seenPeers[peerID]?.mcPeer ?? nil;
        if(mcPeer == nil) {
            return;
        }
        
        self.serviceBrowser.invitePeer(mcPeer!, to: self.session, withContext: nil, timeout: 10)
    }
    
    func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {
        print("ServiceBrowser didNotStartBrowsingForPeers: \(String(describing: error))")
    }

    func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        var nearbyPeer: Peer?;
        
        for peer in self.seenPeers.values {
            if(peer.mcPeer == peerID) {
                nearbyPeer = peer.peer
                break
            }
        }
        
        if(nearbyPeer == nil) {
            let id = UUID().uuidString
            nearbyPeer = Peer(id: id, name: peerID.displayName, addresses: ["ios-multipeer"], port: 0)
            self.seenPeers[id] = MCPeer(peer: nearbyPeer!, mcPeer: peerID, connected: false);
        }
    
        let json = try! JSONEncoder().encode(nearbyPeer)
        
        DispatchQueue.main.async {
            InstanceEditor.singleton?.push(messageType: "nearbyPeer", message: String(data: json, encoding: .utf8)!)
        }
    }

    func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        print("ServiceBrowser lost peer: \(peerID)")
    }
    
    func send(_ data: Data) {
        var mcPeers: [MCPeerID] = [];
        
        for peer in self.seenPeers.values {
            if(peer.connected) {
                mcPeers.append(peer.mcPeer)
            }
        }
        
        if(mcPeers.count > 0) {
            try! self.session.send(data, toPeers: mcPeers, with: .reliable)
        }
    }
    
    func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        print("peer \(peerID) didChangeState: \(state.rawValue)")
        var seenPeer: MCPeer?
        for peer in self.seenPeers.values {
            if(peer.mcPeer == peerID) {
                seenPeer = peer
                break
            }
        }
        
        if(seenPeer == nil) {
            return
        }
        
        if(state == MCSessionState.connected) {
            self.seenPeers[seenPeer!.peer.id]!.connected = true
            let connectedPeer = Peer(id: seenPeer!.peer.id, name: seenPeer!.peer.name)
            let peerJson = try! JSONEncoder().encode(connectedPeer)
            DispatchQueue.main.async {
                InstanceEditor.singleton?.push(messageType: "peer", message: String(data: peerJson, encoding: .utf8)!)
            }
        }
        else if(state == MCSessionState.notConnected) {
            self.seenPeers[seenPeer!.peer.id]!.connected = false
        }
    }

    func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        print("didReceive bytes \(data.count) bytes")
        for instance in RunningInstances.singleton!.instances {
            instance.push(messageType: "peerData", message: String(data: data, encoding: .utf8)!)
        }
    }

    public func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {
        print("Receiving streams is not supported")
    }

    public func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {
        print("Receiving resources is not supported")
    }

    public func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {
        print("Receiving resources is not supported")
    }
}
