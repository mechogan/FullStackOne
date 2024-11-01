//
//  Adapter.swift
//  FullStacked
//
//  Created by Charles-Philippe Lepage on 2024-03-22.
//

import Foundation
import UniformTypeIdentifiers
import SwiftyJSON

struct AdapterError {
    let code: String
    let path: String
    let syscall: String
    var toJSON: [String: Any] {
        return ["code": code, "path": path, "errno": -2, "syscall": syscall]
    }
}

class Adapter {
    let platform = "ios"
    let projectId: String?;
    var fs: AdapterFS
    
    init(projectId: String?, baseDirectory: String) {
        self.projectId = projectId
        self.fs = AdapterFS(baseDirectory: baseDirectory)
    }
    
    func callAdapterMethod(methodPath: [String.SubSequence], args: [Any?], done: @escaping  (_ maybeData: Any?) -> Void)  {
        if(methodPath.count == 0) {
            return done(nil)
        }
        
        switch(methodPath.first) {
        case "platform": return done(self.platform)
        case "fs":
            switch(methodPath[1]) {
            case "readFile":
                let utf8 = args.count > 1 && (args[1] as! JSON)["encoding"].stringValue == "utf8"
                return done(self.fs.readFile(path: args[0] as! String, utf8: utf8))
            case "writeFile":
                return done(self.fs.writeFile(file: args[0] as! String, strOrData: args[1]!))
            case "writeFileMulti":
                var i = 1;
                while(i < args.count) {
                    let file = args[i] as! String
                    let data = args[i + 1]!
                    let maybeError = self.fs.writeFile(file: file, strOrData: data)
                    if(maybeError is AdapterError){
                        return done(maybeError)
                    }
                    i += 2
                }
                return done(true)
            case "unlink": return done(self.fs.unlink(path: args[0] as! String))
            case "readdir":
                var withFileTypes = false
                var recursive = false
                if(args.count > 1) {
                    let options = args[1] as! JSON
                    withFileTypes = options["withFileTypes"].boolValue
                    recursive = options["recursive"].boolValue
                }
                return done(self.fs.readdir(path: args[0] as! String, withFileTypes: withFileTypes, recursive: recursive))
            case "mkdir": return done(self.fs.mkdir(path: args[0] as! String))
            case "rmdir": return done(self.fs.rmdir(path: args[0] as! String))
            case "stat": return done(self.fs.stat(path: args[0] as! String))
            case "lstat": return done(self.fs.lstat(path: args[0] as! String))
            case "exists":
                let exists = self.fs.exists(path: args[0] as! String)
                return done(exists == nil ? false : exists)
            case "rename":
                return done(self.fs.rename(oldPath: args[0] as! String, newPath: args[1] as! String))
            default: break
            }
            break
        case "fetch":
            let url = args[0] as! String
            
            var body: Data? = nil;
            if(args.count > 1) {
                if(args[1] is Data) {
                    body = (args[1] as! Data)
                } else if(args[1] is String) {
                    body = (args[1] as! String).data(using: .utf8)
                }
            }
            
            var method = "GET"
            var headers: [String: String] = [:]
            var timeout = 0.0
            
            var encoding = "utf8"
        
            if(args.count > 2 && args[2] is JSON) {
                let options = args[2] as! JSON
                
                if(!options["method"].stringValue.isEmpty) {
                    method = options["method"].stringValue
                }
                
                options["headers"].dictionaryValue.keys.forEach { header in
                    headers[header] = options["headers"][header].stringValue
                }
                
                if(options["timeout"].numberValue != 0) {
                    timeout = Double(truncating: options["timeout"].numberValue)
                }
                
                if(!options["encoding"].stringValue.isEmpty) {
                    encoding = options["encoding"].stringValue
                }
            }
            
            return self.fetch(
                urlStr: url,
                headers: headers,
                method: method,
                timeout: timeout,
                body: body ?? Data()) { headers, statusCode, statusMessage, data in
                    var body: String?
                    
                    if (encoding == "utf8") {
                        body = String(data: data, encoding: .utf8)
                    } else if (encoding == "base64") {
                        body = data.base64EncodedString()
                    }
                    
                    DispatchQueue.main.async {
                        done([
                            "headers": headers,
                            "statusCode": statusCode,
                            "statusMessage": statusMessage,
                            "body": body ?? ""
                        ])
                    }
                }
        case "fetchRaw":
            let url = args[0] as! String
            
            var body: Data? = nil;
            if(args.count > 1) {
                if(args[1] is Data) {
                    body = (args[1] as! Data)
                } else if(args[1] is String) {
                    body = (args[1] as! String).data(using: .utf8)
                }
            }
            
            var method = "GET"
            var headers: [String: String] = [:]
            var timeout = 15.0
        
            if(args.count > 2 && args[2] is JSON) {
                let options = args[2] as! JSON
                
                if(!options["method"].stringValue.isEmpty) {
                    method = options["method"].stringValue
                }
                
                options["headers"].dictionaryValue.keys.forEach { header in
                    headers[header] = options["headers"][header].stringValue
                }
                
                if(options["timeout"].numberValue != 0) {
                    timeout = Double(truncating: options["timeout"].numberValue)
                }
            }
            
            return self.fetch(
                urlStr: url,
                headers: headers,
                method: method,
                timeout: timeout,
                body: body ?? Data()) { headers, statusCode, statusMessage, data in
                    DispatchQueue.main.async {
                        done(data)
                    }
                }
        case "broadcast":
            let peerMessage = [
                "projectId": self.projectId,
                "data": (args[0] as! String)
            ]
            InstanceEditor.singleton!.push(messageType: "sendData", message: JSON(peerMessage).rawString()!)
            return done(true);
            
        default: break
        }
        
        return done(nil)
    }
    
