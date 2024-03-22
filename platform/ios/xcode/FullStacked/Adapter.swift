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
    var toJSON: [String: String] {
        return ["code": code, "path": path]
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
            default: return nil
        }
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
                path: path
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
                path: file
            )
        }
        
        return nil
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
                path: path
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
        
        let existsAndIsDirectory = AdapterFS.itemExistsAndIsDirectory(path);
        if(existsAndIsDirectory == nil) {
            return AdapterError(
                code: "ENOENT",
                path: path
            )
        }
        
        let stats = try! FileManager.default.attributesOfItem(atPath: itemPath)
        
        return [
            "size": stats[FileAttributeKey.size],
            "isDirectory": existsAndIsDirectory!,
            "isFile": !existsAndIsDirectory!,
            "ctime": stats[FileAttributeKey.creationDate],
            "ctimeMs": (stats[FileAttributeKey.creationDate] as! Date).timeIntervalSince1970 * 1000,
            "mtime": stats[FileAttributeKey.modificationDate],
            "mtimeMs": (stats[FileAttributeKey.modificationDate] as! Date).timeIntervalSince1970 * 1000,
        ]
    }
    
    func lstat(path: String) -> Any {
        let itemPath = self.baseDirectory + "/" + path;
        
        let existsAndIsDirectory = AdapterFS.itemExistsAndIsDirectory(path);
        if(existsAndIsDirectory == nil) {
            return AdapterError(
                code: "ENOENT",
                path: path
            )
        }
        
        let stats = try! FileManager.default.attributesOfItem(atPath: itemPath)
        
        return [
            "size": stats[FileAttributeKey.size],
            "isDirectory": existsAndIsDirectory!,
            "isFile": !existsAndIsDirectory!,
            "ctime": stats[FileAttributeKey.creationDate],
            "ctimeMs": (stats[FileAttributeKey.creationDate] as! Date).timeIntervalSince1970 * 1000,
            "mtime": stats[FileAttributeKey.modificationDate],
            "mtimeMs": (stats[FileAttributeKey.modificationDate] as! Date).timeIntervalSince1970 * 1000,
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
