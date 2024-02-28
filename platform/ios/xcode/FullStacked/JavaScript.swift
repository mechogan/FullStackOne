import Foundation
import JavaScriptCore

class JavaScript {
    private var requestId = 0
    let ctx = JSContext()!
    var push: ((String, String) -> Void)? = nil
    let logFn: (String) -> Void
    
    var privileged = false
    
    init(
        logFn: @escaping (String) -> Void,
        fsdir: String,
        assetdir: String,
        entrypointContents: String
    ) {
        self.logFn = logFn;
        
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
        let realpathForAsset = { (path: String) -> String in
            return self.privileged
                ? path
                : realpath(path)
        }
        
        let readdir: @convention (block) (String) -> [[String: Any]] = { directory in
            let items = try! FileManager.default.contentsOfDirectory(atPath: realpath(directory))
            return items.map { item in
                var isDirectory: ObjCBool = false;
                let itemPath = directory + "/" + item
                FileManager.default.fileExists(atPath: realpath(itemPath), isDirectory: &isDirectory)
                return ["name": item, "isDirectory": isDirectory.boolValue]
            }
        }
        let readfile: @convention (block) (String, Bool) -> JSValue? = { [self] filename, forAsset in
            let contents = FileManager.default.contents(atPath: forAsset ? realpathForAsset(filename) : realpath(filename))!
            return contents.toUint8Array(ctx: self.ctx)
        }
        let readfileUTF8: @convention (block) (String, Bool) -> String = { filename, forAsset in
            let contents = FileManager.default.contents(atPath: forAsset ? realpathForAsset(filename) : realpath(filename))!
            return String(data: contents, encoding: .utf8)!
        }
        let mkdir: @convention (block) (String) -> Void = {directory in
            try! FileManager.default.createDirectory(atPath: realpath(directory), withIntermediateDirectories: true)
        }
        let rm: @convention (block) (String) -> Void = { path in
            try! FileManager.default.removeItem(atPath: realpath(path))
        }
        let putfile: @convention (block) (String, [UInt8]) -> Void = { filename, data in
            try! Data(data).write(to: URL(fileURLWithPath: realpath(filename)))
        }
        let putfileUTF8: @convention (block) (String, String) -> Void = { filename, data in
            try! data.write(toFile: realpath(filename), atomically: true, encoding: .utf8)
        }
        let exists: @convention (block) (String, Bool) -> Bool = { path, forAsset in
            return FileManager.default.fileExists(atPath: forAsset ? realpathForAsset(path) : realpath(path))
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
    
    private func bindFetch() {
        let fetchCallbackData: @convention (block) (String, JSValue, [String: String]?, JSValue?, [UInt8]?) -> Void =
        { urlStr, onCompletion, headers, method, body  in
            let url = URL(string: urlStr)!
            var request = URLRequest(url: url)

            request.httpMethod = method!.isUndefined ? "GET" : method?.toString()!
            
            if (headers != nil) {
                for (headerName, headerValue) in headers! {
                    request.setValue(headerValue, forHTTPHeaderField: headerName)
                }
            }
            
            if (body != nil) {
                request.httpBody = Data(body!)
            }
            
            let task = URLSession.shared.dataTask(with: request) { data, response, error in
                if error != nil {
                    self.logFn("[\"Fetch Error for \(urlStr)\"]")
                    onCompletion.call(withArguments: [[:], ""])
                    return
                }
                
                let headers = (response as! HTTPURLResponse).allHeaderFields as! [String: String]
                DispatchQueue.main.async {
                    if(data == nil){
                        onCompletion.call(withArguments: [headers])
                        return;
                    }
                    
                    let uint8array = data?.toUint8Array(ctx: self.ctx);
                    onCompletion.call(withArguments: [headers, uint8array!])
                }
            }
            task.resume()
        }
        
        let fetchCallbackUTF8: @convention (block) (String, JSValue, [String: String]?, JSValue?, [UInt8]?) -> Void =
        { urlStr, onCompletion, headers, method, body  in
            let url = URL(string: urlStr)!
            var request = URLRequest(url: url)

            request.httpMethod = method!.isUndefined ? "GET" : method?.toString()!
            
            if (headers != nil) {
                for (headerName, headerValue) in headers! {
                    request.setValue(headerValue, forHTTPHeaderField: headerName)
                }
            }
            
            if (body != nil) {
                request.httpBody = Data(body!)
            }
            
            let task = URLSession.shared.dataTask(with: request) { data, response, error in
                if error != nil {
                    self.logFn("[\"Fetch Error for \(urlStr)\"]")
                    onCompletion.call(withArguments: [[:], ""])
                    return
                }
                
                let headers = (response as! HTTPURLResponse).allHeaderFields as! [String: String]
                let body = String(data: data!, encoding: .utf8)!
                DispatchQueue.main.async {
                    onCompletion.call(withArguments: [headers, body])
                }
            }
            task.resume()
        }
        
        let fetchCallback = JSValue(newObjectIn: self.ctx)!
        fetchCallback["data"] = fetchCallbackData
        fetchCallback["UTF8"] = fetchCallbackUTF8
        
        self.ctx["fetchCallback"] = fetchCallback
        
        let patch = """
        var fetch = {
            data: (url, options) => {
                return new Promise(resolve => {
                    fetchCallback.data(url, (headers, data) => resolve({ headers, body: data }), options?.headers, options?.method, options?.body)
                })
            },
            UTF8: (url, options) => {
                return new Promise(resolve => {
                    fetchCallback.UTF8(url, (headers, UTF8) => resolve({ headers, body: UTF8 }), options?.headers, options?.method, options?.body)
                })
            }
        }
        """
        self.ctx.evaluateScript(patch)
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
