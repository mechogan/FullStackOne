package org.fullstacked.editor

import java.util.Arrays

class Instance(val isEditor: Boolean, val projectId: String) {
    private lateinit var headerRequest: ByteArray

    private external fun call(buffer: ByteArray): ByteArray

    init {
        if(this.isEditor) {
            this.headerRequest = byteArrayOf(
                1 // isEditor
            )
            this.headerRequest += numberToBytes(0) // no porject id
        } else {
            // TODO
        }
    }

    fun callLib(payload: ByteArray) : ByteArray {
        println(Arrays.toString(this.headerRequest + payload))
        val response = this.call(this.headerRequest + payload)
        println(Arrays.toString(response))
        return response
    }
}