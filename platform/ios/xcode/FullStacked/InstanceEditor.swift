//
//  InstanceEditor.swift
//  FullStacked
//
//  Created by Charles-Philippe Lepage on 2024-03-22.
//

import Foundation
import SwiftyJSON
import UIKit

let paths = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true);
let documentsDirectory = paths.first!

class InstanceEditor: Instance {
    static var singleton: InstanceEditor?
    
    init(){
        let editorDirectory = Bundle.main.path(forResource: "build", ofType: nil)!
        super.init(adapter: AdapterEditor(baseDirectory: editorDirectory))
        self.webview.isOpaque = false
        InstanceEditor.singleton = self
    }
}

class AdapterEditor: Adapter {
    let rootDirectory = documentsDirectory
    private let baseJSFile = Bundle.main.path(forResource: "base", ofType: "js", inDirectory: "js")!
    let cacheDirectory = FileManager.default.temporaryDirectory.absoluteString
    let configDirectory = ".config/fullstacked"
    let nodeModulesDirectory: String
    let fsEditor: AdapterFS
    let bonjour = Bonjour()
    let multipeer = Multipeer()
    
    init(baseDirectory: String) {
        self.nodeModulesDirectory = configDirectory + "/node_modules"
        self.fsEditor = AdapterFS(baseDirectory: self.rootDirectory);
        super.init(projectId: nil, baseDirectory: baseDirectory)
        
        
        self.bonjour.onPeerNearby = {eventType, peerNearbyBonjour in
            let message = [
                "eventType": eventType,
                "peerNearby": [
                    "type": 1,
                    "peer": [
                        "id": peerNearbyBonjour.id,
                        "name": peerNearbyBonjour.name
                    ],
                    "addresses": peerNearbyBonjour.addresses,
                    "port": peerNearbyBonjour.port
                ]
            ]
            InstanceEditor.singleton?.push(messageType: "peerNearby", message: JSON(message).rawString()!)
        }
        self.multipeer.onPeerNearby = {eventType, peerNearbyMultipeer in
            let message = [
                "eventType": eventType,
                "peerNearby": [
                    "type": 2,
                    "peer": [
                        "id": peerNearbyMultipeer.peer.id,
                        "name": peerNearbyMultipeer.peer.name
                    ],
                    "id": peerNearbyMultipeer.id
                ]
            ]
            InstanceEditor.singleton?.push(messageType: "peerNearby", message: JSON(message).rawString()!)
        }
        
        self.multipeer.onPeerConnection = { id, type, state in
            let message = [
                "id": id,
                "type": type,
                "state": state
            ]
            InstanceEditor.singleton?.push(messageType: "peerConnection", message: JSON(message).rawString()!)
        }
        
        self.multipeer.onPeerData = { id, data in
            let message = [
                "id": id,
                "data": data
            ]
            InstanceEditor.singleton?.push(messageType: "peerData", message: JSON(message).rawString()!)
        }
    }
    
