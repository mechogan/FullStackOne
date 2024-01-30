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
    var request: Request?
    
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
    
    // @return Method, Pathname, Parsed Headers, (if any) Body
    private func processHeaders(data: Data) -> (String, String, Dictionary<String, String>, Data?) {
        var method = "";
        var pathname = "";
        var parsedHeaders: Dictionary<String, String> = Dictionary();
        var currentHeader: Data = Data();
        
        var byteIndexEndOfHeaders = 0;
        for byte in data {
            byteIndexEndOfHeaders += 1
            currentHeader.append(byte);
            
            // CR                                       LF
            if(currentHeader.suffix(2).first == 0x0D && currentHeader.last == 0x0A) {
                
                // only [CR, LF]
                // end of headers
                if(currentHeader.count == 2) {
                    break;
                }
                
                
                let header = String(data: currentHeader, encoding: .utf8)!;
                let headerComponents = header.components(separatedBy: ":");
                
                
                // first header is
                // [method] [pathname] [protocol]
                if(headerComponents.count == 1) {
                    let firstHeaderComponents = header.split(whereSeparator: \.isWhitespace)
                    method = firstHeaderComponents[0].trimmingCharacters(in: .whitespacesAndNewlines)
                    pathname = firstHeaderComponents[1].trimmingCharacters(in: .whitespacesAndNewlines)
                }
                else {
                    let headerName = headerComponents[0].trimmingCharacters(in: .whitespacesAndNewlines)
                    let headerValue = headerComponents[1].trimmingCharacters(in: .whitespacesAndNewlines)
                    parsedHeaders[headerName] = headerValue
                }
                
                currentHeader = Data();
            }
            
        }
        
        
        // might have the beginning of body
        var body: Data?
        if(byteIndexEndOfHeaders != data.count) {
            let index = data.index(data.startIndex, offsetBy: byteIndexEndOfHeaders)
            body = Data(data.suffix(from: index))
        }
        
        return (method, pathname, parsedHeaders, body)
    }
    
    private func setupReceive() {
        connection.receive(minimumIncompleteLength: 1, maximumLength: MTU) { (content, _, isComplete, error) in
            var data = content
            if (data != nil) {
                
                if (self.request == nil) {
                    let (method, pathname, headers, body) = self.processHeaders(data: data!)
                    self.request = Request(serverConnection: self, method: method, pathname: pathname, headers: headers)
                    
                    if(headers["Upgrade"] == "websocket") {
                        self.request = self.request?.upgradeToWebSocket()
                    }
                    
                    data = body
                }
                
                self.request?.receivedData(data: data)
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

    func send(data: Data) {
        self.connection.send(content: data, completion: .contentProcessed( { error in
            if let error = error {
                self.connectionDidFail(error: error)
                return
            }
            print("connection \(self.id) did send, data: \(data as NSData)")
            
            if !(self.request is WebSocket) {
                self.request = nil;
            }
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
class Request {
    let serverConnection: ServerConnection
    let method: String
    let pathname: String
    let headers: Dictionary<String, String>
    
    var contentLength: Int?
    var body = Data()
    
    init(
        serverConnection: ServerConnection,
        method: String,
        pathname: String,
        headers: Dictionary<String, String>
    ) {
        self.serverConnection = serverConnection
        self.method = method
        self.pathname = pathname
        self.headers = headers
    }
    
    func upgradeToWebSocket() -> WebSocket {
        return WebSocket(request: self)
    }
    
    func receivedData(data: Data?){
        // check for content-length
        if(self.contentLength == nil && self.headers["Content-Length"] != nil) {
            self.contentLength = Int(self.headers["Content-Length"]!)
        }
        
        if(data == nil && self.contentLength == nil) {
            self.processRequest()
            return
        }
        
        if(data != nil){
            self.body.append(data!)
        }
        
        if(self.body.count == self.contentLength){
            self.processRequest()
        }
    }
    
    private func getFile(filePath: String) -> Data? {
        if(!FileManager.default.fileExists(atPath: filePath)){
            return nil
        }
        return FileManager.default.contents(atPath: filePath)
    }
    
    func processRequest(){
        // remove leading slash
        let cleandPathname = String(pathname.dropFirst());
        
        var headers = ["HTTP/1.1 200 OK"]
        var data: Data? = nil
        
        let filePath = self.serverConnection.server.assetdir + "/" + (cleandPathname.count > 0 ? cleandPathname : "index.html")
        let maybeFile = self.getFile(filePath: filePath)
        
        if(maybeFile != nil) {
            headers.append("Content-Type: " + Request.mimeType(filePath: filePath))
            data = maybeFile
        }
        else {
            let jsResponse = self.serverConnection.server.js.processRequest(pathname: cleandPathname, body: String(data: self.body, encoding: .utf8)!)
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
        
        self.serverConnection.send(data: response)
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

@available(macOS 11.0, *)
@available(iOS 14.0, *)
class WebSocket: Request {
    var currentFrameLength: UInt?
    var currentFrameMask: Data?
    var currentFrameData = Data()
    
    init(request: Request) {
        super.init(
            serverConnection: request.serverConnection,
            method: request.method,
            pathname: request.pathname,
            headers: request.headers
        )
        
        self.openConnection()
    }
    
    private func openConnection(){
        guard let wsKey = self.headers["Sec-WebSocket-Key"] else {
            return
        }
        
        var headers = [
            "HTTP/1.1 101 Switching Protocols",
            "Upgrade: websocket",
            "Connection: upgrade"
        ]
        
        let str = wsKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        let hash = Data(Insecure.SHA1.hash(data: str.data(using: .utf8)!))
        let encodedString = hash.base64EncodedString()
        
        headers.append("Sec-WebSocket-Accept: " + encodedString);
        headers.append("\r\n")
        
        let response = headers.joined(separator: "\r\n").data(using: .utf8)! as Data
        self.serverConnection.send(data: response)
    }
    
    func send(data: Data){
        let header: UInt8 = 0b10000001
        
        var response = Data([
            header
        ])
        
        if (data.count < 126) {
            response.append(UInt8(data.count))
        }
        else if(data.count < 65535) {
            response.append(UInt8(126))
            let highByte = UInt8((data.count >> 8) & 0xFF)
            let lowByte  = UInt8( data.count       & 0xFF)
            response.append(highByte)
            response.append(lowByte)
        }
        else {
            let bytes = [
                data.count >> 56 & 0xFF,
                data.count >> 48 & 0xFF,
                data.count >> 40 & 0xFF,
                data.count >> 32 & 0xFF,
                data.count >> 24 & 0xFF,
                data.count >> 16 & 0xFF,
                data.count >>  8 & 0xFF,
                data.count       & 0xFF
            ]
            
            
            response.append(127)
            for byte in bytes {
                response.append(UInt8(byte))
            }
        }
        
        response.append(data)
        
        self.serverConnection.send(data: response);
    }
    
    override func processRequest() {
        guard let mask = self.currentFrameMask else {
            return
        }
        
        let decodedPayload = Data(self.currentFrameData.enumerated().map { (i, byte) in
            return byte ^ mask[mask.startIndex + (i % 4)]
        })
        let message = String(data: decodedPayload, encoding: .utf8)!
        
        // TODO: Process in JS and return value
        
        print(message)
        
        self.currentFrameData = Data()
        self.currentFrameLength = nil
        self.currentFrameMask = nil
    }
    
    override func receivedData(data: Data?){
        guard var payload = data else {
            return
        }
        
        if(self.currentFrameLength == nil) {
            self.currentFrameLength = UInt(0b01111111 & payload[1])
            var maskStartIndex = 2
            
            if(self.currentFrameLength == 126) {
                let highByte = UInt16(payload[2]) << 8
                let lowByte = UInt16(payload[3])
                self.currentFrameLength = UInt(highByte | lowByte)
                maskStartIndex += 2
            }
            else if(self.currentFrameLength == 127) {
                let bytes: [UInt64] = [
                    UInt64(payload[2]) << 56,
                    UInt64(payload[3]) << 48,
                    UInt64(payload[4]) << 40,
                    UInt64(payload[5]) << 32,
                    UInt64(payload[6]) << 24,
                    UInt64(payload[7]) << 16,
                    UInt64(payload[8]) << 8,
                    UInt64(payload[9])
                ]
                
                var frameLength = UInt64(0)
                for byte in bytes {
                    frameLength = frameLength | byte
                }
                
                self.currentFrameLength = UInt(frameLength)
                maskStartIndex += 8
            }
            
            let payloadStartIndex = maskStartIndex + 4
            self.currentFrameMask = payload[maskStartIndex...payloadStartIndex]
            payload = payload[payloadStartIndex...payload.count - 1]
        }
        
        self.currentFrameData.append(payload)
        
        if(currentFrameLength != nil && currentFrameData.count == currentFrameLength!) {
            self.processRequest()
        }
    }
}
