package main

import (
	"C"
	"fmt"
	"unsafe"

	esbuild "fullstacked/editor/src"
)

func main() {
	fmt.Println(C.GoString((*C.char)(esbuild.Version())))
}

//export call
func call(buffer *C.uchar, len C.int) {
	bytes := C.GoBytes(unsafe.Pointer(buffer), len)
	for _, n := range(bytes) {
        fmt.Printf("%v ", n)
    }
}