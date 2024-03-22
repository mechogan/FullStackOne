package main

import "C"

import (
	"encoding/json"

	"github.com/evanw/esbuild/pkg/api"
)

//export build
func build(entryPoint *C.char, Outdir *C.char, NodePath *C.char, errors **C.char) {
	result := api.Build(api.BuildOptions{
		EntryPointsAdvanced: []api.EntryPoint{{
			OutputPath: "index",
			InputPath:  C.GoString(entryPoint),
		  }},
		Outdir:      C.GoString(Outdir),
		Splitting:	 true,
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