    func fetch(urlStr: String,
               headers: [String: String],
               method: String,
               timeout: Double?,
               body: Data,
               onCompletion: @escaping (
                  _ headers: [String: String],
                  _ statusCode: Int,
                  _ statusMessage: String,
                  _ data: Data
               ) -> Void) {
                   let url = URL(string: urlStr)!
                   var request = URLRequest(url: url)
                   
                   request.httpMethod = method.isEmpty ? "GET" : method
                   
                   if(timeout != nil){
                       request.timeoutInterval = timeout!
                   }
                   
                   for (headerName, headerValue) in headers {
                       request.setValue(headerValue, forHTTPHeaderField: headerName)
                   }
                   
                   request.httpBody = body
                   
                   let task = URLSession.shared.dataTask(with: request) { data, response, error in
                       if error != nil {
                           onCompletion([:], 500, "Fetch error", Data())
                           return
                       }
                       
                       let headers = (response as! HTTPURLResponse).allHeaderFields as! [String: String]
                       let statusCode = (response as! HTTPURLResponse).statusCode
                       let statusMessage = "OK"
                       
                       onCompletion(headers, statusCode, statusMessage, data ?? Data())
                   }
                   task.resume()
               }
}

class AdapterFS {
    // @returns {nil} if doesn't exists, {true} if exists and directory, {false} if exists and file
    static func itemExistsAndIsDirectory (_ path: String) -> Bool? {
        var isDirectory: ObjCBool = false
        let exists = FileManager.default.fileExists(atPath: path, isDirectory: &isDirectory)
        return exists ? isDirectory.boolValue : nil
    }
    
    static func mimeType(filePath: String) -> String {
        if let mimeType = UTType(filenameExtension: (filePath as NSString).pathExtension)?.preferredMIMEType {
            return mimeType
        }
        else {
            return "application/octet-stream"
        }
    }
    
    let baseDirectory: String
    
    init(baseDirectory: String){
        self.baseDirectory = baseDirectory
    }
    
    func readFile(path: String, utf8: Bool) -> Any {
        let itemPath = self.baseDirectory + "/" + path
        
        let existsAndIsDirectory = AdapterFS.itemExistsAndIsDirectory(itemPath);
        if(existsAndIsDirectory == nil || existsAndIsDirectory!) {
            return AdapterError(
                code: existsAndIsDirectory != nil ? "EISDIR" : "ENOENT",
                path: path,
                syscall: "open"
            )
        }
        
        let contents = FileManager.default.contents(atPath: itemPath)!
        
        if(utf8){
            return String(data: contents, encoding: .utf8)!
        }
        
        return contents
    }
    
    func writeFile(file: String, strOrData: Any) -> Any? {
        let data: Data = strOrData is String
        ? (strOrData as! String).data(using: .utf8)!
        : (strOrData as! Data)
        
        let directory = file.split(separator: "/").dropLast()
        self.mkdir(path: directory.joined(separator: "/"))
        
        let itemPath = self.baseDirectory + "/" + file
        
        do {
            try data.write(to: URL(fileURLWithPath: itemPath))
        } catch {
            return AdapterError(
                code: "ENOENT",
                path: file,
                syscall: "open"
            )
        }
        
        return true
    }
    
