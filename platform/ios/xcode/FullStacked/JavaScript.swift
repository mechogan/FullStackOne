import Foundation
import JavaScriptCore
import WebKit

class JavaScript {
    let ctx = JSContext()!
    let logFn: (String) -> Void
    var push:  (@convention (block) (String, String) -> Void)?
    var webview: WKWebView? = nil
    var unsentMessages: [(String, String)] = []
    
    var privileged = false
    
    init(
        logFn: @escaping (String) -> Void,
        fsdir: String,
        assetdir: String,
        entrypointContents: String
    ) {
        self.logFn = logFn;
        self.push = { messageType, message in
            if(self.webview == nil || self.webview!.isLoading) {
                self.unsentMessages.append((messageType, message));
                return;
            }
            
            DispatchQueue.main.async {
                self.webview?.evaluateJavaScript("window.push(`\(messageType)`, `\(message.replacingOccurrences(of: "\\", with: "\\\\"))`)")
            }
        }
        
        self.ctx["push"] = self.push
        
        
        self.bindConsoleLog()
        self.bindFs(rootdir: fsdir)
        self.bindFetch()
        
        // global request object
        let requests = JSValue(newObjectIn: self.ctx)!
        self.ctx["requests"] = requests
        
        // platform
        self.ctx["platform"] = "iOS"
        
        // assetdir
        self.ctx["assetdir"] = assetdir
        
        // errors
        self.ctx.exceptionHandler = { (context: JSContext?, exception: JSValue?) in
            self.logFn("[\"Error: " + exception!.toString() + "\"]")
        }
        
        // start with entrypoint
        self.ctx.evaluateScript(entrypointContents)
    }
    
    func processRequest(
        headers: [String : String],
        pathname: String,
        body: Data?,
        onCompletion: @escaping (_ jsResponse: JSValue) -> Void
    ) -> Void {
        // source: https://stackoverflow.com/a/75690743
        let onFulfilled: @convention (block) (JSValue) -> Void = {
            onCompletion($0)
        }
        let onRejected: @convention (block) (JSValue) -> Void = {
            print($0)
        }
        let promiseArgs = [unsafeBitCast(onFulfilled, to: JSValue.self), unsafeBitCast(onRejected, to: JSValue.self)]
        
        let payload = body != nil ? body!.toUint8Array(ctx: self.ctx) : nil
        self.ctx["api"]?["default"]?.call(withArguments: [headers, pathname, payload as Any])
            .invokeMethod("then", withArguments: promiseArgs)
    }
    
    private func bindConsoleLog() {
        let patch = """
        var console = {
            log: function(...args) {
                console._log(JSON.stringify(args));
            }
        }
        """
        self.ctx.evaluateScript(patch)
        
        let consoleLog: @convention (block) (String) -> Void = { args in
            self.logFn(args)
        }
        
        self.ctx["console"]?["_log"] = consoleLog
    }
    
