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
    
    let port: NWEndpoint.Port
    let listener: NWListener
    let js: JSContext

    private var connectionsByID: [Int: ServerConnection] = [:]

    init(port: UInt16) {
        self.port = NWEndpoint.Port(rawValue: port)!
        listener = try! NWListener(using: .tcp, on: self.port)
        js = JSContext()
        
        let paths = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true);
        let documentsDirectory = paths.first
        js.setObject(documentsDirectory, forKeyedSubscript: "homedir" as NSString)

        
        js.setObject(Server.jsConsoleLog, forKeyedSubscript: "_consoleLog" as NSString)
        js.setObject(Server.jsReaddir, forKeyedSubscript: "_readdir" as NSString)
        js.setObject(Server.jsReadfile, forKeyedSubscript: "_readfile" as NSString)
        let consoleLogFunc = """
        var console = {
            log: function(...args) {
                var messages = args.map(arg => typeof arg === "object" ? JSON.stringify(arg, null, 2) : arg);
                _consoleLog(messages.join(", "));
            }
        }
        
        var fs = {
            readdirSync: _readdir,
            readFileSync: _readfile
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

    func start() throws {
        print("Server starting...")
        listener.stateUpdateHandler = self.stateDidChange(to:)
        listener.newConnectionHandler = self.didAccept(nwConnection:)
        listener.start(queue: .main)
    }

    func stateDidChange(to newState: NWListener.State) {
        switch newState {
        case .ready:
            print("Server ready.")
        case .failed(let error):
            print("Server failure, error: \(error.localizedDescription)")
            exit(EXIT_FAILURE)
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

    private func stop() {
        self.listener.stateUpdateHandler = nil
        self.listener.newConnectionHandler = nil
        self.listener.cancel()
        for connection in self.connectionsByID.values {
            connection.didStopCallback = nil
            connection.stop()
        }
        self.connectionsByID.removeAll()
    }
    
    func processRequestInJavaScript(pathname: String, body: String) -> (isJSON: Bool, data: String) {
        let responseBody = self.js.evaluateScript("api.default(\"" + pathname + "\", `" + body + "`)");
        let isJSON = responseBody?.objectForKeyedSubscript("isJSON").toBool()
        let data = responseBody?.objectForKeyedSubscript("data").toString()
        return (isJSON!, data!)
    }
}
