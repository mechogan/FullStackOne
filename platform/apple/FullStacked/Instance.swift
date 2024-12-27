//
//  Instance.swift
//  FullStacked
//
//  Created by Charles-Philippe Lepage on 2024-11-06.
//

import SwiftUI

class Instance {
    public let isEditor: Bool
    public let id: String
    private var header: Data
    
    
    init (projectId: String, isEditor: Bool = false) {
        self.isEditor = isEditor
        self.id = projectId
        
        self.header = Data()
        if(isEditor) {
            self.header.append(Data([1])) // isEditor
            self.header.append(0.toBytes()) // no project id
        } else {
            self.header.append(Data([0]))
            let projectIdData = self.id.data(using: .utf8)!
            self.header.append(projectIdData.count.toBytes())
            self.header.append(projectIdData)
        }
    }
    
    func callLib(payload: Data) -> Data {
        var data = Data()
        data.append(self.header)
        data.append(payload)
        
        var responsePtr = Data().ptr()
        let size = call(data.ptr(), Int32(data.count), &responsePtr)
        let responseDataPtr = UnsafeBufferPointer(start: responsePtr!.assumingMemoryBound(to: UInt8.self), count: Int(size))
        let responseData = Data(responseDataPtr)
        freePtr(responsePtr)
        
        return responseData
    }
}
