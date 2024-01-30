package main

import "C"

import (
	"github.com/evanw/esbuild/pkg/api"
)

//export build
func build(entryPoint *C.char) *C.char {
	result := api.Build(api.BuildOptions{
		EntryPoints: []string{C.GoString(entryPoint)},
		Bundle:      true,
		Write:       false,
	})

	return C.CString(string(result.OutputFiles[0].Contents[:]))
}
