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
    private let baseJSFile = Bundle.main.path(forResource: "index", ofType: "js", inDirectory: "js")!
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
    
    override func callAdapterMethod(methodPath: [String.SubSequence], body: Data, done: @escaping (_ maybeData: Any?) -> Void) {
        if(methodPath.count == 0) {
            return done(nil)
        }
        
        let json = try! JSON(data: body)
        
        let writeFile = { (path: String, data: Data, recursive: Bool) in
            if(recursive) {
                let directory = path.split(separator: "/").dropLast()
                self.fsEditor.mkdir(path: directory.joined(separator: "/"))
            }
            
            return self.fsEditor.writeFile(file: path, data: data)
        }
        
        switch(methodPath.first) {
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
                                
                                let maybeError = writeFile(fileJSON["path"].stringValue, data, json[1]["recursive"].boolValue)
                                if(maybeError is AdapterError){
                                    return done(maybeError)
                                }
                            }
                            return done(true)
                        case "unlink": return done(self.fsEditor.unlink(path: json[0].stringValue))
                        case "readdir": return done(self.fsEditor.readdir(path: json[0].stringValue, withFileTypes: json[1]["withFileTypes"].boolValue, recursive: json[1]["recursive"].boolValue))
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
                case "baseJS":
                    let content = FileManager.default.contents(atPath: self.baseJSFile)!
                    return done(String(data: content, encoding: .utf8)!)
                case "check": return done("1")
                case "install": break
                case "tmpFile":
                    switch(methodPath[2]) {
                    case "write":
                        let path = self.cacheDirectory + json[0].stringValue
                        let data = json[1].stringValue.data(using: .utf8)!
                        try! data.write(to: URL(string: path)!)
                        return done(String(path.dropFirst("file://".count)))
                    case "unlink":
                        let path = self.cacheDirectory + json[0].stringValue
                        try! FileManager.default.removeItem(at: URL(string: path)!)
                        return done(true)
                    default: break;
                    }
                case "build":
                    let inputPtr = UnsafeMutablePointer<Int8>(mutating: (json[0].stringValue as NSString).utf8String)
                    let outPtr = UnsafeMutablePointer<Int8>(mutating: ("index" as NSString).utf8String)
                    let outdirPtr = UnsafeMutablePointer<Int8>(mutating: (json[1].stringValue as NSString).utf8String)
                    let nodePathPtr = UnsafeMutablePointer<Int8>(mutating: (self.rootDirectory + "/" + self.nodeModulesDirectory as NSString).utf8String)
                    
                    var errorsPtr = UnsafeMutablePointer<Int8>(nil)
                    
                    build(inputPtr,
                          outPtr,
                          outdirPtr,
                          nodePathPtr,
                          &errorsPtr)
                                
                    if(errorsPtr != nil) {
                        let errorsJSONStr = String.init(cString: errorsPtr!, encoding: .utf8)!
                        return done(JSON(parseJSON: errorsJSONStr))
                    }
                
                    return done(true)
                default: break
                }
                break
            case "run":
                let projectDirectory = self.rootDirectory + "/" + json[0]["location"].stringValue
                    
                let runningInstance = RunningInstances.singleton?.getInstance(projectDirectory: projectDirectory)
            
                if(runningInstance != nil) {
                    runningInstance!.webview.reload()
                } else {
                    let project = Project(
                        location: projectDirectory,
                        id: json[0]["id"].stringValue,
                        title: json[0]["title"].stringValue)
                    RunningInstances.singleton?.addInstance(instance: Instance(project: project))
                }
            
                return done(true)
            case "open": 
                let projectLocation = self.rootDirectory + "/" + json[0]["location"].stringValue
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
                        self.multipeer.startAdvertising(id: json[0]["id"].stringValue, name: json[0]["name"].stringValue)
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
                        self.bonjour.peerNearbyIsDead(id: json[0].stringValue)
                        return done(true)
                    case "stop":
                        self.bonjour.stopBrowsing()
                        self.multipeer.stopBrowsing()
                        return done(true)
                    default: break
                    }
                case "open":
                    self.multipeer.open(id: json[0].stringValue, meId: json[1]["id"].stringValue, meName: json[1]["name"].stringValue)
                    return done(true)
                case "disconnect":
                    self.multipeer.disconnect(id: json[0].stringValue)
                    return done(true)
                case "trustConnection":
                    self.multipeer.trustConnection(id: json[0].stringValue)
                    return done(true)
                case "send":
                    self.multipeer.send(id: json[0].stringValue, data: json[1].stringValue, pairing: json[2].boolValue)
                    return done(true)
                case "convey":
                    let data = json[1].stringValue;
                    let projectId = json[0].stringValue;
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
        
        return super.callAdapterMethod(methodPath: methodPath, body: body, done: done)
    }
}
