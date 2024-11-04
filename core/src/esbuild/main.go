package esbuild

import (
	"runtime/debug"
	"strings"

	"github.com/evanw/esbuild/pkg/api"
)

func Version() (string) {
	_ = api.Transform("const x = 0", api.TransformOptions{})
    bi, _ := debug.ReadBuildInfo()

    for _, dep := range bi.Deps {
		if(strings.HasSuffix(dep.Path, "esbuild")) {
			return dep.Version
		}
    }

	return ""
}