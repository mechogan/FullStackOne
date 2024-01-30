import Foundation
import JavaScriptCore

extension JSContext {
    subscript(_ key: NSString) -> JSValue? {
        get { return objectForKeyedSubscript(key) }
    }

    subscript(_ key: NSString) -> Any? {
        get { return objectForKeyedSubscript(key) }
        set { setObject(newValue, forKeyedSubscript: key) }
    }
}

extension JSValue {
    subscript(_ key: NSString) -> JSValue? {
        get { return objectForKeyedSubscript(key) }
    }

    subscript(_ key: NSString) -> Any? {
        get { return objectForKeyedSubscript(key) }
        set { setObject(newValue, forKeyedSubscript: key) }
    }
}

class JavaScript {
    let context: JSContext
    
    init(workdir: String) {
        self.context = JSContext()
        
        self.context["workdir"] = workdir
        
        let patch = """
        var console = {
            log: function(...args) {
                var messages = args.map(arg => typeof arg === "object" ? JSON.stringify(arg, null, 2) : arg);
                console._log(messages.join(", "));
            }
        }
        """
        self.context.evaluateScript(patch)
        self.context["console"]?["_log"] = JavaScript.consoleLog
        
        let fs = JSValue(newObjectIn: self.context)!
        fs["existsSync"] = JavaScript.exists
        fs["readdirSync"] = JavaScript.readDir
        fs["mkdirSync"] = JavaScript.mkdir
        fs["readFileSync"] = JavaScript.readFile
        fs["writeFileSync"] = JavaScript.writeFile
        fs["rmSync"] = JavaScript.rm
        self.context["fs"] = fs
        
        self.context.exceptionHandler = { (context: JSContext?, exception: JSValue?) in
            print("JS Error: " + exception!.toString())
        }
    }
    
    func run(script: String) {
        self.context.evaluateScript(script)
    }
    
    func processRequest(pathname: String, body: String) -> (isJSON: Bool, data: String) {
        let responseBody = self.context.evaluateScript("api.default(\"" + pathname + "\", `" + body + "`)");
        let isJSON = responseBody?.objectForKeyedSubscript("isJSON").toBool()
        let data = responseBody?.objectForKeyedSubscript("data").toString()
        return (isJSON!, data!)
    }
    
    private static let consoleLog: @convention (block) (String) -> Void = {message in
        print(message)
    }
    private static let readDir: @convention (block) (String) -> [[String: String]] = { path in
        let items = try! FileManager.default.contentsOfDirectory(atPath: path)
        return items.map { item in
            var isDirectory: ObjCBool = false;
            let itemPath = path + "/" + item
            FileManager.default.fileExists(atPath: itemPath, isDirectory: &isDirectory)
            return ["name": item, "isDirectory": (isDirectory.boolValue ? "1" : "")]
        }
    }
    private static let readFile: @convention (block) (String) -> String = { path in
        let contents = FileManager.default.contents(atPath: path)
        return String(data: contents!, encoding: .utf8)!
    }
    private static let mkdir: @convention (block) (String) -> Void = { path in
        try! FileManager.default.createDirectory(atPath: path, withIntermediateDirectories: true)
    }
    private static let rm: @convention (block) (String) -> Void = { path in
        try! FileManager.default.removeItem(atPath: path)
    }
    private static let writeFile: @convention (block) (String, String) -> Void = { path, contents in
        try! contents.write(toFile: path, atomically: true, encoding: .utf8)
    }
    private static let exists: @convention (block) (String) -> Bool = { path in
        return FileManager.default.fileExists(atPath: path)
    }
}
