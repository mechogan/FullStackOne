package esbuild

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"path"
	"path/filepath"
	"runtime/debug"
	"strings"

	fs "fullstacked/editor/src/fs"
	serialize "fullstacked/editor/src/serialize"
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

func Build(
	projectDirectory string,
	buildId float64,
) {
	payload := serialize.SerializeNumber(buildId)

	// find entryPoint
	entryPoint := findEntryPoint(projectDirectory)
	if entryPoint == nil {
		setup.Callback(
			"",
			"build",
			base64.StdEncoding.EncodeToString(payload),
		)
		return
	}

	entryPointAbs := filepath.ToSlash(path.Join(projectDirectory, *entryPoint))

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
							Loader:   loader,
						}, nil
					})
			},
		}
		plugins = append(plugins, wasmFS)
	}

	// build
	result := esbuild.Build(esbuild.BuildOptions{
		EntryPointsAdvanced: []esbuild.EntryPoint{{
			InputPath:  entryPointAbs,
			OutputPath: "index",
		}},
		Outdir:    projectDirectory + "/.build",
		Splitting: !fs.WASM,
		Bundle:    true,
		Format:    esbuild.FormatESModule,
		Sourcemap: esbuild.SourceMapInlineAndExternal,
		Write:     !fs.WASM,
		NodePaths: []string{
			setup.Directories.NodeModules,
			path.Join(setup.Directories.Editor, "lib"),
		},
		Plugins: plugins,
	})

	if fs.WASM {
		for _, file := range result.OutputFiles {
			fs.WriteFile(file.Path, file.Contents)
		}
	}

	// return errors as json string
	jsonMessagesData, _ := json.Marshal(result.Errors)
	jsonMessagesStr := string(jsonMessagesData)
	jsonMessageSerialized := serialize.SerializeString(jsonMessagesStr)
	payload = append(payload, jsonMessageSerialized...)
	setup.Callback("", "build", base64.StdEncoding.EncodeToString(payload))
}
