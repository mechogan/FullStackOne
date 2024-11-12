package main


/*
#include <stdlib.h>

typedef const void (*Callback)(char *projectId, char *msg);
static inline void CallMyFunction(void *callback, char *projectId, char *msg) {
    ((Callback)callback)(projectId, msg);
}
*/
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

var cCallback = (unsafe.Pointer)(nil)
//export callback
func callback(cb unsafe.Pointer) {
	cCallback = cb

	setup.Callback = func(projectId string, message string) {
		C.CallMyFunction(cCallback, C.CString(projectId), C.CString(message))
	}
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
