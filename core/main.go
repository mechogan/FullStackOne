package main

// #include <stdlib.h>
import "C"

import (
	"fmt"
	"unsafe"

	esbuild "fullstacked/editor/src/esbuild"
	serialize "fullstacked/editor/src/serialize"
	staticFiles "fullstacked/editor/src/staticFiles"
)

func main() {
	fmt.Println(esbuild.Version())
}

//export directories
func directories(root *C.char,
	config *C.char,
	nodeModules *C.char,
	editor *C.char) {
	SetupDirectories(
		C.GoString(root),
		C.GoString(config),
		C.GoString(nodeModules),
		C.GoString(editor),
	)
}

//export call
func call(buffer unsafe.Pointer, length C.int, responsePtr *unsafe.Pointer) (C.int) {
	bytes := C.GoBytes(buffer, length)
	method := bytes[0]
	isEditor := bytes[1] == 1
	projectId, args := serialize.DeserializeArgs(bytes[2:])

	response := callMethod(int(method), isEditor, projectId, args)

	*responsePtr = C.CBytes(response)

	return C.int(len(response))
}

const (
	UNKNOWN 	= 0
	STATIC_FILE	= 1

	FS_READFILE = 2
	FS_WRITEFILE = 3
	FS_UNLINK = 4
	FS_READDIR = 5
	FS_MKDIR = 6
	FS_RMDIR = 7
	FS_EXISTS = 8
	FS_RENAME = 9

	FETCH = 10
	BROADCAST = 11

	// EDITOR ONLY
)

func callMethod(
	method int, 
	isEditor bool,
	projectId string, 
	args []any,
) ([]byte) {
	switch {
	case method == STATIC_FILE:
		baseDir := projectId
		if(isEditor){
			baseDir = Directories.editor
		}
		return staticFiles.Serve(baseDir, args[0].(string))

	}

	return nil
}

//export freePtr
func freePtr(ptr unsafe.Pointer) {
	C.free(ptr)
}
