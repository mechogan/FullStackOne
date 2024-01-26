import Foundation
import Network
import UniformTypeIdentifiers
import CryptoKit

@available(macOS 11.0, *)
@available(iOS 14.0, *)
class ServerConnection {
    //The TCP maximum package size is 64K 65536
    let MTU = 65536
    
    private static var nextID: Int = 0
    let server: Server
    let connection: NWConnection
    let id: Int
    var method: String?
    var pathname: String = ""
    var contentLength: Int = 0
    var body: String = ""
    var wsKey: String?
    var incomingConnection: IncomingConnection?
    
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
                if(self.wsKey != nil){
                    
                    let payloadLength = 0b01111111 & data[1]
                    let mask = data[2...5]
                    let encodedPayload = data[6...6 + payloadLength - 1]
                    let decodedPayload = Data(encodedPayload.enumerated().map { (i, byte) in
                        return byte ^ mask[mask.startIndex + (i % 4)]
                    })
                    let message = String(data: decodedPayload, encoding: .utf8)!
                    print(message)
                    
                    
                    let header: UInt8 = 0b10000001
                    
                    var response = Data([
                        header,
                        UInt8(decodedPayload.count)
                    ])
                    response.append(decodedPayload)
                    
                    self.send(data: response);
                    
                    
                    
                    self.setupReceive()
                    return;
                }
                
                
                let message = String(data: data, encoding: .utf8)!
                
                print("connection \(self.id) did receive")
                print("\n\(message)\n")
                
                if(self.method == nil) {
                    var headers = [String]()
                    var currentLine = [Character]()
                    var charIndexEndOfHeaders: Int = 0
                    for char in message {
                        charIndexEndOfHeaders += 1
                        currentLine.append(char)
                        
                        if(!currentLine[currentLine.count - 1].isNewline){
                            continue
                        }
                        
                        if(currentLine.count == 1) {
                            break
                        }
                        else {
                            headers.append(String(currentLine))
                            currentLine = [Character]()
                        }
                    }
                    
                    self.processHeaders(rawHeaders: headers)
                    
                    if(charIndexEndOfHeaders != message.count) {
                        let index = message.index(message.startIndex, offsetBy: charIndexEndOfHeaders)
                        self.body += String(message.suffix(from: index))
                    }
                }
                else {
                    self.body += message
                }
                
                if(self.wsKey != nil) {
                    self.processWebSocket()
                } else if (self.contentLength == 0 || self.body.count == self.contentLength) {
                    self.processRequest()
                    
                    self.method = nil
                    self.pathname = ""
                    self.contentLength = 0
                    self.body = ""
                }
            }
            
            if isComplete {
                self.connectionDidEnd()
            } 
            else if let error = error {
                self.connectionDidFail(error: error)
            } 
            else {
                self.setupReceive()
            }
        }
    }
    
    private func processHeaders(rawHeaders: [String]) {
        let firstHeaderComponents = rawHeaders[0].split(whereSeparator: \.isWhitespace)
        self.method = String(firstHeaderComponents[0])
        self.pathname = String(firstHeaderComponents[1])
        
        for rawHeader in rawHeaders[1...rawHeaders.count - 1] {
            let headerComponents = rawHeader.components(separatedBy: ":")
            if(headerComponents.count != 2) {
                continue
            }
            
            let headerName = headerComponents[0].trimmingCharacters(in: .whitespacesAndNewlines)
            let headerValue = headerComponents[1].trimmingCharacters(in: .whitespacesAndNewlines)
            
            if(headerName == "Content-Length") {
                self.contentLength = Int(headerValue) ?? 0
            }
            else if(headerName == "Sec-WebSocket-Key"){
                self.wsKey = headerValue
            }
        }
    }
    
    private func getFile(filename: NSString) -> URL? {
        guard let fileURL = Bundle.main.url(forResource: filename.deletingPathExtension, withExtension: filename.pathExtension) else { return nil }
        return fileURL
    }
    
    private func processWebSocket(){
        var headers = [
            "HTTP/1.1 101 Switching Protocols",
            "Upgrade: websocket",
            "Connection: upgrade"
        ]
        
        let str = self.wsKey! + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        let hash = Data(Insecure.SHA1.hash(data: str.data(using: .utf8)!))
        let encodedString = hash.base64EncodedString()
        
        headers.append("Sec-WebSocket-Accept: " + encodedString);
        headers.append("\r\n")
        
        let response = headers.joined(separator: "\r\n").data(using: .utf8)! as Data
        self.send(data: response)
    }
    
    private func processRequest(){
        print("Processing \(self.id) \nmethod: \(self.method ?? "") \npathname: \(self.pathname) \nbody:\n\(self.body)\n")
        
        // remove leading slash
        let cleandPathname = String(pathname.dropFirst());
        
        var headers = ["HTTP/1.1 200 OK"]
        var data: Data? = nil
        
        let maybeFilePath = "webview/" + (cleandPathname.count > 0 ? cleandPathname : "index.html")
        let maybeFileURL = self.getFile(filename: NSString(string: maybeFilePath))
        
        if(maybeFileURL != nil) {
            data = try! Data(contentsOf: maybeFileURL!)
            headers.append("Content-Type: " + Request.mimeType(filePath: maybeFilePath))
        }
        else {
            let jsResponse = self.server.processRequestInJavaScript(pathname: cleandPathname, body: body)
            data = jsResponse.data.data(using: .utf8)
            
            if(jsResponse.isJSON){
                headers.append("Content-Type: application/json")
            }
            else {
                headers.append("Content-Type: text/plain")
            }
        }
        
        headers.append("Content-Length: " + String(data!.count))
        headers.append("\r\n")
        
        var response = headers.joined(separator: "\r\n").data(using: .utf8)! as Data
        response.append(data!)
        
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
class IncomingConnection {
    let serverConnection: ServerConnection
    let pathname: String
    let headers: Dictionary<String, String>
    
    init(
        serverConnection: ServerConnection,
        pathname: String,
        headers: Dictionary<String, String>
    ) {
        self.serverConnection = serverConnection
        self.pathname = pathname
        self.headers = headers
    }
    
    func upgradeToRequest(method: String) -> Request {
        return Request(incomingConnection: self, method: method)
    }
    
    func upgradeToWebSocket() -> WebSocket {
        return WebSocket(incomingConnection: self)
    }
    
    func receivedData(){ }
}

@available(macOS 11.0, *)
@available(iOS 14.0, *)
class WebSocket: IncomingConnection {
    var currentFrame = Date()
    
    init(incomingConnection: IncomingConnection) {
        super.init(
            serverConnection: incomingConnection.serverConnection,
            pathname: incomingConnection.pathname,
            headers: incomingConnection.headers
        )
    }
    
    override func receivedData() {
        
    }
}

@available(macOS 11.0, *)
@available(iOS 14.0, *)
class Request: IncomingConnection {
    let method: String
    var body: String = "";
    
    init(incomingConnection: IncomingConnection, method: String) {
        self.method = method
        super.init(
            serverConnection: incomingConnection.serverConnection,
            pathname: incomingConnection.pathname,
            headers: incomingConnection.headers
        )
    }
    
    override func receivedData() {
        
    }
    
    static func mimeType(filePath: String) -> String {
        if let mimeType = UTType(filenameExtension: (filePath as NSString).pathExtension)?.preferredMIMEType {
            return mimeType
        }
        else {
            return "application/octet-stream"
        }
    }
}
