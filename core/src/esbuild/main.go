package esbuild

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"path"
	"path/filepath"
	"reflect"
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

func Build(
	projectDirectory string,
	buildId float64,
) {
	payload := serialize.SerializeNumber(buildId)

	// find entryPoints
	entryPointJS := findEntryPoint(projectDirectory)
	entryPointAbsCSS := filepath.ToSlash(path.Join(projectDirectory, ".build", "index.css"))

	if fs.WASM {
		entryPointAbsCSS = "/" + entryPointAbsCSS
	}

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

		if fs.WASM {
			entryPointAbs = "/" + entryPointAbs
		}

		fs.WriteFile(tmpFile, []byte(`
			import "`+entryPointAbsCSS+`";
			import "components/snackbar.css";
			import "bridge";
			import "`+entryPointAbs+`";
		`))
	}

	if fs.WASM {
		tmpFile = "/" + tmpFile
	}

	packageLock := checkForLockedPackages(projectDirectory)

	plugin := esbuild.Plugin{
		Name: "wasm-fs",
		Setup: func(build esbuild.PluginBuild) {
			build.OnResolve(esbuild.OnResolveOptions{Filter: `.*`},
				func(args esbuild.OnResolveArgs) (esbuild.OnResolveResult, error) {
					fmt.Println(args.Path)
					if strings.HasPrefix(args.Path, "/") {

						if fs.WASM {
							return esbuild.OnResolveResult{
								Path: args.Path,
							}, nil
						}

						return esbuild.OnResolveResult{}, nil
					}

					rootPackageDependency := true
					lockLookup := packageLock

					if args.PluginData != nil && !reflect.ValueOf(args.PluginData).IsNil() {
						lockLookup = (args.PluginData).(*Package).Dependencies
						rootPackageDependency = false
					}

					p := (*Package)(nil)

					resolved, isFullStackedLib := vResolve(args.ResolveDir, args.Path, lockLookup, rootPackageDependency)

					if !strings.HasPrefix(args.Path, ".") && !isFullStackedLib {
						name, versionRequested, _ := ParseName(args.Path)
						lockedVersion := lockLookup[name]

						if rootPackageDependency {
							name = name + "@" + versionRequested
							lockedVersion = lockLookup[name]
						}

						if lockedVersion != "" {
							p = NewWithLockedVersion(args.Path, lockedVersion)
						} else {
							p = New(args.Path)
						}

						p.Install(nil)

						if rootPackageDependency {
							packageLock[name] = p.Version.String()
						}

						if resolved == nil {
							resolved, _ = vResolve(args.ResolveDir, args.Path, lockLookup, rootPackageDependency)
						}
					} else if args.PluginData != nil && !reflect.ValueOf(args.PluginData).IsNil() {
						p = (args.PluginData).(*Package)
					}

					if resolved == nil {
						return esbuild.OnResolveResult{}, nil
					}

					resolvedStr := *resolved
					if !strings.HasPrefix(resolvedStr, "/") {
						resolvedStr = "/" + resolvedStr
					}

					return esbuild.OnResolveResult{
						Path:       resolvedStr,
						PluginData: p,
					}, nil
				})

			build.OnLoad(esbuild.OnLoadOptions{Filter: `.*`},
				func(args esbuild.OnLoadArgs) (esbuild.OnLoadResult, error) {
					contents, _ := fs.ReadFile(args.Path)
					contentsStr := string(contents)

					loader := inferLoader(args.Path)

					return esbuild.OnLoadResult{
						Contents:   &contentsStr,
						Loader:     loader,
						PluginData: args.PluginData,
					}, nil
				})
		},
	}

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
		Plugins:        []esbuild.Plugin{plugin},
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
