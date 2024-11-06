//
//  Instance.swift
//  FullStacked
//
//  Created by Charles-Philippe Lepage on 2024-11-06.
//

import SwiftUI

class Instance {
    private let isEditor: Bool
    private let projectId: String
    
    
    init (projectId: String, isEditor: Bool = false) {
        self.isEditor = isEditor
        self.projectId = projectId
    }
    
    func callLib(payload: Data) -> Data {
        var data = Data()
        if(self.isEditor) {
            data.append(Data([1])) // isEditor
            data.append(0.toBytes()) // no project id
        } else {
            data.append(Data([0])) // not editor
            // TODO: append serialized project id
        }
        
        data.append(payload)
        
        var responsePtr = Data().ptr()
        let size = call(data.ptr(), Int32(data.count), &responsePtr)
        let responseDataPtr = UnsafeBufferPointer(start: responsePtr!.assumingMemoryBound(to: UInt8.self), count: Int(size))
        let responseData = Data(responseDataPtr)
        freePtr(responsePtr)
        
        return responseData
    }
}
