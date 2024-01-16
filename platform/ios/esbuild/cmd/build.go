package main

import "C"

import (
	"github.com/evanw/esbuild/pkg/api"
)

//export build
func build(in *C.char) *C.char {
	result := api.Transform(C.GoString(in), api.TransformOptions{
		MinifyWhitespace:  true,
		MinifyIdentifiers: true,
		MinifySyntax:      true,
	})

	return C.CString(string(result.Code[:]))
}