    func unlink(path: String) {
        let itemPath = self.baseDirectory + "/" + path
        
        // let's at least try to act like nodejs unlink and not delete directories
        let existsAndIsDirectory = AdapterFS.itemExistsAndIsDirectory(itemPath)
        let isFile = existsAndIsDirectory != nil && !existsAndIsDirectory!
        if(isFile) {
            try! FileManager.default.removeItem(atPath: itemPath)
        }
    }
    
    func readdir(path: String, withFileTypes: Bool, recursive: Bool) -> Any {
        let itemPath = self.baseDirectory + "/" + path;
        
        let existsAndIsDirectory = AdapterFS.itemExistsAndIsDirectory(itemPath);
        if(existsAndIsDirectory == nil || !existsAndIsDirectory!) {
            return AdapterError(
                code: existsAndIsDirectory != nil ? "ENOTDIR" : "ENOENT",
                path: path,
                syscall: "open"
            )
        }
        
        var items = recursive
            ? []
            : try! FileManager.default.contentsOfDirectory(atPath: itemPath)
        
        if(recursive) {
            let enumarator = FileManager.default.enumerator(atPath: itemPath)
            while let element = enumarator?.nextObject() as? String {
                items.append(element)
            }
        }
        
        if(withFileTypes){
            let itemsWithFileTypes = items.map { childItem in
                var isDirectory: ObjCBool = false
                let childItemPath = itemPath + "/" + childItem
                FileManager.default.fileExists(atPath: childItemPath, isDirectory: &isDirectory)
                return ["name": childItem, "isDirectory": isDirectory.boolValue]
            }
            
            return itemsWithFileTypes
        }
        
        return items
    }
    
    func mkdir(path: String) {
        let itemPath = self.baseDirectory + "/" + path
        try! FileManager.default.createDirectory(atPath: itemPath, withIntermediateDirectories: true)
    }
    
    func rmdir(path: String) {
        let itemPath = self.baseDirectory + "/" + path
        
        // let's at least try to act like nodejs rmdir and delete only directories
        let existsAndIsDirectory = AdapterFS.itemExistsAndIsDirectory(itemPath);
        if(existsAndIsDirectory != nil && existsAndIsDirectory!) {
            try! FileManager.default.removeItem(atPath: itemPath)
        }
    }
    
    func stat (path: String) -> Any {
        let itemPath = self.baseDirectory + "/" + path;
        
        let existsAndIsDirectory = AdapterFS.itemExistsAndIsDirectory(itemPath);
        if(existsAndIsDirectory == nil) {
            return AdapterError(
                code: "ENOENT",
                path: path,
                syscall: "stat"
            )
        }
        
        let stats = try! FileManager.default.attributesOfItem(atPath: itemPath)
        
        return [
            "size": stats[FileAttributeKey.size],
            "isDirectory": existsAndIsDirectory!,
            "isFile": !existsAndIsDirectory!,
            "ctime": (stats[FileAttributeKey.creationDate] as! Date).ISO8601Format() ,
            "ctimeMs": (stats[FileAttributeKey.creationDate] as! Date).timeIntervalSince1970 * 1000,
            "mtime": (stats[FileAttributeKey.modificationDate] as! Date).ISO8601Format(),
            "mtimeMs": (stats[FileAttributeKey.modificationDate] as! Date).timeIntervalSince1970 * 1000
        ]
    }
    
    func lstat(path: String) -> Any {
        return self.stat(path: path)
    }
    
    func exists(path: String) -> Any? {
        let itemPath = self.baseDirectory + "/" + path
        
        let existsAndIsDirectory = AdapterFS.itemExistsAndIsDirectory(itemPath)
        if(existsAndIsDirectory == nil){
            return nil
        }
        
        return [
            "isFile": !existsAndIsDirectory!
        ]
    }
    
    func rename(oldPath: String, newPath: String) -> Any? {
        if(oldPath == newPath) {
            return true
        }
        
        let newFilePath = self.baseDirectory + "/" + newPath
        
        let existsAndIsDirectory = AdapterFS.itemExistsAndIsDirectory(newFilePath)
        if(existsAndIsDirectory != nil) {
            if(existsAndIsDirectory!) {
                self.rmdir(path: newPath)
            } else {
                self.unlink(path: newPath)
            }
        }
        
        let pathA = URL(fileURLWithPath: self.baseDirectory + "/" + oldPath)
        let pathB = URL(fileURLWithPath: newFilePath)
        
        try! FileManager.default.moveItem(at: pathA, to: pathB)
        return true
    }
}
