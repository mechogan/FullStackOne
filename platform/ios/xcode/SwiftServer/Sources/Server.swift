import Foundation
import Network
import JavaScriptCore

@available(macOS 11.0, *)
class Server {
    static var currentPort = 9000

    let port: NWEndpoint.Port
    let assetdir: String
    let js: JavaScript
    
    var listener: NWListener?
    private var mustRestart = false;

    private var connectionsByID: [Int: ServerConnection] = [:]

    init(workdir: String, assetdir: String) {
        self.port = NWEndpoint.Port(rawValue: UInt16(Server.currentPort))!
        Server.currentPort += 1;
        
        self.assetdir = assetdir
        self.js = JavaScript(workdir: workdir)
        
        guard let entrypoint = Bundle.main.url(forResource: "api/index", withExtension: "js") else {
            return
        }
        
        let script = try! String(contentsOf: entrypoint, encoding: .utf8)
        self.js.run(script: script)
    }
    
    func getWebSocketConnections() -> [WebSocket] {
        var activeWebSockets: [WebSocket] = []
        
        for connection in self.connectionsByID {
            if connection.value.request is WebSocket {
                activeWebSockets.append(connection.value.request as! WebSocket)
            }
        }
        
        return activeWebSockets
    }
    
    func restart() {
        if(self.listener == nil) {
            try! self.start()
            return
        }
        
        let url = URL(string: "http://localhost:" + String(self.port.rawValue))!
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringCacheData, timeoutInterval: 2)
        request.httpMethod = "HEAD"
        
        let task = URLSession.shared.dataTask(with: request) { (data, response, error) in
            if(error != nil) {
                self.mustRestart = true;
                self.stop();
            }
        }

        task.resume()
    }

    func start() throws {
        self.listener = try! NWListener(using: .tcp, on: self.port)
        print("Server starting on port \(self.port)...")
        self.listener!.stateUpdateHandler = self.stateDidChange(to:)
        self.listener!.newConnectionHandler = self.didAccept(nwConnection:)
        self.listener!.start(queue: .main)
    }

    func stateDidChange(to newState: NWListener.State) {
        switch newState {
        case .ready:
            print("Server ready.")
        case .failed(let error):
            print("Server failure, error: \(error.localizedDescription)")
            exit(EXIT_FAILURE)
        case .cancelled:
            if(self.mustRestart) {
                print("Server restartinig")
                self.mustRestart = false;
                try! self.start();
            }
        default:
            break
        }
    }

    private func didAccept(nwConnection: NWConnection) {
        let connection = ServerConnection(server: self, nwConnection: nwConnection)
        self.connectionsByID[connection.id] = connection
        connection.didStopCallback = { _ in
            self.connectionDidStop(connection)
        }
        connection.start()
        print("server did open connection \(connection.id)")
    }

    private func connectionDidStop(_ connection: ServerConnection) {
        self.connectionsByID.removeValue(forKey: connection.id)
        print("server did close connection \(connection.id)")
    }

    func stop() {
        if(self.listener != nil) {
            self.listener!.stateUpdateHandler = nil
            self.listener!.newConnectionHandler = nil
            self.listener!.cancel()
        }
        
        for connection in self.connectionsByID.values {
            connection.didStopCallback = nil
            connection.stop()
        }
        self.connectionsByID.removeAll()
        
        self.listener = nil;
    }
}
