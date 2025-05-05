package main

/*
#include <stdlib.h>

typedef void (*Callback)(char *projectId, char* type, char *msg);
static inline void CallMyFunction(void *callback, char *projectId, char * type, char *msg) {
    ((Callback)callback)(projectId, type, msg);
}
*/
import "C"

import (
	fs "fullstacked/editor/src/fs"
	methods "fullstacked/editor/src/methods"
	setup "fullstacked/editor/src/setup"
	"unsafe"
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

	fileEventOrigin := "setup"
	fs.Mkdir(setup.Directories.Root, fileEventOrigin)
	fs.Mkdir(setup.Directories.Config, fileEventOrigin)
	fs.Mkdir(setup.Directories.Editor, fileEventOrigin)

	// clean tmp
	fs.Rmdir(setup.Directories.Tmp, fileEventOrigin)
	fs.Mkdir(setup.Directories.Tmp, fileEventOrigin)
}

var cCallback = (unsafe.Pointer)(nil)

//export callback
func callback(cb unsafe.Pointer) {
	cCallback = cb

	setup.Callback = func(projectId string, messageType string, message string) {
		projectIdPtr := C.CString(projectId);
		messageTypePtr := C.CString(messageType);
		messagePtr := C.CString(message);

		C.CallMyFunction(
			cCallback,
			projectIdPtr,
			messageTypePtr,
			messagePtr,
		)

		C.free(unsafe.Pointer(projectIdPtr));
		C.free(unsafe.Pointer(messageTypePtr));
		C.free(unsafe.Pointer(messagePtr));
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
