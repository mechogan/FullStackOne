package main

import "C"

import (
	"github.com/evanw/esbuild/pkg/api"
)

//export buildWebview
func buildWebview(entryPoint *C.char, OutDir *C.char) {
	api.Build(api.BuildOptions{
        EntryPoints: []string{C.GoString(entryPoint)},
        Outfile: C.GoString(OutDir)+"/index.js",
        Bundle: true,
        Format: api.FormatESModule,
        Write: true,
    });
}

//export buildAPI
func buildAPI(entryPoint *C.char) *C.char {
	result := api.Build(api.BuildOptions{
		EntryPoints: []string{C.GoString(entryPoint)},
        Bundle: true,
        GlobalName: "api",
        Format: api.FormatIIFE,
        Write: false,
	})

	return C.CString(string(result.OutputFiles[0].Contents[:]))
}


