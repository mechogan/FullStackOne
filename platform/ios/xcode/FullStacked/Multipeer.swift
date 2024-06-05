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
    var onPeerNearby: ((_ eventType: String) -> Void)?

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
    var onPeerConnectionLost: ((_ id: String) -> Void)?
    
    func disconnect(id: String) {
        if let indexOf = self.connections.firstIndex(where: {$0.id == id}) {
            self.connections[indexOf].mcSession.disconnect()
        }
    }
    
    func send(id: String, data: String) {
        if let connection = self.connections.first(where: {$0.id == id}) {
            if(!connection.trusted) { return }
            try! connection.mcSession.send(data.data(using: .utf8)!, toPeers: [connection.mcPeer], with: .reliable)
        }
    }
    
    // Requester
    var onOpenConnection: ((_ id: String) -> Void)?
    var onPeerConnectionResponse: ((_ id: String, _ peerConnectionRequestStr: String) -> Void)?
    
    func open(id: String) {
        if let peerNearby = self.peersNearby.first(where: { $0.id == id }) {
            let mcSession = MCSession(peer: self.me, securityIdentity: nil, encryptionPreference: .none)
            mcSession.delegate = self;
            let connection = Connection(id: id, trusted: false, mcPeer: peerNearby.mcPeer, mcSession: mcSession)
            self.connections.append(connection)
            
            print("invite");
            self.browser?.invitePeer(peerNearby.mcPeer, to: mcSession, withContext: nil, timeout: 10)
        }
    }

    func requestConnection(id: String, peerConnectionRequestStr: String) {
        if let indexOf = self.connections.firstIndex(where: {$0.id == id}) {
            try! self.connections[indexOf].mcSession.send(peerConnectionRequestStr.data(using: .utf8)!, toPeers: [self.connections[indexOf].mcPeer], with: .reliable)
        }
    }
    
    func trustConnection(id: String) {
        if let indexOf = self.connections.firstIndex(where: {$0.id == id}) {
            self.connections[indexOf].trusted = true
        }
    }
    
    
    // Responder
    var onPeerConnectionRequest: ((_ id: String, _ peerConnectionRequestStr: String) -> Void)?

    func respondToConnectionRequest(id: String, peerConnectionResponseStr: String) {
        if let connection = self.connections.first(where: {$0.id == id}) {
            try! connection.mcSession.send(peerConnectionResponseStr.data(using: .utf8)!, toPeers: [connection.mcPeer], with: .reliable)
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
        self.onPeerNearby?("new")
    }

    func browser(_ browser: MCNearbyServiceBrowser, lostPeer mcPeer: MCPeerID) {
        if let indexOf = self.peersNearby.firstIndex(where: { $0.mcPeer == mcPeer }) {
            self.peersNearby.remove(at: indexOf)
            self.onPeerNearby?("lost")
        }
    }
    
    
    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {
        print("ServiceAdvertiser didNotStartAdvertisingPeer: \(String(describing: error))")
    }

    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer mcPeer: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        let mcSession = MCSession(peer: self.me, securityIdentity: nil, encryptionPreference: .none)
        mcSession.delegate = self;
        self.invites.append(Invite(mcPeer: mcPeer, mcSession: mcSession))
        invitationHandler(true, mcSession)
    }
    
    func session(_ session: MCSession, peer mcPeer: MCPeerID, didChange state: MCSessionState) {
        if(state == MCSessionState.connected) {
            if let connection = self.connections.first(where: { $0.mcPeer == mcPeer }) {
                self.onOpenConnection?(connection.id)
            } else if let peerNearby = self.peersNearby.first(where: { $0.mcPeer == mcPeer }),
                        let invite = self.invites.first(where: { $0.mcSession == session }) {
                let connection = Connection(id: peerNearby.id, trusted: false, mcPeer: mcPeer, mcSession: invite.mcSession)
                self.connections.append(connection)
            }
        } else if(state == MCSessionState.notConnected) {
            if let indexOf = self.connections.firstIndex(where: {$0.mcPeer == mcPeer}) {
                self.onPeerConnectionLost?(self.connections[indexOf].id)
                self.connections.remove(at: indexOf)
            }
        }
    }

    func session(_ session: MCSession, didReceive data: Data, fromPeer mcPeer: MCPeerID) {
        if let connection = self.connections.first(where: {$0.mcPeer == mcPeer}) {
            let dataStr = String(data: data, encoding: .utf8)!
            
            if(!connection.trusted) {
                
                if let inviteIndexOf = self.invites.firstIndex(where: { $0.mcSession == session }) {
                    self.onPeerConnectionRequest?(connection.id, dataStr)
                    self.invites.remove(at: inviteIndexOf);
                } else {
                    self.onPeerConnectionResponse?(connection.id, dataStr)
                }
                
            } else {
                self.onPeerData?(connection.id, dataStr)
            }
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
