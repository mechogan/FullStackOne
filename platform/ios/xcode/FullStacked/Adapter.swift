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
    var fs: AdapterFS
    
    init(baseDirectory: String) {
        self.fs = AdapterFS(baseDirectory: baseDirectory);
    }
    
    func callAdapterMethod(methodPath: [String.SubSequence], body: Data) -> Any? {
        if(methodPath.count == 0) {
            return nil
        }
        
        let json = try! JSON(data: body)
        
        switch(methodPath.first) {
            case "platform": return self.platform
            case "fs":
                switch(methodPath[1]){
                    case "readFile": return self.fs.readFile(path: json[0].stringValue, utf8: json[1]["encoding"].stringValue == "utf8")
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
                        
                        return self.fs.writeFile(file: json[0].stringValue, data: data)
                    
                    case "unlink": return self.fs.unlink(path: json[0].stringValue)
                    case "readdir": return self.fs.readdir(path: json[0].stringValue, withFileTypes: json[1]["withFileTypes"].boolValue)
                    case "mkdir": return self.fs.mkdir(path: json[0].stringValue)
                    case "rmdir": return self.fs.rmdir(path: json[0].stringValue)
                    case "stat": return self.fs.stat(path: json[0].stringValue)
                    case "lstat": return self.fs.lstat(path: json[0].stringValue)
                    case "exists": return self.fs.exists(path: json[0].stringValue)
                    default: break
                }
                break
            default: return nil
        }
        
        return nil
    }
    
    func fetch(urlStr: String,
               headers: Dictionary<String, String>,
               method: String,
               body: Data,
               utf8: Bool,
               onCompletion: @escaping (
                  _ headers: Dictionary<String, String>,
                  _ statusCode: Int,
                  _ statusMessage: String,
                  _ data: Any?
               ) -> Void) {
                   let url = URL(string: urlStr)!
                   var request = URLRequest(url: url)
                   
                   request.httpMethod = method
                   
                   for (headerName, headerValue) in headers {
                       request.setValue(headerValue, forHTTPHeaderField: headerName)
                   }
                   
                   request.httpBody = body
                   
                   let task = URLSession.shared.dataTask(with: request) { data, response, error in
                       if error != nil {
                           return
                       }
                       
                       let headers = (response as! HTTPURLResponse).allHeaderFields as! [String: String]
                       let statusCode = (response as! HTTPURLResponse).statusCode
                       let statusMessage = "OK"
                       
                       if (data == nil) {
                           onCompletion(headers, statusCode, statusMessage, nil)
                       } else if (utf8) {
                           onCompletion(headers, statusCode, statusMessage, String(data: data!, encoding: .utf8)!)
                       } else {
                           onCompletion(headers, statusCode, statusMessage, data)
                       }
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
    
    func readdir(path: String, withFileTypes: Bool) -> Any {
        let itemPath = self.baseDirectory + "/" + path;
        
        let existsAndIsDirectory = AdapterFS.itemExistsAndIsDirectory(itemPath);
        if(existsAndIsDirectory == nil || !existsAndIsDirectory!) {
            return AdapterError(
                code: existsAndIsDirectory != nil ? "ENOTDIR" : "ENOENT",
                path: path,
                syscall: "open"
            )
        }
        
        let items = try! FileManager.default.contentsOfDirectory(atPath: itemPath)
        
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
