import Foundation
import Network
import UniformTypeIdentifiers

@available(macOS 11.0, *)
@available(iOS 14.0, *)
class ServerConnection {
    //The TCP maximum package size is 64K 65536
    let MTU = 65536
    
    private static var nextID: Int = 0
    let server: Server
    let connection: NWConnection
    let id: Int
    
    init(server: Server, nwConnection: NWConnection) {
        self.server = server;
        connection = nwConnection
        id = ServerConnection.nextID
        ServerConnection.nextID += 1
    }
    
    var didStopCallback: ((Error?) -> Void)? = nil
    
    func start() {
        print("connection \(id) will start")
        connection.stateUpdateHandler = self.stateDidChange(to:)
        setupReceive()
        connection.start(queue: .main)
    }
    
    private func stateDidChange(to state: NWConnection.State) {
        switch state {
        case .waiting(let error):
            connectionDidFail(error: error)
        case .ready:
            print("connection \(id) ready")
        case .failed(let error):
            connectionDidFail(error: error)
        default:
            break
        }
    }
    
    private func setupReceive() {
        connection.receive(minimumIncompleteLength: 1, maximumLength: MTU) { (data, _, isComplete, error) in
            if let data = data, !data.isEmpty {
                let message = String(data: data, encoding: .utf8)
                print("connection \(self.id) did receive, data: \(data as NSData) string: \(message ?? "-")")
                let lines = message?.split(whereSeparator: \.isNewline)
                let firstHeaderComponents = lines![0].split(whereSeparator: \.isWhitespace)
                let method = firstHeaderComponents[0]
                let pathname = firstHeaderComponents[1]
                self.processRequest(method: String(method), pathname: String(pathname))
            }
            if isComplete {
                self.connectionDidEnd()
            } else if let error = error {
                self.connectionDidFail(error: error)
            } else {
                self.setupReceive()
            }
        }
    }
    
    private func dateHeader() -> String {
        let dateFormatter : DateFormatter = DateFormatter()
        dateFormatter.locale = Locale(identifier: "en_US")
        dateFormatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss"
        let date = Date()
        let dateString = dateFormatter.string(from: date);
        return "Date: " + dateString + " GMT\r\n"
    }
    
    private func getFile(filename: NSString) -> URL? {
        guard let fileURL = Bundle.main.url(forResource: filename.deletingPathExtension, withExtension: filename.pathExtension) else { return nil }
        return fileURL
    }
    
    private func processRequest(method: String, pathname: String){
        print(method, pathname)
        
        // remove leading slash
        let cleandPathname = String(pathname.dropFirst());
        let maybeFilePath = "webview/" + (cleandPathname.count > 0 ? cleandPathname : "index.html")
        
        let maybeFileURL = self.getFile(filename: NSString(string: maybeFilePath))
        
        let data = maybeFileURL != nil
            ? try! Data(contentsOf: maybeFileURL!)
            : self.server.processRequestInJavaScript(method: method, pathname: pathname, body: "").data(using: .utf8)!
        
        let mimeType = maybeFileURL != nil
            ? maybeFilePath.mimeType()
            : "text/plain"
        
        if (maybeFileURL != nil) {
            print("Found", maybeFileURL!.absoluteString, mimeType, String(data.count))
        }
        
        let headers = "HTTP/1.1 200 OK\r\n" +
            self.dateHeader() +
            "Content-Length: " + String(data.count) + "\r\n" +
            "Content-Type: " + mimeType + "\r\n" +
            "\r\n"
        var response = headers.data(using: .utf8)! as Data
        response.append(data)
        self.send(data: response)
    }

    func send(data: Data) {
        self.connection.send(content: data, completion: .contentProcessed( { error in
            if let error = error {
                self.connectionDidFail(error: error)
                return
            }
            print("connection \(self.id) did send, data: \(data as NSData)")
        }))
    }

    func stop() {
        print("connection \(id) will stop")
    }


    private func connectionDidFail(error: Error) {
        print("connection \(id) did fail, error: \(error)")
        stop(error: error)
    }

    private func connectionDidEnd() {
        print("connection \(id) did end")
        stop(error: nil)
    }

    private func stop(error: Error?) {
        connection.stateUpdateHandler = nil
        connection.cancel()
        if let didStopCallback = didStopCallback {
            self.didStopCallback = nil
            didStopCallback(error)
        }
    }
}

@available(macOS 11.0, *)
@available(iOS 14.0, *)
extension NSString {
    public func mimeType() -> String {
        if let mimeType = UTType(filenameExtension: self.pathExtension)?.preferredMIMEType {
            return mimeType
        }
        else {
            return "application/octet-stream"
        }
    }
}

@available(macOS 11.0, *)
@available(iOS 14.0, *)
extension String {
    public func mimeType() -> String {
        return (self as NSString).mimeType()
    }
}
