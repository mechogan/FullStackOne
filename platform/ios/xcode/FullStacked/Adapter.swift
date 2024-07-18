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
    
    func callAdapterMethod(methodPath: [String.SubSequence], body: Data, done: @escaping  (_ maybeData: Any?) -> Void)  {
        if(methodPath.count == 0) {
            return done(nil)
        }
        
        let json = body.count == 0 ? JSON("{}") : try! JSON(data: body)
        
        let writeFile = { (path: String, data: Data, recursive: Bool) in
            if(recursive) {
                let directory = path.split(separator: "/").dropLast()
                self.fs.mkdir(path: directory.joined(separator: "/"))
            }
            
            return self.fs.writeFile(file: path, data: data)
        }
        
        switch(methodPath.first) {
        case "platform": return done(self.platform)
        case "fs":
            switch(methodPath[1]) {
            case "readFile": return done(self.fs.readFile(path: json[0].stringValue, utf8: json[1]["encoding"].stringValue == "utf8"))
            case "writeFile":
                var data: Data;
                
                if(json[1]["type"].stringValue == "Uint8Array") {
                    let uint8array = json[1]["data"].arrayValue.map({ number in
                        return number.uInt8!
                    })
                    data = Data(uint8array)
                } else {
                    data = json[1].stringValue.data(using: .utf8)!
                }
                
            return done(writeFile(json[0].stringValue, data, json[2]["recursive"].boolValue))
            case "writeFileMulti":
                for fileJSON in json[0].arrayValue {
                    var data: Data;
                    
                    if(fileJSON["data"]["type"].stringValue == "Uint8Array") {
                        let uint8array = fileJSON["data"]["data"].arrayValue.map({ number in
                            return number.uInt8!
                        })
                        data = Data(uint8array)
                    } else {
                        data = fileJSON["data"].stringValue.data(using: .utf8)!
                    }
                    
                    let maybeError = writeFile(fileJSON["path"].stringValue, data, json[2]["recursive"].boolValue)
                    if(maybeError is AdapterError){
                        return done(maybeError)
                    }
                }
                return done(true)
            case "unlink": return done(self.fs.unlink(path: json[0].stringValue))
            case "readdir": return done(self.fs.readdir(path: json[0].stringValue, withFileTypes: json[1]["withFileTypes"].boolValue, recursive: json[1]["recursive"].boolValue))
            case "mkdir": return done(self.fs.mkdir(path: json[0].stringValue))
            case "rmdir": return done(self.fs.rmdir(path: json[0].stringValue))
            case "stat": return done(self.fs.stat(path: json[0].stringValue))
            case "lstat": return done(self.fs.lstat(path: json[0].stringValue))
            case "exists":
                let exists = self.fs.exists(path: json[0].stringValue)
                return done(exists == nil ? false : exists)
            default: break
            }
            break
        case "fetch":
            var body: Data;
            
            if(json[1]["body"]["type"].stringValue == "Uint8Array") {
                let uint8array = json[1]["body"]["data"].arrayValue.map({ number in
                    return number.uInt8!
                })
                body = Data(uint8array)
            } else {
                body = json[1]["body"].stringValue.data(using: .utf8)!
            }
        
            let headersJSON = json[1]["headers"].dictionaryValue
            var headers: [String: String] = [:]
            headersJSON.keys.forEach { header in
                headers[header] = headersJSON[header]!.stringValue
            }
            
            return self.fetch(
                urlStr: json[0].stringValue,
                headers: headers,
                method: json[1]["method"].stringValue,
                timeout: json[1]["timeout"].double,
                body: body) { headers, statusCode, statusMessage, data in
                    var body: Any?
                    
                    if (json[1]["encoding"].stringValue == "utf8") {
                        body = String(data: data, encoding: .utf8)
                    } else {
                        body = ["type": "Uint8Array", "data": [UInt8](data)]
                    }
                    
                    DispatchQueue.main.async {
                        done([
                            "headers": headers,
                            "statusCode": statusCode,
                            "statusMessage": statusMessage,
                            "body": body
                        ])
                    }
                }
        case "broadcast":
            let peerMessage = [
                "projectId": self.projectId,
                "data": json[0].stringValue
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
                       request.timeoutInterval = timeout! / 1000
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
    
    func writeFile(file: String, data: Data) -> Any? {
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
}