    override func callAdapterMethod(methodPath: [String.SubSequence], args: [Any?], done: @escaping (_ maybeData: Any?) -> Void) {
        if(methodPath.count == 0) {
            return done(nil)
        }
        
        switch(methodPath.first) {
        case "migrate":
            let project = args[0] as! JSON
            let oldPath = project["location"].stringValue
            let newPath = project["id"].stringValue
            return done(self.fsEditor.rename(oldPath: oldPath, newPath: newPath))
            case "directories":
                switch(methodPath[1]) {
                    case "rootDirectory": return done(self.rootDirectory)
                    case "cacheDirectory": return done(self.cacheDirectory)
                    case "configDirectory": return done(self.configDirectory)
                    case "nodeModulesDirectory": return done(self.nodeModulesDirectory)
                    default: break
                }
                break
            case "fs":
            
            var absolutePath = false
            if(args[0] is String && (args[0] as! String).contains("@types/react")) {
                print(args[0] as! String)
                print("ici")
            }
            if(args.count > 0 && args[0] is JSON && (args[0] as! JSON)["absolutePath"].boolValue){
                absolutePath = true
            } else if(args.count > 1 && args[1] is JSON && (args[1] as! JSON)["absolutePath"].boolValue) {
                absolutePath = true
            } else if (args.count > 2 && args[2] is JSON && (args[2] as! JSON)["absolutePath"].boolValue) {
                absolutePath = true
            }
            
            if (absolutePath) {
                switch(methodPath[1]){
                case "readFile":
                    let utf8 = args.count > 1 && (args[1] as! JSON)["encoding"].stringValue == "utf8"
                    return done(self.fsEditor.readFile(path: args[0] as! String, utf8: utf8))
                case "writeFile":
                    return done(self.fsEditor.writeFile(file: args[0] as! String, strOrData: args[1]!))
                case "writeFileMulti":
                    var i = 1;
                    while(i < args.count) {
                        let file = args[i] as! String
                        let data = args[i + 1]!
                        let maybeError = self.fsEditor.writeFile(file: file, strOrData: data)
                        if(maybeError is AdapterError){
                            return done(maybeError)
                        }
                        i += 2
                    }
                    return done(true)
                case "unlink": return done(self.fsEditor.unlink(path: args[0] as! String))
                case "readdir":
                    var withFileTypes = false
                    var recursive = false
                    if(args.count > 1) {
                        let options = args[1] as! JSON
                        withFileTypes = options["withFileTypes"].boolValue
                        recursive = options["recursive"].boolValue
                    }
                    let files = self.fsEditor.readdir(path: args[0] as! String, withFileTypes: withFileTypes, recursive: recursive)
                    return done(files)
                    case "mkdir": return done(self.fsEditor.mkdir(path: args[0] as! String))
                    case "rmdir": return done(self.fsEditor.rmdir(path: args[0] as! String))
                    case "stat": return done(self.fsEditor.stat(path: args[0] as! String))
                    case "lstat": return done(self.fsEditor.lstat(path: args[0] as! String))
                    case "exists":
                        let exists = self.fsEditor.exists(path: args[0] as! String)
                        return done(exists == nil ? false : exists)
                    case "rename":
                        return done(self.fsEditor.rename(oldPath: args[0] as! String, newPath: args[1] as! String))
                    default: break;
                }
            }
            break
            case "esbuild":
                switch(methodPath[1]) {
                case "version":
                    var versionStrPtr = UnsafeMutablePointer<Int8>(nil)
                    version(&versionStrPtr)
                    let versionStr = String.init(cString: versionStrPtr!, encoding: .utf8)
                    return done(versionStr)
                case "baseJS":
                    let content = FileManager.default.contents(atPath: self.baseJSFile)!
                    return done(String(data: content, encoding: .utf8)!)
                case "check": return done("1")
                case "install": break
                case "tmpFile":
                    switch(methodPath[2]) {
                    case "write":
                        let path = self.cacheDirectory + (args[0] as! String)
                        let data = (args[1] as! String).data(using: .utf8)!
                        try! data.write(to: URL(string: path)!)
                        return done(String(path.dropFirst("file://".count)))
                    case "unlink":
                        let path = self.cacheDirectory + (args[0] as! String)
                        try! FileManager.default.removeItem(at: URL(string: path)!)
                        return done(true)
                    default: break;
                    }
                case "build":
                    let inputPtr = UnsafeMutablePointer<Int8>(mutating: ((args[0] as! String) as NSString).utf8String)
                    let outPtr = UnsafeMutablePointer<Int8>(mutating: ("index" as NSString).utf8String)
                    let outdirPtr = UnsafeMutablePointer<Int8>(mutating: ((args[1] as! String) as NSString).utf8String)
                    let nodePathPtr = UnsafeMutablePointer<Int8>(mutating: (self.rootDirectory + "/" + self.nodeModulesDirectory as NSString).utf8String)
                    
                    var errorsPtr = UnsafeMutablePointer<Int8>(nil)
                    
                    build(inputPtr,
                          outPtr,
                          outdirPtr,
                          nodePathPtr,
                          &errorsPtr)
                                
                    let errors = String.init(cString: errorsPtr!, encoding: .utf8)!
                    if(!errors.isEmpty) {
                        return done(JSON(parseJSON: errors))
                    }
                
                    return done(1)
                default: break
                }
                break
        case "run":
            let project = args[0] as! JSON
            let projectDirectory = self.rootDirectory + "/" + project["location"].stringValue
                
            let runningInstance = RunningInstances.singleton?.getInstance(projectDirectory: projectDirectory)
        
            if(runningInstance != nil) {
                runningInstance!.webview.reload()
            } else {
                let project = Project(
                    location: projectDirectory,
                    id: project["id"].stringValue,
                    title: project["title"].stringValue)
                RunningInstances.singleton?.addInstance(instance: Instance(project: project))
            }
        
            return done(true)
        case "open":
            let project = args[0] as! JSON
            let projectLocation = self.rootDirectory + "/" + project["location"].stringValue
            UIApplication.shared.open(URL(string: "shareddocuments://" + projectLocation)!)
            return done(true)
        case "connectivity":
            switch(methodPath[1]) {
            case "infos":
                return done(false)
            case "name":
                return done(UIDevice.current.name)
            case "peers":
                switch(methodPath[2]){
                case "nearby":
                    var peersNearby: [JSON] = []
                    let peersNearbyBonjour = self.bonjour.getPeersNearby().arrayValue
                    let peersNearbyMultipeer = self.multipeer.getPeersNearby().arrayValue
                    
                    for peerNearby in peersNearbyBonjour {
                        peersNearby.append(peerNearby)
                    }
                    for peerNearby in peersNearbyMultipeer {
                        peersNearby.append(peerNearby)
                    }
                    
                    return done(JSON(peersNearby))
                default: break
                }
            case "advertise":
                switch(methodPath[2]){
                case "start":
                    let peer = args[0] as! JSON
                    self.multipeer.startAdvertising(id: peer["id"].stringValue, name: peer["name"].stringValue)
                    return done(true)
                case "stop":
                    self.multipeer.stopAdvertising()
                    return done(true)
                default: break
                }
            case "browse":
                switch(methodPath[2]){
                case "start":
                    self.bonjour.startBrowsing()
                    self.multipeer.startBrowsing()
                    return done(true)
                case "peerNearbyIsDead":
                    self.bonjour.peerNearbyIsDead(id: args[0] as! String)
                    return done(true)
                case "stop":
                    self.bonjour.stopBrowsing()
                    self.multipeer.stopBrowsing()
                    return done(true)
                default: break
                }
            case "open":
                let me = (args[1] as! JSON)
                self.multipeer.open(id: (args[0] as! String), meId: me["id"].stringValue, meName: me["name"].stringValue)
                return done(true)
            case "disconnect":
                self.multipeer.disconnect(id: args[0] as! String)
                return done(true)
            case "trustConnection":
                self.multipeer.trustConnection(id: args[0] as! String)
                return done(true)
            case "send":
                self.multipeer.send(id: args[0] as! String, data: args[1] as! String, pairing: args[2] as! Bool)
                return done(true)
            case "convey":
                let data = args[1] as! String
                let projectId = args[0] as! String;
                RunningInstances.singleton!.instances.forEach({instance in
                    if(instance.adapter.projectId == projectId) {
                        instance.push(messageType: "peerData", message: data)
                    }
                })
                return done(true)
            default: break
            }
        default: break
        }
        
        return super.callAdapterMethod(methodPath: methodPath, args: args, done: done)
    }
}
