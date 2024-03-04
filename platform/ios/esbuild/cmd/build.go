package main

import "C"

import (
	"encoding/json"

	"github.com/evanw/esbuild/pkg/api"
)

//export buildWebview
func buildWebview(entryPoint *C.char, Outfile *C.char, NodePath *C.char, errors **C.char) {
	result := api.Build(api.BuildOptions{
		EntryPoints: []string{C.GoString(entryPoint)},
		Outfile:     C.GoString(Outfile),
		Sourcemap:   api.SourceMapInlineAndExternal,
		Bundle:      true,
		Format:      api.FormatESModule,
		Write:       true,
		NodePaths:   []string{C.GoString(NodePath)},
	})

	if len(result.Errors) > 0 {
		errorsJSON, _ := json.Marshal(result.Errors)
		*errors = C.CString(string(errorsJSON))
	}
}

//export buildAPI
func buildAPI(entryPoint *C.char, NodePath *C.char, errors **C.char) *C.char {
	result := api.Build(api.BuildOptions{
		EntryPoints: []string{C.GoString(entryPoint)},
		Bundle:      true,
		GlobalName:  "api",
		Format:      api.FormatIIFE,
		Write:       false,
		NodePaths:   []string{C.GoString(NodePath)},
	})

	if len(result.Errors) > 0 {
		errorsJSON, _ := json.Marshal(result.Errors)
		*errors = C.CString(string(errorsJSON))
		return nil
	}

	return C.CString(string(result.OutputFiles[0].Contents[:]))
}
