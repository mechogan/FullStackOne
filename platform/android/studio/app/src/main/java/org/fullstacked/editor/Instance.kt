package org.fullstacked.editor

class Instance(val isEditor: Boolean, val projectId: String) {
    private lateinit var headerRequest: ByteArray

    private external fun call(buffer: ByteArray): ByteArray

    init {
        if(this.isEditor) {
            this.headerRequest = byteArrayOf(
                1 // isEditor
            )
            this.headerRequest += numberToBytes(0) // no project id
        } else {
            // TODO
        }
    }

    fun callLib(payload: ByteArray) : ByteArray {
        return this.call(this.headerRequest + payload)
    }
}