    private func bindFs(rootdir: String) {
        let realpath = { (path: String) -> String in
            return rootdir + "/" + path
        }
        
        // make sure only main app is privileged and bypasses the fsdir protection
        let realpathWithAbsolutePath = { (path: String) -> String in
            return self.privileged
                ? path
                : realpath(path)
        }
        
        // @returns {nil} if doesn't exists, {true} if exists and directory, {false} if exists and file
        let itemExistsAndIsDirectory = { (_ path: String, _ absolutePath: Bool) -> Bool? in
            let itemPath = absolutePath
                ? realpathWithAbsolutePath(path)
                : realpath(path)
            var isDirectory: ObjCBool = false;
            let exists = FileManager.default.fileExists(atPath: itemPath, isDirectory: &isDirectory)
            return exists ? isDirectory.boolValue : nil
        }
        
        
        let readFile: @convention (block) (String, JSValue?) -> JSValue = { path, options in
            let absolutePath = !options!.isUndefined && !options!["absolutePath"]!.isUndefined && options!["absolutePath"]!.toBool()
                
            let existsAndIsDirectory = itemExistsAndIsDirectory(path, absolutePath);
            if(existsAndIsDirectory == nil || existsAndIsDirectory!) {
                return JSValue(newPromiseIn: self.ctx) { resolve, reject in
                    let errorObject = JSValue(newErrorFromMessage: existsAndIsDirectory != nil ? "Not a file" : "No such file or directory", in: self.ctx)!
                    errorObject["code"] = existsAndIsDirectory != nil ? "EISDIR" : "ENOENT"
                    errorObject["path"] = path
                    reject!.call(withArguments: [ errorObject ])
                }
            }
            
            let itemPath = absolutePath
                ? realpathWithAbsolutePath(path)
                : realpath(path)
            
            let contents = FileManager.default.contents(atPath: itemPath)!
            
            if(options?["encoding"]?.toString() == "utf8"){
                let stringValue = String(data: contents, encoding: .utf8)!
                
                return JSValue(newPromiseIn: self.ctx) { resolve, reject in
                    resolve!.call(withArguments: [stringValue])
                }
            }
            
            return JSValue(newPromiseIn: self.ctx) { resolve, reject in
                resolve!.call(withArguments: [contents.toUint8Array(ctx: self.ctx)!])
            }
        }
        
        let writeFile: @convention (block) (String, JSValue) -> JSValue = { file, data in
            let itemPath = realpath(file)
            
            do {
                if (data.isString) {
                    let stringValue = data.toString()!
                    try stringValue.write(toFile: itemPath, atomically: true, encoding: .utf8)
                } else {
                    let data = Data(data.toArray()! as! [UInt8])
                    try Data(data).write(to: URL(fileURLWithPath: itemPath))
                }
            } catch {
                return JSValue(newPromiseIn: self.ctx) { resolve, reject in
                    let errorObject = JSValue(newErrorFromMessage: "No such file or directory", in: self.ctx)!
                    errorObject["code"] = "ENOENT"
                    errorObject["path"] = file
                    reject!.call(withArguments: [ errorObject ])
                }
            }
            
            
            return JSValue(newPromiseIn: self.ctx) { resolve, reject in
                resolve!.call(withArguments: [])
            }
        }
        
        let unlink: @convention (block) (String) -> JSValue = { path in
            // let's at least try to act like nodejs unlink and not delete directories
            let existsAndIsDirectory = itemExistsAndIsDirectory(path, false)
            let isFile = existsAndIsDirectory != nil && !existsAndIsDirectory!
            if(isFile) {
                let itemPath = realpath(path)
                try! FileManager.default.removeItem(atPath: itemPath)
            }
            
            return JSValue(newPromiseIn: self.ctx) { resolve, reject in
                resolve!.call(withArguments: [])
            }
        }
        
        let readdir: @convention (block) (String, JSValue?) -> JSValue = { path, options in
            let existsAndIsDirectory = itemExistsAndIsDirectory(path, false);
            if(existsAndIsDirectory == nil || !existsAndIsDirectory!) {
                return JSValue(newPromiseIn: self.ctx) { resolve, reject in
                    let errorObject = JSValue(newErrorFromMessage: existsAndIsDirectory != nil ? "Not a directory" : "No such file or directory", in: self.ctx)!
                    errorObject["code"] = existsAndIsDirectory != nil ? "ENOTDIR" : "ENOENT"
                    errorObject["path"] = path
                    reject!.call(withArguments: [ errorObject ])
                }
            }
            
            let itemPath = realpath(path);
            
            let items = try! FileManager.default.contentsOfDirectory(atPath: itemPath)
            
            if(!options!.isUndefined && !options!["withFileTypes"]!.isUndefined && options!["withFileTypes"]!.toBool()){
                let itemsWithFileTypes = items.map { item in
                    var isDirectory: ObjCBool = false;
                    let itemPath = path + "/" + item
                    FileManager.default.fileExists(atPath: realpath(itemPath), isDirectory: &isDirectory)
                    return ["name": item, "isDirectory": isDirectory.boolValue]
                }
                
                return JSValue(newPromiseIn: self.ctx) { resolve, reject in
                    resolve!.call(withArguments: [itemsWithFileTypes])
                }
            }
            
            return JSValue(newPromiseIn: self.ctx) { resolve, reject in
                resolve!.call(withArguments: [items])
            }
        }
        
        let mkdir: @convention (block) (String) -> JSValue = { path in
            let itemPath = realpath(path)
            
            try! FileManager.default.createDirectory(atPath: itemPath, withIntermediateDirectories: true)

            return JSValue(newPromiseIn: self.ctx) { resolve, reject in
                resolve!.call(withArguments: [])
            }
        }
        
        let rmdir: @convention (block) (String) -> JSValue = { path in
            let itemPath = realpath(path)
            
            // let's at least try to act like nodejs rmdir and delete only directories
            var isDirectory: ObjCBool = false;
            let exists = FileManager.default.fileExists(atPath: itemPath, isDirectory: &isDirectory)
            
            if(exists && isDirectory.boolValue) {
                try! FileManager.default.removeItem(atPath: itemPath)
            }
            
            return JSValue(newPromiseIn: self.ctx) { resolve, reject in
                resolve!.call(withArguments: [])
            }
        }
        
        let returnTrue: @convention (block) () -> Bool = {
            return true;
        }
        let returnFalse: @convention (block) () -> Bool = {
            return false;
        }
        
        let stat: @convention (block) (String, JSValue?) -> JSValue = { path, options in
            let existsAndIsDirectory = itemExistsAndIsDirectory(path, false);
            if(existsAndIsDirectory == nil) {
                return JSValue(newPromiseIn: self.ctx) { resolve, reject in
                    let errorObject = JSValue(newErrorFromMessage: "No such file or directory", in: self.ctx)!
                    errorObject["code"] = "ENOENT"
                    errorObject["path"] = path
                    reject!.call(withArguments: [ errorObject ])
                }
            }
            
            let itemPath = realpath(path)
            
            let jsObj = JSValue(newObjectIn: self.ctx)!
            jsObj["isDirectory"] = existsAndIsDirectory! ? returnTrue : returnFalse;
            jsObj["isFile"] = !existsAndIsDirectory! ? returnTrue : returnFalse;
            
            let stats = try! FileManager.default.attributesOfItem(atPath: itemPath)
            
            let size = stats[FileAttributeKey.size];
            jsObj["size"] = size;
            
            let ctime = stats[FileAttributeKey.creationDate]
            let ctimeMs = (ctime as! Date).timeIntervalSince1970 * 1000
            jsObj["ctime"] = self.ctx.evaluateScript("new Date(" + String(ctimeMs) + ")")!
            jsObj["ctimeMs"] = ctimeMs
            
            let mtime = stats[FileAttributeKey.modificationDate]
            let mtimeMs = (mtime as! Date).timeIntervalSince1970 * 1000
            jsObj["mtime"] = self.ctx.evaluateScript("new Date(" + String(mtimeMs) + ")")!
            jsObj["mtimeMs"] = mtimeMs
            
            return JSValue(newPromiseIn: self.ctx) { resolve, reject in
                resolve!.call(withArguments: [jsObj])
            }
        }
        
        let lstat: @convention (block) (String, JSValue?) -> JSValue = { path, options in
            let existsAndIsDirectory = itemExistsAndIsDirectory(path, false);
            if(existsAndIsDirectory == nil) {
                return JSValue(newPromiseIn: self.ctx) { resolve, reject in
                    let errorObject = JSValue(newErrorFromMessage: "No such file or directory", in: self.ctx)!
                    errorObject["code"] = "ENOENT"
                    errorObject["path"] = path
                    reject!.call(withArguments: [ errorObject ])
                }
            }
            
            let itemPath = realpath(path)
            
            let jsObj = JSValue(newObjectIn: self.ctx)!
            jsObj["isDirectory"] = existsAndIsDirectory! ? returnTrue : returnFalse;
            jsObj["isFile"] = !existsAndIsDirectory! ? returnTrue : returnFalse;
            jsObj["isSymbolicLink"] = returnFalse;
            
            let stats = try! FileManager.default.attributesOfItem(atPath: itemPath)
            
            let size = stats[FileAttributeKey.size];
            jsObj["size"] = size;
            
            let ctime = stats[FileAttributeKey.creationDate]
            let ctimeMs = (ctime as! Date).timeIntervalSince1970 * 1000
            jsObj["ctime"] = self.ctx.evaluateScript("new Date(" + String(ctimeMs) + ")")!
            jsObj["ctimeMs"] = ctimeMs
            
            let mtime = stats[FileAttributeKey.modificationDate]
            let mtimeMs = (mtime as! Date).timeIntervalSince1970 * 1000
            jsObj["mtime"] = self.ctx.evaluateScript("new Date(" + String(mtimeMs) + ")")!
            jsObj["mtimeMs"] = mtimeMs
            
            return JSValue(newPromiseIn: self.ctx) { resolve, reject in
                resolve!.call(withArguments: [jsObj])
            }
        }
        
        let exists: @convention (block) (String, JSValue?) -> JSValue = { path, options in
            let absolutePath = !options!.isUndefined && !options!["absolutePath"]!.isUndefined && options!["absolutePath"]!.toBool()
            
            let exists = itemExistsAndIsDirectory(path, absolutePath)
            let value = JSValue(bool: exists != nil, in: self.ctx)!
            
            return JSValue(newPromiseIn: self.ctx) { resolve, reject in
                resolve!.call(withArguments: [value])
            }
        }
        
        let isFile: @convention (block) (String, JSValue?) -> JSValue = { path, options in
            let absolutePath = !options!.isUndefined && !options!["absolutePath"]!.isUndefined && options!["absolutePath"]!.toBool()
            
            let existsAndIsDirectory = itemExistsAndIsDirectory(path, absolutePath)
            let isFile = existsAndIsDirectory != nil && !existsAndIsDirectory!
            let value = JSValue(bool: isFile, in: self.ctx)!
            
            return JSValue(newPromiseIn: self.ctx) { resolve, reject in
                resolve!.call(withArguments: [value])
            }
        }
        let isDirectory: @convention (block) (String, JSValue?) -> JSValue = { path, options in
            let absolutePath = !options!.isUndefined && !options!["absolutePath"]!.isUndefined && options!["absolutePath"]!.toBool()
            
            let existsAndIsDirectory = itemExistsAndIsDirectory(path, absolutePath)
            let isDirecotry = existsAndIsDirectory != nil && existsAndIsDirectory!
            let value = JSValue(bool: isDirecotry, in: self.ctx)!
            
            return JSValue(newPromiseIn: self.ctx) { resolve, reject in
                resolve!.call(withArguments: [value])
            }
        }
        
        let notImplemented: @convention (block) () -> Void = {
            print("Calling method not implemented")
        }
        
        let fs = JSValue(newObjectIn: self.ctx)!
        fs["readFile"] = readFile
        fs["writeFile"] = writeFile
        fs["unlink"] = unlink
        fs["readdir"] = readdir
        fs["mkdir"] = mkdir
        fs["rmdir"] = rmdir
        fs["stat"] = stat
        fs["lstat"] = lstat
        fs["exists"] = exists
        fs["isFile"] = isFile
        fs["isDirectory"] = isDirectory
        
        fs["readlink"] = notImplemented
        fs["symlink"] = notImplemented
        fs["chmod"] = notImplemented
        self.ctx["fs"] = fs
    }
    
