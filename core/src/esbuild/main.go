package esbuild

import (
	"encoding/json"
	"fmt"
	"path"
	"path/filepath"
	"runtime/debug"
	"strconv"
	"strings"
	"time"

	fs "fullstacked/editor/src/fs"
	setup "fullstacked/editor/src/setup"

	esbuild "github.com/evanw/esbuild/pkg/api"
)

func Version() string {
	_ = esbuild.Transform("const x = 0", esbuild.TransformOptions{})
	bi, _ := debug.ReadBuildInfo()

	for _, dep := range bi.Deps {
		if strings.HasSuffix(dep.Path, "esbuild") {
			return dep.Version
		}
	}

	return ""
}

func findEntryPoint(directory string) *string {
	possibleEntryPoints := []string{
		"index.js",
		"index.jsx",
		"index.ts",
		"index.tsx",
	}

	items, _ := fs.ReadDir(directory, false)

	entryPoint := (*string)(nil)

	for _, possibleEntry := range possibleEntryPoints {

		for _, item := range items {
			if strings.HasSuffix(item.Name, possibleEntry) {
				entryPoint = &item.Name
				break
			}
		}

		if entryPoint != nil {
			break
		}
	}

	return entryPoint
}

func Build(projectDirectory string) string {
	setup.Callback("", "log", "WE BUILDING")

	// find entryPoint
	entryPoint := findEntryPoint(projectDirectory)
	if entryPoint == nil {
		return "[]"
	}

	entryPointAbs := filepath.ToSlash(path.Join(projectDirectory, *entryPoint))

	// merge base.js and entryPoint
	baseJSbytes, _ := fs.ReadFile(setup.Directories.Editor + "/base.js")
	baseJS := string(baseJSbytes)
	tmpFilePath := filepath.ToSlash(setup.Directories.Tmp) + "/" + strconv.Itoa(int(time.Now().UnixMilli())) + ".js"
	mergedFile := baseJS + "\nimport(\"" + entryPointAbs + "\")\n"
	fs.Mkdir(setup.Directories.Tmp)
	fs.WriteFile(tmpFilePath, []byte(mergedFile))

	// add WASM fixture plugin
	plugins := []esbuild.Plugin{}
	if fs.WASM {
		fmt.Println("WE BUILDING WASM")
		wasmFS := esbuild.Plugin{
			Name: "wasm-fs",
			Setup: func(build esbuild.PluginBuild) {
				build.OnResolve(esbuild.OnResolveOptions{Filter: `.*`},
					func(args esbuild.OnResolveArgs) (esbuild.OnResolveResult, error) {

						resolved := vResolve(args.ResolveDir, args.Path)
						
						if resolved == nil {
							return esbuild.OnResolveResult{}, nil
						}

						return esbuild.OnResolveResult{
							Path: "/" + *resolved,
						}, nil

					})

				build.OnLoad(esbuild.OnLoadOptions{Filter: `.*`},
					func(args esbuild.OnLoadArgs) (esbuild.OnLoadResult, error) {
						contents, _ := fs.ReadFile(args.Path)
						contentsStr := string(contents)

						loader := inferLoader(args.Path)

						return esbuild.OnLoadResult{
							Contents: &contentsStr,
							Loader: loader,
						}, nil
					})
			},
		}
		plugins = append(plugins, wasmFS)
	}

	// build
	result := esbuild.Build(esbuild.BuildOptions{
		EntryPointsAdvanced: []esbuild.EntryPoint{{
			InputPath:  tmpFilePath,
			OutputPath: "index",
		}},
		Outdir:    projectDirectory + "/.build",
		Splitting: true,
		Bundle:    true,
		Format:    esbuild.FormatESModule,
		Sourcemap: esbuild.SourceMapInlineAndExternal,
		Write:     !fs.WASM,
		NodePaths: []string{setup.Directories.NodeModules},
		Plugins:   plugins,
	})

	// delete tmp merged file
	fs.Unlink(tmpFilePath)

	// return errors as json string
	jsonMessages, _ := json.Marshal(result.Errors)
	return string(jsonMessages)
}
