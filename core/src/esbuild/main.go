package esbuild

import (
	"encoding/base64"
	"encoding/json"
	"path"
	"path/filepath"
	"reflect"
	"runtime/debug"
	"strings"
	"sync"

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
	Parent  *PackageLock
	Package *Package
}

type PackagesLockJSON map[string]PackageLockJSON

type PackageLockJSON struct {
	Version      string
	Dependencies PackagesLockJSON
}

type ProjectBuild struct {
	id            float64
	lock          PackageDependencies
	packagesCache []*Package
}

func (projectBuild *ProjectBuild) reusePackageFromCache(p *Package) (*Package, bool) {
	for _, cached := range projectBuild.packagesCache {
		if cached.Name == p.Name && cached.Version.Equal(p.Version) {
			return cached, true
		}
	}

	return p, false
}
func (projectBuild *ProjectBuild) removePackageFromCache(p *Package) {
	for i, cached := range projectBuild.packagesCache {
		if cached.Name == p.Name && cached.Version.Equal(p.Version) {
			projectBuild.packagesCache[i] = projectBuild.packagesCache[len(projectBuild.packagesCache)-1]
			projectBuild.packagesCache = projectBuild.packagesCache[:len(projectBuild.packagesCache)-1]
			return
		}
	}
}

func prepareBuildPackages(lockfile PackagesLockJSON, projectBuild *ProjectBuild) PackageDependencies {
	dependencies := PackageDependencies{}

	for n, lock := range lockfile {
		p := NewWithLockedVersion(n, lock.Version)

		p, foundInCache := projectBuild.reusePackageFromCache(p)

		if !foundInCache {
			projectBuild.packagesCache = append(projectBuild.packagesCache, p)
		}

		dependencies[n] = p
		dependencies[n].Dependencies = prepareBuildPackages(lock.Dependencies, projectBuild)
	}

	return dependencies
}

func newProjectBuild(projectDirectory string, buildId float64) ProjectBuild {
	lockfile := path.Join(projectDirectory, "lock.json")
	exists, isFile := fs.Exists(lockfile)

	projectBuild := ProjectBuild{
		id:            buildId,
		lock:          PackageDependencies{},
		packagesCache: []*Package{},
	}

	if exists && isFile {
		packagesLockData, _ := fs.ReadFile(lockfile)
		packageLockJSON := &PackagesLockJSON{}
		json.Unmarshal(packagesLockData, packageLockJSON)
		projectBuild.lock = prepareBuildPackages(*packageLockJSON, &projectBuild)

		wg := sync.WaitGroup{}
		wg.Add(len(projectBuild.packagesCache))

		for _, p := range projectBuild.packagesCache {
			go p.InstallFromLock(&wg)

			if p.Dependencies == nil {
				p.Dependencies = PackageDependencies{}
			}
		}

		wg.Wait()
	}

	return projectBuild
}

func packageLockToJSON(dependencies PackageDependencies) PackagesLockJSON {
	lock := PackagesLockJSON{}

	for n, p := range dependencies {
		if p == nil {
			continue
		}

		lock[n] = PackageLockJSON{
			Version:      p.Version.String(),
			Dependencies: packageLockToJSON(p.Dependencies),
		}
	}

	return lock
}

func Build(
	projectDirectory string,
	buildId float64,
) {
	projectBuild := newProjectBuild(projectDirectory, buildId)

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

	mutexLock := sync.RWMutex{}

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
								Dependencies: projectBuild.lock,
							},
						}
					}

					mutexLock.RLock()
					resolved, isFullStackedLib := vResolve(args.ResolveDir, args.Path, currentPackageLock.Package)
					mutexLock.RUnlock()

					if !strings.HasPrefix(args.Path, ".") && !isFullStackedLib {
						name, _ := ParseName(args.Path)

						// prevent circular loop
						foundInParent := false
						parentSearch := currentPackageLock
						for parentSearch != nil && !foundInParent {
							if name == parentSearch.Package.Name {
								mutexLock.RLock()
								resolved, _ = vResolve(args.ResolveDir, args.Path, parentSearch.Package)
								mutexLock.RUnlock()

								foundInParent = resolved != nil
							}

							parentSearch = parentSearch.Parent
						}

						if !foundInParent {
							mutexLock.RLock()
							childPackage, isChildLocked := currentPackageLock.Package.Dependencies[name]
							mutexLock.RUnlock()

							if !isChildLocked {
								childPackage = New(args.Path)
							}

							childPackage, _ = projectBuild.reusePackageFromCache(childPackage)

							mutexLock.Lock()
							currentPackageLock.Package.Dependencies[name] = childPackage
							mutexLock.Unlock()

							if !childPackage.Installed {
								if currentPackageLock.Parent == nil {
									childPackage.Install(nil, &projectBuild)
								} else {
									projectBuild.removePackageFromCache(currentPackageLock.Package)
									currentPackageLock.Package.Install(nil, &projectBuild)
								}
							}

							if resolved == nil {
								mutexLock.RLock()
								resolved, _ = vResolve(args.ResolveDir, args.Path, currentPackageLock.Package)
								mutexLock.RUnlock()
							}

							currentPackageLock = &PackageLock{
								Parent:  currentPackageLock,
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
					exists, isFile := fs.Exists(args.Path)
					if !exists || !isFile {
						return esbuild.OnLoadResult{}, nil
					}

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

	if len(projectBuild.lock) > 0 {
		jsonData, _ := json.MarshalIndent(packageLockToJSON(projectBuild.lock), "", "    ")
		fs.WriteFile(path.Join(projectDirectory, "lock.json"), jsonData)
	}

	// return errors as json string
	payload := serialize.SerializeNumber(projectBuild.id)

	jsonMessagesData, _ := json.Marshal(result.Errors)
	jsonMessagesStr := string(jsonMessagesData)
	jsonMessageSerialized := serialize.SerializeString(jsonMessagesStr)
	payload = append(payload, jsonMessageSerialized...)

	setup.Callback("", "build", base64.StdEncoding.EncodeToString(payload))
	fs.Unlink(tmpFile)
}
