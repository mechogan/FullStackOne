package main

// #include <stdlib.h>
import "C"

import (
	"path"
	"unsafe"

	setup "fullstacked/editor/src/setup"
	esbuild "fullstacked/editor/src/esbuild"
	fs "fullstacked/editor/src/fs"
	serialize "fullstacked/editor/src/serialize"
	staticFiles "fullstacked/editor/src/staticFiles"
)

func main() { }

//export directories
func directories(root *C.char,
	config *C.char,
	nodeModules *C.char,
	editor *C.char) {
	setup.SetupDirectories(
		C.GoString(root),
		C.GoString(config),
		C.GoString(nodeModules),
		C.GoString(editor),
	)
}

//export call
func call(buffer unsafe.Pointer, length C.int, responsePtr *unsafe.Pointer) (C.int) {
	bytes := C.GoBytes(buffer, length)	
	cursor := 0

	isEditor := bytes[cursor] == 1
	cursor++;

	projectIdLength := serialize.DeserializeBytesToNumber(bytes[cursor:cursor + 4])
	cursor += 4

	projectId := string(bytes[cursor:cursor + projectIdLength])
	cursor += projectIdLength

	method, args := serialize.DeserializeArgs(bytes[cursor:])

	response := callMethod(isEditor, projectId, int(method), args)

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

	CONFIG_GET = 12
	CONFIG_SAVE = 13

	ESBUILD_VERSION = 14
	ESBUILD_BUILD = 15
)

func callMethod(
	isEditor bool,
	projectId string, 
	method int, 
	args []any,
) ([]byte) {
	baseDir := setup.Directories.Root + "/" + projectId

	switch {
	case method == STATIC_FILE:
		if(isEditor){
			baseDir = setup.Directories.Editor
		}
		return staticFiles.Serve(baseDir, args[0].(string))
	case method >= 2 && method <= 9:
		if(isEditor){
			baseDir = setup.Directories.Root
		}
		return fsSwitch(method, baseDir, args)
	case method >= 12:
		if(!isEditor) {
			return nil
		}

		return editorSwitch(method, args)
	}

	return nil
}

func fsSwitch(method int, baseDir string, args []any) ([]byte) {
	filePath := path.Join(baseDir, args[0].(string))

	switch method {
	case FS_READFILE:
		return fs.ReadFile(filePath, args[1].(bool))
	case FS_WRITEFILE:
		return fs.WriteFile(filePath, args[1].([]byte))
	case FS_UNLINK:
		return nil
	case FS_READDIR:
		return fs.ReadDir(filePath, args[1].(bool), args[2].(bool))
	}

	return nil
}

func editorSwitch(method int, args []any) ([]byte) {

	switch method {
	case CONFIG_GET:
		return setup.ConfigGet(args[0].(string))
	case CONFIG_SAVE:
		return setup.ConfigSave(args[0].(string), args[1].(string))
	case ESBUILD_VERSION:
		return serialize.SerializeString(esbuild.Version())
	}

	return nil
}

//export freePtr
func freePtr(ptr unsafe.Pointer) {
	C.free(ptr)
}
