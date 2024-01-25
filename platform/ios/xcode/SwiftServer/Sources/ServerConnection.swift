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
    var method: String?
    var pathname: String = ""
    var contentLength: Int = 0
    var body: String = ""
    
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
                
                if(self.contentLength == 0 || self.body.count == self.contentLength) {
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
        }
    }
    
    private func dateHeader() -> String {
        let dateFormatter : DateFormatter = DateFormatter()
        dateFormatter.locale = Locale(identifier: "en_US")
        dateFormatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss"
        let date = Date()
        let dateString = dateFormatter.string(from: date);
        return "Date: " + dateString + " GMT"
    }
    
    private func getFile(filename: NSString) -> URL? {
        guard let fileURL = Bundle.main.url(forResource: filename.deletingPathExtension, withExtension: filename.pathExtension) else { return nil }
        return fileURL
    }
    
    private func processRequest(){
        // TODO: beautiful guard
        print("Processing \(self.id) \nmethod: \(self.method ?? "") \npathname: \(self.pathname) \nbody:\n\(self.body)\n")
        
        // remove leading slash
        let cleandPathname = String(pathname.dropFirst());
        
        var headers = ["HTTP/1.1 200 OK", self.dateHeader()]
        var data: Data? = nil
        
        let maybeFilePath = "webview/" + (cleandPathname.count > 0 ? cleandPathname : "index.html")
        let maybeFileURL = self.getFile(filename: NSString(string: maybeFilePath))
        
        if(maybeFileURL != nil) {
            data = try! Data(contentsOf: maybeFileURL!)
            headers.append("Content-Type: " + maybeFilePath.mimeType())
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
