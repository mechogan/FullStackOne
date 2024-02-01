import Foundation
import JavaScriptCore

extension JSContext {
    subscript(_ key: String) -> JSValue? {
        get { return objectForKeyedSubscript(key) }
    }

    subscript(_ key: String) -> Any? {
        get { return objectForKeyedSubscript(key) }
        set { setObject(newValue, forKeyedSubscript: key as NSString) }
    }
}

extension JSValue {
    subscript(_ key: String) -> JSValue? {
        get { return objectForKeyedSubscript(key) }
    }

    subscript(_ key: String) -> Any? {
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
        
        
        let requests = JSValue(newObjectIn: self.context)!
        self.context["requests"] = requests
        
        
        let fs = JSValue(newObjectIn: self.context)!
        fs["exists"] = JavaScript.exists
        fs["readdir"] = JavaScript.readdir
        fs["mkdir"] = JavaScript.mkdir
        fs["readfile"] = JavaScript.readfile
        fs["readfileUTF8"] = JavaScript.readfileUTF8
        fs["writefile"] = JavaScript.writefile
        fs["rm"] = JavaScript.rm
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
    private static let readdir: @convention (block) (String) -> [[String: String]] = { path in
        let items = try! FileManager.default.contentsOfDirectory(atPath: path)
        return items.map { item in
            var isDirectory: ObjCBool = false;
            let itemPath = path + "/" + item
            FileManager.default.fileExists(atPath: itemPath, isDirectory: &isDirectory)
            return ["name": item, "isDirectory": (isDirectory.boolValue ? "1" : "")]
        }
    }
    
    private static let readfile: @convention (block) (String) -> [UInt8] = { filename in
        let contents = FileManager.default.contents(atPath: filename)!
        return Array(contents)
    }
    private static let readfileUTF8: @convention (block) (String) -> String = { filename in
        let contents = FileManager.default.contents(atPath: filename)!
        return String(data: contents, encoding: .utf8)!
    }
    
    private static let mkdir: @convention (block) (String) -> Void = { path in
        try! FileManager.default.createDirectory(atPath: path, withIntermediateDirectories: true)
    }
    private static let rm: @convention (block) (String) -> Void = { path in
        try! FileManager.default.removeItem(atPath: path)
    }
    private static let writefile: @convention (block) (String, String) -> Void = { path, contents in
        try! contents.write(toFile: path, atomically: true, encoding: .utf8)
    }
    private static let exists: @convention (block) (String) -> Bool = { path in
        return FileManager.default.fileExists(atPath: path)
    }
}
