package org.fullstacked.editor

class InstanceEditor : Instance() {
    companion object {
        val singleton: InstanceEditor = InstanceEditor()
    }

    constructor() {
        super()
    }
}

class AdapterEditor : Adapter() {

}