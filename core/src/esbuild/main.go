package esbuild

import (
	"encoding/base64"
	"encoding/json"
	"path"
	"path/filepath"
	"runtime/debug"
	"strings"

	fs "fullstacked/editor/src/fs"
	serialize "fullstacked/editor/src/serialize"
	setup "fullstacked/editor/src/setup"
	utils "fullstacked/editor/src/utils"

	esbuild "github.com/evanw/esbuild/pkg/api"
)

func Version() string {
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

func getProjectLock(projectDirectory string) PackagesLock {
	lockfile := path.Join(projectDirectory, ".lock");
	exists, isFile := fs.Exists(lockfile)

	packageLock := PackagesLock{}
	if(exists && isFile) {
		jsonData, _ := fs.ReadFile(lockfile)
		json.Unmarshal(jsonData, packageLock)
	}

	return packageLock
}

func Build(
	projectDirectory string,
	buildId float64,
) {
	payload := serialize.SerializeNumber(buildId)

	// find entryPoints
	entryPointJS := findEntryPoint(projectDirectory)
	entryPointAbsCSS := filepath.ToSlash(path.Join(projectDirectory, ".build", "index.css"))

	// create tmp that imports bridge and entryPoint if any
	tmpFile := path.Join(setup.Directories.Tmp, utils.RandString(10)+".js")
	if entryPointJS == nil {
		fs.WriteFile(tmpFile, []byte(`
			import "`+entryPointAbsCSS+`";
			import "components/snackbar.css";
			import "bridge";
		`))
	} else {
		entryPointAbs := filepath.ToSlash(path.Join(projectDirectory, *entryPointJS))
		fs.WriteFile(tmpFile, []byte(`
			import "`+entryPointAbsCSS+`";
			import "components/snackbar.css";
			import "bridge";
			import "`+entryPointAbs+`";
		`))
	}

	packageLock := checkForLockedPackages(projectDirectory)

	// add WASM fixture plugin
	plugins := []esbuild.Plugin{}
	// if fs.WASM {
		wasmFS := esbuild.Plugin{
			Name: "wasm-fs",
			Setup: func(build esbuild.PluginBuild) {
				build.OnResolve(esbuild.OnResolveOptions{Filter: `.*`},
					func(args esbuild.OnResolveArgs) (esbuild.OnResolveResult, error) {
						if(strings.HasPrefix(args.Path, "/")) {
							return esbuild.OnResolveResult{}, nil
						}

						resolved := vResolve(args.ResolveDir, args.Path)

						if resolved == nil {
							if(!strings.HasPrefix(args.Path, ".")) {
								name, version := ParseName(args.Path)
								pName := name + "@" + version
								lockedVersion := packageLock[pName]

								p := (*Package)(nil)
								if(lockedVersion != ""){
									p = NewWithLockedVersion(args.Path, lockedVersion)
								} else {
									p = New(args.Path)
								}

								p.Install()
								packageLock[pName] = p.Version.String()
							}

							return esbuild.OnResolveResult{}, nil
						}

						resolvedStr := *resolved
						if !strings.HasPrefix(resolvedStr, "/") {
							resolvedStr = "/" + resolvedStr
						}

						return esbuild.OnResolveResult{
							Path: resolvedStr,
						}, nil
					})

				// build.OnLoad(esbuild.OnLoadOptions{Filter: `.*`},
				// 	func(args esbuild.OnLoadArgs) (esbuild.OnLoadResult, error) {
				// 		contents, _ := fs.ReadFile(args.Path)
				// 		contentsStr := string(contents)

				// 		loader := inferLoader(args.Path)

				// 		return esbuild.OnLoadResult{
				// 			Contents: &contentsStr,
				// 			Loader:   loader,
				// 		}, nil
				// 	})
			},
		}
		plugins = append(plugins, wasmFS)
	// }

	// build
	result := esbuild.Build(esbuild.BuildOptions{
		EntryPointsAdvanced: []esbuild.EntryPoint{{
			InputPath:  filepath.ToSlash(tmpFile),
			OutputPath: "index",
		}},
		AllowOverwrite: true,
		Outdir:         projectDirectory + "/.build",
		Splitting:      !fs.WASM,
		Bundle:         true,
		Format:         esbuild.FormatESModule,
		Sourcemap:      esbuild.SourceMapInlineAndExternal,
		Write:          !fs.WASM,
		NodePaths: []string{
			path.Join(setup.Directories.Editor, "lib"),
			setup.Directories.NodeModules,
		},
		Plugins: plugins,
	})

	if fs.WASM {
		for _, file := range result.OutputFiles {
			fs.WriteFile(file.Path, file.Contents)
		}
	}

	jsonData, _ := json.Marshal(packageLock)
	fs.WriteFile(path.Join(projectDirectory, ".lock"), jsonData)

	// return errors as json string
	jsonMessagesData, _ := json.Marshal(result.Errors)
	jsonMessagesStr := string(jsonMessagesData)
	jsonMessageSerialized := serialize.SerializeString(jsonMessagesStr)
	payload = append(payload, jsonMessageSerialized...)
	setup.Callback("", "build", base64.StdEncoding.EncodeToString(payload))
	fs.Unlink(tmpFile)
}
