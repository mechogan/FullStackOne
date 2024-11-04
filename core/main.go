package main

// #include <stdlib.h>
import "C"

import (
	"fmt"
	"unsafe"
	"os"

	esbuild "fullstacked/editor/src/esbuild"
	staticFiles "fullstacked/editor/src/staticFiles"
)

func main() {
	fmt.Println(esbuild.Version())
}

//export call
func call(buffer unsafe.Pointer, length C.int, responsePtr *unsafe.Pointer) (C.int) {
	bytes := C.GoBytes(buffer, length)

	response, _ := os.ReadFile(string(bytes))

	*responsePtr = C.CBytes(response)

	return C.int(len(response))
}

//export freePtr
func freePtr(ptr unsafe.Pointer) {
	C.free(ptr)
}
