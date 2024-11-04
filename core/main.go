package main

// #include <stdlib.h>
import "C"

import (
	"fmt"
	"unsafe"

	esbuild "fullstacked/editor/src/esbuild"
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

func deserializeNumber(bytes []byte) int {
	negative := bytes[0] == 1
	
	n := uint(0)
	for i := 1; i < len(bytes); i++ {
		n += uint(bytes[i]) << ((i - 1) * 8)
	}
	
	if(negative) {
		return 0 - int(n)
	}

	return int(n);
}

func bytesToNumber(bytes []byte) (int) {
	return int((uint(bytes[0]) << 24) |
			(uint(bytes[1]) << 16) |
			(uint(bytes[2]) << 8) |
			(uint(bytes[3]) << 0))

}

const (
	UNDEFINED	= 0
	BOOLEAN		= 1
	STRING 		= 2
	NUMBER 		= 3
	BUFFER 		= 4
)

func deserializeArgs(data []byte) (string, []any) {
	cursor := 0
	projectIdLength := bytesToNumber(data[cursor:cursor + 4])
	cursor += 4
	projectId := string(data[cursor:cursor + projectIdLength])
	cursor += projectIdLength

	var args []any
	
	for cursor < len(data) {
		argType := int(data[cursor])
		cursor++
		argLength := bytesToNumber(data[cursor:cursor + 4])
		cursor += 4
		argData := data[cursor:cursor + argLength]
		cursor += argLength

		switch argType {
		case UNDEFINED:
			args = append(args, nil)
		case BOOLEAN:
			args = append(args, argData[0] == 1)
		case STRING:
			args = append(args, string(argData))
		case NUMBER:
			args = append(args, deserializeNumber(argData))
		case BUFFER:
			args = append(args, argData)
		}

	}

	return projectId, args
}

//export call
func call(buffer unsafe.Pointer, length C.int, responsePtr *unsafe.Pointer) (C.int) {
	bytes := C.GoBytes(buffer, length)
	method := bytes[0]
	isEditor := bytes[1] == 1
	projectId, args := deserializeArgs(bytes[2:])

	response := callMethod(int(method), isEditor, projectId, args)

	*responsePtr = C.CBytes(response)

	return C.int(len(response))
}

const (
	UNKNOWN 	= 0
	STATIC_FILE	= 1
)

func callMethod(
	method int, 
	isEditor bool,
	projectId string, 
	args []any,
) ([]byte) {
	switch method {
	case STATIC_FILE:
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
