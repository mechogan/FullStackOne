package esbuild

import (
	"C"
	"runtime/debug"
	"strings"

	"github.com/evanw/esbuild/pkg/api"
)

//export Version
func Version() (*C.char) {
	_ = api.Transform("const x = 0", api.TransformOptions{})
    bi, _ := debug.ReadBuildInfo()

    for _, dep := range bi.Deps {
		if(strings.HasSuffix(dep.Path, "esbuild")) {
			return C.CString(dep.Version)
		}
    }

	return C.CString("")
}