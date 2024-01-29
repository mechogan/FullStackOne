import Foundation
import Network
import JavaScriptCore

@available(macOS 11.0, *)
class Server {
    private static let jsConsoleLog: @convention (block) (String) -> Void = {message in
        print(message)
    }
    private static let jsReaddir: @convention (block) (String) -> [[String: String]] = { path in
        let items = try! FileManager.default.contentsOfDirectory(atPath: path)
        return items.map { item in
            var isDirectory: ObjCBool = false;
            let itemPath = path + "/" + item
            FileManager.default.fileExists(atPath: itemPath, isDirectory: &isDirectory)
            return ["name": item, "isDirectory": (isDirectory.boolValue ? "1" : "")]
        }
    }
    private static let jsReadfile: @convention (block) (String) -> String = { path in
        let contents = FileManager.default.contents(atPath: path)
        return String(data: contents!, encoding: .utf8)!
    }
    private static let jsMkdir: @convention (block) (String) -> Void = { path in
        try! FileManager.default.createDirectory(atPath: path, withIntermediateDirectories: true)
    }
    private static let jsRm: @convention (block) (String) -> Void = { path in
        try! FileManager.default.removeItem(atPath: path)
    }
    private static let jsWritefile: @convention (block) (String, String) -> Void = { path, contents in
        try! contents.write(toFile: path, atomically: true, encoding: .utf8)
    }
    private static let jsExists: @convention (block) (String) -> Bool = { path in
        return FileManager.default.fileExists(atPath: path)
    }
    
    let port: NWEndpoint.Port
    let assetDir: String
    let js: JSContext
    
    var listener: NWListener?
    private var mustRestart = false;

    private var connectionsByID: [Int: ServerConnection] = [:]

    init(port: UInt16, assetDir: String) {
        self.port = NWEndpoint.Port(rawValue: port)!
        self.assetDir = assetDir
        js = JSContext()
        
        let paths = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true);
        let documentsDirectory = paths.first
        js.setObject(documentsDirectory, forKeyedSubscript: "homedir" as NSString)

        js.setObject(Server.jsConsoleLog, forKeyedSubscript: "_consoleLog" as NSString)
        
        js.setObject(Server.jsReaddir, forKeyedSubscript: "_readdir" as NSString)
        js.setObject(Server.jsReadfile, forKeyedSubscript: "_readfile" as NSString)
        js.setObject(Server.jsMkdir, forKeyedSubscript: "_mkdir" as NSString)
        js.setObject(Server.jsRm, forKeyedSubscript: "_rm" as NSString)
        js.setObject(Server.jsWritefile, forKeyedSubscript: "_writefile" as NSString)
        js.setObject(Server.jsExists, forKeyedSubscript: "_exists" as NSString)
        
        
        let consoleLogFunc = """
        var console = {
            log: function(...args) {
                var messages = args.map(arg => typeof arg === "object" ? JSON.stringify(arg, null, 2) : arg);
                _consoleLog(messages.join(", "));
            }
        }
        
        var fs = {
            readdirSync: _readdir,
            readFileSync: _readfile,
            mkdirSync: _mkdir,
            rmSync: _rm,
            writeFileSync: _writefile,
            existsSync: _exists
        }
        """
        js.evaluateScript(consoleLogFunc)
        
        js.exceptionHandler = { (context: JSContext?, exception: JSValue?) in
            print("JS Error: " + exception!.toString())
        }
        
        guard let fileURL = Bundle.main.url(forResource: "api/index", withExtension: "js") else {
            return
        }
        
        let script = try! String(contentsOf: fileURL, encoding: .utf8)
        js.evaluateScript(script)
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
    
    func processRequestInJavaScript(pathname: String, body: String) -> (isJSON: Bool, data: String) {
        let responseBody = self.js.evaluateScript("api.default(\"" + pathname + "\", `" + body + "`)");
        let isJSON = responseBody?.objectForKeyedSubscript("isJSON").toBool()
        let data = responseBody?.objectForKeyedSubscript("data").toString()
        return (isJSON!, data!)
    }
}
