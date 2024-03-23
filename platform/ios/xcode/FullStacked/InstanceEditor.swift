//
//  InstanceEditor.swift
//  FullStacked
//
//  Created by Charles-Philippe Lepage on 2024-03-22.
//

import Foundation
import SwiftyJSON

let paths = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true);
let documentsDirectory = paths.first!

class InstanceEditor: Instance {
    init(){
        let editorDirectory = Bundle.main.bundlePath + "/build"
        super.init(adapter: AdapterEditor(baseDirectory: editorDirectory))
        self.webview.isOpaque = false
    }
}

class AdapterEditor: Adapter {
    let rootDirectory = documentsDirectory
    let baseJS = Bundle.main.bundlePath + "/js/index.js"
    let cacheDirectory = FileManager.default.temporaryDirectory.appendingPathComponent("fullstacked")
    let configDirectory = ".config/fullstacked"
    let nodeModulesDirectory: String
    let fsEditor: AdapterFS;
    
    override init(baseDirectory: String) {
        self.nodeModulesDirectory = configDirectory + "/node_modules"
        self.fsEditor = AdapterFS(baseDirectory: self.rootDirectory);
        super.init(baseDirectory: baseDirectory)
    }
    
    override func callAdapterMethod(methodPath: [String.SubSequence], body: Data, done: @escaping (_ maybeData: Any?) -> Void) {
        if(methodPath.count == 0) {
            return done(nil)
        }
        
        let json = try! JSON(data: body)
        
        switch(methodPath.first) {
            case "directories":
                switch(methodPath[1]) {
                    case "root": return done(self.rootDirectory)
                    case "cache": return done(self.cacheDirectory)
                    case "config": return done(self.configDirectory)
                    case "nodeModules": return done(self.nodeModulesDirectory)
                    default: break
                }
                break
            case "fs":
                if (json[1]["absolutePath"].boolValue || json[2]["absolutePath"].boolValue) {
                    switch(methodPath[1]){
                        case "readFile": return done(self.fsEditor.readFile(path: json[0].stringValue, utf8: json[1]["encoding"].stringValue == "utf8"))
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
                        
                            return done(self.fsEditor.writeFile(file: json[0].stringValue, data: data))
                        case "unlink": return done(self.fsEditor.unlink(path: json[0].stringValue))
                        case "readdir": return done(self.fsEditor.readdir(path: json[0].stringValue, withFileTypes: json[1]["withFileTypes"].boolValue))
                        case "mkdir": return done(self.fsEditor.mkdir(path: json[0].stringValue))
                        case "rmdir": return done(self.fsEditor.rmdir(path: json[0].stringValue))
                        case "stat": return done(self.fsEditor.stat(path: json[0].stringValue))
                        case "lstat": return done(self.fsEditor.lstat(path: json[0].stringValue))
                        case "exists":
                            let exists = self.fsEditor.exists(path: json[0].stringValue)
                            return done(exists == nil ? false : exists)
                        default: break;
                    }
                }
                break
            case "esbuild":
                switch(methodPath[1]) {
                    case "check": return done("1")
                    case "install": break
                    default: break
                }
                break
            default: break
        }
        
        return super.callAdapterMethod(methodPath: methodPath, body: body, done: done)
    }
}
