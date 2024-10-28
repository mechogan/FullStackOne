import MultipeerConnectivity
import Foundation
import SwiftyJSON

struct Connection {
    let id: String
    var trusted: Bool
    let mcPeer: MCPeerID
    let mcSession: MCSession
}

struct Invite {
    let mcPeer: MCPeerID
    let mcSession: MCSession
}

struct Peer {
    let id: String
    let name: String
}

struct PeerNearbyMultipeer {
    let id: String
    let peer: Peer
    let mcPeer: MCPeerID
}


// Connectivity > Browser, Advertiser
// Connectivity > Connecter > Request, Responder
class Multipeer: NSObject, MCSessionDelegate, MCNearbyServiceAdvertiserDelegate, MCNearbyServiceBrowserDelegate {
    private let serviceType = "fullstacked-ios"
    private let me = MCPeerID(displayName: UIDevice.current.name)
    private var advertiser: MCNearbyServiceAdvertiser?
    private var browser: MCNearbyServiceBrowser?
    private var peersNearby: [PeerNearbyMultipeer] = []
    private var invites: [Invite] = []
    
    // Browser
    var onPeerNearby: ((_ eventType: String, _ peerNearbyMultipeer: PeerNearbyMultipeer) -> Void)?

    func getPeersNearby() -> JSON {
        let json = JSON(self.peersNearby.map({peerNearby in
            return [
                "id": peerNearby.id,
                "peer": [
                    "id": peerNearby.peer.id,
                    "name": peerNearby.peer.name,
                ],
                "type": 2
            ]
        }))
        
        return json
    }
    
    func startBrowsing() {
        self.browser?.stopBrowsingForPeers()
        self.browser = MCNearbyServiceBrowser(peer: self.me, serviceType: self.serviceType)
        self.browser!.delegate = self
        self.browser!.startBrowsingForPeers()
    }
    
    func stopBrowsing() {
        self.browser?.stopBrowsingForPeers();
        self.browser = nil
    }
    
    // Advertiser
    func startAdvertising(id: String, name: String) {
        self.advertiser?.stopAdvertisingPeer()
        self.advertiser = MCNearbyServiceAdvertiser(peer: self.me, discoveryInfo: ["id": id, "name": name], serviceType: self.serviceType)
        self.advertiser!.delegate = self
        self.advertiser!.startAdvertisingPeer()
    }
    func stopAdvertising() {
        self.advertiser?.stopAdvertisingPeer()
        self.advertiser = nil
    }
    
    // Connecter
    var connections: [Connection] = []
    var onPeerData: ((_ id: String, _ data: String) -> Void)?
    var onPeerConnection: ((_ id: String, _ type: Int, _ state: String) -> Void)?
    
    func open(id: String, meId: String, meName: String) {
        if let peerNearby = self.peersNearby.first(where: { $0.id == id }) {
            let mcSession = MCSession(peer: self.me, securityIdentity: nil, encryptionPreference: .none)
            mcSession.delegate = self;
            let connection = Connection(id: id, trusted: false, mcPeer: peerNearby.mcPeer, mcSession: mcSession)
            self.connections.append(connection)
            
            print("iOS Multipeer: invite");
            let json = [
                "id": meId,
                "name": meName
            ]
            self.browser?.invitePeer(peerNearby.mcPeer, to: mcSession, withContext: try! JSON(json).rawData(), timeout: 10)
        }
    }
    
    func trustConnection(id: String) {
        if let indexOf = self.connections.firstIndex(where: {$0.id == id}) {
            self.connections[indexOf].trusted = true
        }
    }
    
    func disconnect(id: String) {
        if let indexOf = self.connections.firstIndex(where: {$0.id == id}) {
            self.connections[indexOf].mcSession.disconnect()
        }
    }
    
    func send(id: String, data: String, pairing: Bool = false) {
        if let connection = self.connections.first(where: {$0.id == id}) {
            if(!connection.trusted && !pairing) { return }
            try! connection.mcSession.send(data.data(using: .utf8)!, toPeers: [connection.mcPeer], with: .reliable)
        }
    }
    
    
    func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {
        print("ServiceBrowser didNotStartBrowsingForPeers: \(String(describing: error))")
    }

    func browser(_ browser: MCNearbyServiceBrowser, foundPeer mcPeer: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        for peerNearby in self.peersNearby {
            if(peerNearby.mcPeer == mcPeer) { return }
        }
        
        let peer = Peer(id: info!["id"]!, name: info!["name"]!)
        let peerNearby = PeerNearbyMultipeer(id: UUID().uuidString, peer: peer, mcPeer: mcPeer)
        self.peersNearby.append(peerNearby)
        self.onPeerNearby?("new", peerNearby)
    }

    func browser(_ browser: MCNearbyServiceBrowser, lostPeer mcPeer: MCPeerID) {
        if let indexOf = self.peersNearby.firstIndex(where: { $0.mcPeer == mcPeer }) {
            self.onPeerNearby?("lost", self.peersNearby[indexOf])
            self.peersNearby.remove(at: indexOf)
        }
    }
    
    
    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {
        print("ServiceAdvertiser didNotStartAdvertisingPeer: \(String(describing: error))")
    }

    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer mcPeer: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        print("iOS Multipeer: received invite")
        // we might not have discovered the other peer yet
        if(self.peersNearby.first(where: {$0.mcPeer == mcPeer}) == nil) {
            let json = try! JSON(data: context!);
            let peer = Peer(id: json["id"].stringValue, name: json["name"].stringValue)
            let peerNearby = PeerNearbyMultipeer(id: UUID().uuidString, peer: peer, mcPeer: mcPeer)
            self.peersNearby.append(peerNearby)
        }
        
        let mcSession = MCSession(peer: self.me, securityIdentity: nil, encryptionPreference: .none)
        mcSession.delegate = self
        self.invites.append(Invite(mcPeer: mcPeer, mcSession: mcSession))
        invitationHandler(true, mcSession)
    }
    
    func session(_ session: MCSession, peer mcPeer: MCPeerID, didChange state: MCSessionState) {
        if(state == MCSessionState.connected) {
            print("iOS Multipeer: did connect")
            if let connection = self.connections.first(where: { $0.mcPeer == mcPeer }) {
                self.onPeerConnection?(connection.id, 3, "open")
            } else if let peerNearby = self.peersNearby.first(where: { $0.mcPeer == mcPeer }),
                        let inviteIndexOf = self.invites.firstIndex(where: { $0.mcSession == session }) {
                let connection = Connection(id: peerNearby.id, trusted: false, mcPeer: mcPeer, mcSession: self.invites[inviteIndexOf].mcSession)
                self.connections.append(connection)
                self.invites.remove(at: inviteIndexOf)
                self.onPeerConnection?(connection.id, 3, "open")
            }
            
            
        } else if(state == MCSessionState.notConnected) {
            if let indexOf = self.connections.firstIndex(where: {$0.mcPeer == mcPeer}) {
                self.onPeerConnection?(self.connections[indexOf].id, 3, "close")
                self.connections.remove(at: indexOf)
            }
        }
    }

    func session(_ session: MCSession, didReceive data: Data, fromPeer mcPeer: MCPeerID) {
        if let connection = self.connections.first(where: {$0.mcPeer == mcPeer}) {
            let dataStr = String(data: data, encoding: .utf8)!
            self.onPeerData?(connection.id, dataStr)
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
