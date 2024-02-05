import Foundation
import JavaScriptCore

class JavaScript {
    private var requestId = 0
    let ctx = JSContext()!
    
    var privileged = false
    
    init(fsdir: String, assetdir: String, entrypointContents: String) {
        self.bindConsoleLog()
        self.bindFs(rootdir: fsdir)
        
        // global request object
        let requests = JSValue(newObjectIn: self.ctx)!
        self.ctx["requests"] = requests
        
        
        // assetdir
        self.ctx["assetdir"] = assetdir
        
        
        // errors
        self.ctx.exceptionHandler = { (context: JSContext?, exception: JSValue?) in
            print("JS Error: " + exception!.toString())
        }
        
        // start with entrypoint
        self.ctx.evaluateScript(entrypointContents)
    }
    
    func processRequest(headers: [String : String], pathname: String, body: Data?) -> (mimeType: String, data: Data?) {
        let requestId = String(self.requestId);
        self.requestId += 1;
        
        let jsRequest = JSValue(newObjectIn: self.ctx)!
        jsRequest["headers"] = headers
        jsRequest["pathname"] = pathname
        jsRequest["body"] = body != nil ? Array(body!) : nil
        
        self.ctx["requests"]?[requestId] = jsRequest
        
        let jsReponse = self.ctx.evaluateScript("api.default(\"\(requestId)\")")!
        let mimeType = jsReponse["mimeType"]!.toString()!
        
        let data = jsReponse.hasProperty("data")
            ? Data(jsReponse["data"]!.toArray()! as! [UInt8])
            : nil
        
        return (mimeType, data)
    }
    
    private func bindConsoleLog() {
        let patch = """
        var console = {
            log: function(...args) {
                var messages = args.map(arg => typeof arg === "object" ? JSON.stringify(arg, null, 2) : arg);
                console._log(messages);
            }
        }
        """
        self.ctx.evaluateScript(patch)
        self.ctx["console"]?["_log"] = JavaScript.consoleLog
    }
    
    private func bindFs(rootdir: String) {
        let realpath = { (path: String) -> String in
            return rootdir + "/" + path
        }
        
        // make sure only main app is privileged and bypasses the fsdir protection
        let realpathForAsset = { (path: String) -> String in
            return self.privileged
                ? path
                : realpath(path)
        }
        
        let readdir: @convention (block) (String) -> [[String: String]] = { directory in
            return JavaScript.readdir(directory: realpath(directory))
        }
        let readfile: @convention (block) (String, Bool) -> [UInt8] = { filename, forAsset in
            return JavaScript.readfile(filename: forAsset ? realpathForAsset(filename) : realpath(filename))
        }
        let readfileUTF8: @convention (block) (String, Bool) -> String = { filename, forAsset in
            return JavaScript.readfileUTF8(filename: forAsset ? realpathForAsset(filename) : realpath(filename))
        }
        let mkdir: @convention (block) (String) -> Void = {directory in
            JavaScript.mkdir(directory: realpath(directory))
        }
        let rm: @convention (block) (String) -> Void = { path in
            JavaScript.rm(path: realpath(path))
        }
        let putfile: @convention (block) (String, [UInt8]) -> Void = { filename, data in
            JavaScript.putfile(filename: realpath(filename), data: data)
        }
        let putfileUTF8: @convention (block) (String, String) -> Void = { filename, data in
            JavaScript.putfileUTF8(filename: realpath(filename), data: data)
        }
        let exists: @convention (block) (String, Bool) -> Bool = { path, forAsset in
            return JavaScript.exists(path: forAsset ? realpathForAsset(path) : realpath(path))
        }
        
        let fs = JSValue(newObjectIn: self.ctx)!
        fs["readdir"] = readdir
        fs["readfile"] = readfile
        fs["readfileUTF8"] = readfileUTF8
        fs["mkdir"] = mkdir
        fs["rm"] = rm
        fs["putfile"] = putfile
        fs["putfileUTF8"] = putfileUTF8
        fs["exists"] = exists
        self.ctx["fs"] = fs
    }
    
    private static let consoleLog: @convention (block) ([String]) -> Void = { message in
        print(message)
    }
    
    private static func readdir(directory: String) -> [[String: String]] {
        let items = try! FileManager.default.contentsOfDirectory(atPath: directory)
        return items.map { item in
            var isDirectory: ObjCBool = false;
            let itemPath = directory + "/" + item
            FileManager.default.fileExists(atPath: itemPath, isDirectory: &isDirectory)
            return ["name": item, "isDirectory": (isDirectory.boolValue ? "1" : "")]
        }
    }
    
    private static func readfile(filename: String) -> [UInt8] {
        let contents = FileManager.default.contents(atPath: filename)!
        return Array(contents)
    }
    private static func readfileUTF8(filename: String) -> String {
        let contents = FileManager.default.contents(atPath: filename)!
        return String(data: contents, encoding: .utf8)!
    }
    private static func mkdir(directory: String) -> Void {
        try! FileManager.default.createDirectory(atPath: directory, withIntermediateDirectories: true)
    }
    private static func rm(path: String) -> Void  {
        try! FileManager.default.removeItem(atPath: path)
    }
    private static func putfile(filename: String, data: [UInt8]) -> Void {
        print(filename)
        try! Data(data).write(to: URL(fileURLWithPath: filename))
    }
    private static func putfileUTF8(filename: String, data: String) -> Void {
        try! data.write(toFile: filename, atomically: true, encoding: .utf8)
    }
    private static func exists(path: String) -> Bool {
        return FileManager.default.fileExists(atPath: path)
    }
}

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