    private func bindFetch() {
        let fetchMethod: @convention (block) (String, JSValue?) -> JSValue = { urlStr, options in
            let url = URL(string: urlStr)!
            var request = URLRequest(url: url)
            
            request.httpMethod = !options!.isUndefined && options!["method"]!.isString
                ? options!["method"]!.toString()!
                : "GET"
            
            if (!options!.isUndefined && options!["headers"]!.isObject) {
                let headers = options!["headers"]!.toDictionary() as! [String: String]
                for (headerName, headerValue) in headers {
                    request.setValue(headerValue, forHTTPHeaderField: headerName)
                }
            }
            
            if (!options!.isUndefined && !options!["body"]!.isUndefined) {
                let body = options!["body"]!.isString
                    ? options!["body"]!.toString().data(using: .utf8)
                    : Data(options!["body"]!.toArray() as! [UInt8])
                
                request.httpBody = body
            }
            
            return JSValue(newPromiseIn: self.ctx) { resolve, reject in
                let task = URLSession.shared.dataTask(with: request) { data, response, error in
                    if error != nil {
                        reject!.call(withArguments: ["[\"Fetch Error for \(urlStr)\"]"])
                        return
                    }
                    
                    let headers = (response as! HTTPURLResponse).allHeaderFields as! [String: String]

                    let responseObj = JSValue(newObjectIn: self.ctx)!
                    responseObj["url"] = response?.url
                    responseObj["headers"] = headers
                    responseObj["method"] = request.httpMethod
                    responseObj["statusCode"] = (response as! HTTPURLResponse).statusCode
                    responseObj["statusMessage"] = "OK"
                    
                    if(data != nil) {
                        if(!options!.isUndefined && options!["encoding"]!.isString && options!["encoding"]!.toString() == "utf8"){
                            responseObj["body"] = String(data: data!, encoding: .utf8)!
                        } else {
                            responseObj["body"] = data!.toUint8Array(ctx: self.ctx)
                        }
                    }
                    
                    resolve!.call(withArguments: [responseObj])
                }
                task.resume()
            }
        }
        
        
        self.ctx["fetch"] = fetchMethod
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

extension Data {
    func toUint8Array(ctx: JSContext) -> JSValue? {
        // source: https://gist.github.com/hyperandroid/52f8198347d61c3fa62c75c72c31deb6
        let ptr: UnsafeMutableBufferPointer<UInt8> = UnsafeMutableBufferPointer<UInt8>.allocate(capacity: self.count)
        try! self.withUnsafeBytes<UInt8> { (contentsPtr: UnsafeRawBufferPointer) -> Void in
            let _ = ptr.initialize(from: UnsafeRawBufferPointer(contentsPtr))
        }
        var exception : JSValueRef?
        let deallocator: JSTypedArrayBytesDeallocator = { ptr, deallocatorContext in
            ptr?.deallocate()
        }
        let arrayBufferRef = JSObjectMakeTypedArrayWithBytesNoCopy(
            ctx.jsGlobalContextRef,
            kJSTypedArrayTypeUint8Array,
            ptr.baseAddress,
            self.count,
            deallocator,
            nil,
            &exception)

        if exception != nil {
            ctx.exception = JSValue(jsValueRef: exception, in: ctx)
            return nil
        }
        
        return JSValue(jsValueRef: arrayBufferRef, in: ctx)
    }
}
