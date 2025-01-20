package esbuild

import (
	"encoding/base64"
	"encoding/json"
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

type PackageLock struct {
	Parent *PackageLock
	Package *Package
}

// func getPackagesLock(projectDirectory string) *PackageDependencies {
// 	packagesLock := &PackageDependencies{}

// 	lockfile := path.Join(projectDirectory, "lock.json")
// 	exists, isFile := fs.Exists(lockfile)

// 	if exists && isFile {
// 		jsonData, _ := fs.ReadFile(lockfile)
// 		json.Unmarshal(jsonData, packagesLock)
// 	}

// 	return packagesLock
// }

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

	rootPackageLock := &PackageDependencies{}

	plugin := esbuild.Plugin{
		Name: "fullstacked",
		Setup: func(build esbuild.PluginBuild) {
			build.OnResolve(esbuild.OnResolveOptions{Filter: `.*`},
				func(args esbuild.OnResolveArgs) (esbuild.OnResolveResult, error) {
					if strings.HasPrefix(args.Path, "/") {
						return esbuild.OnResolveResult{
							Path: args.Path,
						}, nil
					}

					currentPackageLock := (*PackageLock)(nil)
					if args.PluginData != nil && !reflect.ValueOf(args.PluginData).IsNil() {
						currentPackageLock = (args.PluginData).(*PackageLock)
					} else {
						currentPackageLock = &PackageLock{
							Parent: nil,
							Package: &Package{
								Dependencies: *rootPackageLock,
							},
						}
					}

					resolved, isFullStackedLib := vResolve(args.ResolveDir, args.Path, currentPackageLock.Package.Dependencies)

					if !strings.HasPrefix(args.Path, ".") && !isFullStackedLib {
						name, _ := ParseName(args.Path)

						foundInParent := false
						parentSearch := currentPackageLock
						for parentSearch != nil {
							if(name == parentSearch.Package.Name) {
								resolved, _ = vResolve(args.ResolveDir, args.Path, parentSearch.Package.Dependencies)

								foundInParent = true
								currentPackageLock = parentSearch
								break;
							}

							parentSearch = parentSearch.Parent
						}

						if (!foundInParent) {
							childPackage, isChildLocked := currentPackageLock.Package.Dependencies[name]

							if (!isChildLocked) {
								childPackage = New(args.Path)
								currentPackageLock.Package.Dependencies[name] = childPackage
							}
	
							if(!childPackage.Installed) {
								childPackage.Install(nil)
							}
	
							if resolved == nil {
								resolved, _ = vResolve(args.ResolveDir, args.Path, currentPackageLock.Package.Dependencies)
							}
	
							currentPackageLock = &PackageLock{
								Parent: currentPackageLock,
								Package: childPackage,
							}
						}
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
						PluginData: currentPackageLock,
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

	jsonData, _ := json.MarshalIndent(packageLockToJSON(*rootPackageLock), "", "    ")
	fs.WriteFile(path.Join(projectDirectory, "lock.json"), jsonData)

	// return errors as json string
	jsonMessagesData, _ := json.Marshal(result.Errors)
	jsonMessagesStr := string(jsonMessagesData)
	jsonMessageSerialized := serialize.SerializeString(jsonMessagesStr)
	payload = append(payload, jsonMessageSerialized...)
	setup.Callback("", "build", base64.StdEncoding.EncodeToString(payload))
	fs.Unlink(tmpFile)
}

type PackagesLockJSON map[string]PackageLockJSON

type PackageLockJSON struct {
	Version string
	Dependencies PackagesLockJSON
}

func packageLockToJSON(dependencies PackageDependencies) PackagesLockJSON {
	lock := PackagesLockJSON{}

	for n, p := range dependencies {
		lock[n] = PackageLockJSON{
			Version: p.Version.String(),
			Dependencies: packageLockToJSON(p.Dependencies),
		}
	}

	return lock
}
