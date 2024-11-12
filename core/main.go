package main

// #include <stdlib.h>
import "C"

import (
	"unsafe"

	methods "fullstacked/editor/src/methods"
	setup "fullstacked/editor/src/setup"
)

func main() {}

//export directories
func directories(root *C.char,
	config *C.char,
	editor *C.char) {
	setup.SetupDirectories(
		C.GoString(root),
		C.GoString(config),
		C.GoString(editor),
	)
}

//export call
func call(buffer unsafe.Pointer, length C.int, responsePtr *unsafe.Pointer) C.int {
	response := methods.Call(C.GoBytes(buffer, length))
	*responsePtr = C.CBytes(response)
	return C.int(len(response))
}

//export freePtr
func freePtr(ptr unsafe.Pointer) {
	C.free(ptr)
}
