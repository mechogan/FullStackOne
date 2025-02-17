package packages

import (
	"encoding/json"
	"fmt"
	fs "fullstacked/editor/src/fs"
	setup "fullstacked/editor/src/setup"
	"net/http"
	"path"
	"sort"
	"strings"
	"sync"
	"time"

	semver "github.com/Masterminds/semver/v3"
)

var fileEventOrigin = "packages"

type Installation struct {
	Id                     float64           `json:"id"`
	PackagesInstalledCount float64           `json:"packagesInstalledCount"`
	Duration               float64           `json:"duration"`
	Packages               []*Package        `json:"-"`
	LocalPackages          []PackageLockJSON `json:"-"`
	BaseDirectory          string            `json:"-"`
}

func (i *Installation) notify() {
	jsonData, err := json.Marshal(i)
	if err != nil {
		fmt.Println(err)
		return
	}

	jsonStr := string(jsonData)

	setup.Callback("", "packages-installation", jsonStr)
}

/*	   name       version
* |      ⌄       |   ⌄   |
* @scoped/package@version
*
*   name  version
* |  ⌄   |   ⌄   |
* package@version
 */
func ParsePackageName(name string) (string, string) {
	scoped := strings.HasPrefix(name, "@")
	version := ""

	if scoped {
		parts := strings.Split(name, "@")
		if len(parts) > 2 {
			name = "@" + parts[1]
			version = parts[2]
		}
	} else {
		parts := strings.Split(name, "@")
		if len(parts) > 1 {
			name = parts[0]
			version = parts[1]
		}
	}

	return name, version
}

type npmPackageInfoVersion struct {
	Dist struct {
		Tarball string `json:"tarball"`
	} `json:"dist"`
	Dependencies map[string]string `json:"dependencies"`
}

type npmPackageInfo struct {
	Tags     map[string]string                `json:"dist-tags"`
	Versions map[string]npmPackageInfoVersion `json:"versions"`
}

func findAvailableVersion(name string, versionRequested string) *semver.Version {
	// get available versions and tag on npmjs
	npmVersions, err := http.Get("https://registry.npmjs.org/" + name)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	defer npmVersions.Body.Close()

	npmVersionsJSON := &npmPackageInfo{}
	err = json.NewDecoder(npmVersions.Body).Decode(npmVersionsJSON)
	if err != nil {
		fmt.Println(err)
		return nil
	}

	// check in tags if versioon where looking for is there
	// ie package@beta
	if npmVersionsJSON.Tags[versionRequested] != "" {
		versionRequested = npmVersionsJSON.Tags[versionRequested]
	}

	constraints, _ := semver.NewConstraint(versionRequested)
	availableVersions := []*semver.Version{}
	for v := range npmVersionsJSON.Versions {
		version, err := semver.NewVersion(v)
		if err == nil {
			availableVersions = append(availableVersions, version)
		}
	}

	vc := semver.Collection(availableVersions)
	sort.Sort(sort.Reverse(vc))

	if constraints != nil {
		for _, v := range availableVersions {
			if constraints.Check(v) {
				return v
			}
		}
	}

	// if no constraint works, use latest
	if len(availableVersions) > 0 {
		return availableVersions[0]
	}

	return nil
}

func NewPackage(packageName string) Package {
	name, versionStr := ParsePackageName(packageName)
	p := NewPackageWithVersionStr(name, versionStr, []PackageLockJSON{})
	p.As = []string{}
	return p
}

func NewPackageWithVersionStr(name string, versionStr string, localPackages []PackageLockJSON) Package {
	if versionStr == "" {
		versionStr = "latest"
	}

	for _, p := range localPackages {
		if p.Name == name && contains(p.As, versionStr) {
			v, _ := semver.NewVersion(p.Version)
			return NewPackageFromLock(name, v, versionStr)
		}
	}

	version := findAvailableVersion(name, versionStr)
	return NewPackageFromLock(name, version, versionStr)
}

func NewPackageFromLock(name string, version *semver.Version, versionStr string) Package {
	return Package{
		Name:    name,
		Version: version,
		As:      []string{versionStr},
	}
}

func (installation *Installation) getPackageDependencies(
	p *Package,
	wg *sync.WaitGroup,
	mutex *sync.Mutex,
) {
	defer wg.Done()

	deps := p.getDependencies(installation)

	newPackages := []*Package{}
	for _, dep := range deps {
		seen := false

		mutex.Lock()
		for _, pp := range installation.Packages {
			if pp.Name == dep.Name && pp.Version.Equal(dep.Version) {
				seen = true
				pp.As = mergeSlices(pp.As, dep.As)
				pp.Dependants = append(pp.Dependants, p)
				break
			}
		}
		mutex.Unlock()

		if !seen {
			newPackages = append(newPackages, &dep)
			mutex.Lock()
			installation.Packages = append(installation.Packages, &dep)
			mutex.Unlock()
		}
	}

	if len(newPackages) > 0 {
		installation.getDependencies(newPackages, wg, mutex)
	}
}

func (installation *Installation) getDependencies(
	packages []*Package,
	wg *sync.WaitGroup,
	mutex *sync.Mutex,
) {
	for _, p := range packages {
		wg.Add(1)
		go installation.getPackageDependencies(p, wg, mutex)
	}
}

func (installation *Installation) untanglePackages() {
	// sort by version descending
	// this will assure we have most recent version in root install
	/*
	*   - foo v3.0.0
	*	- bar v1.2.3
	*		- foo v2.0.0
	*	- baz v3.2.1
	*		- foo v1.0.0
	 */

	sort.Slice(installation.Packages, func(i, j int) bool {
		return installation.Packages[i].Version.GreaterThan(installation.Packages[j].Version)
	})

	toInstall := []*Package{}
	for _, p := range installation.Packages {

		alreadyAdded := false
		for _, pp := range toInstall {
			if p.Name == pp.Name {
				alreadyAdded = true
				break
			}
		}

		if alreadyAdded {

			// place it in dependants dependencies
			for _, pp := range p.Dependants {
				pp.Dependencies = append(pp.Dependencies, p)
			}

		} else {
			toInstall = append(toInstall, p)
		}
	}

	installation.Packages = toInstall
}

func Install(installationId float64, directory string, devDependencies bool, packagesName []string) {
	start := time.Now().UnixMilli()

	installation := Installation{
		Id:                     installationId,
		BaseDirectory:          directory,
		PackagesInstalledCount: 0,
	}

	installation.loadLocalPackages()
	directPackages := installation.loadDirectPackages()

	for _, pName := range packagesName {
		p := NewPackage(pName)
		p.Direct = true
		p.Dev = devDependencies

		for i, pp := range directPackages {
			if pp.Name == p.Name {
				directPackages[i] = directPackages[len(directPackages)-1]
				directPackages = directPackages[:len(directPackages)-1]
				break
			}
		}

		if p.Version != nil {
			directPackages = append(directPackages, &p)
		}
	}

	wg := sync.WaitGroup{}
	mutex := sync.Mutex{}

	installation.Packages = directPackages
	installation.getDependencies(directPackages, &wg, &mutex)

	wg.Wait()

	installation.untanglePackages()

	for _, p := range installation.Packages {
		p.InstallationId = installation.Id
		wg.Add(1)
		go p.Install(&installation, "node_modules", &wg, &mutex)
	}

	wg.Wait()

	installation.updatePackageAndLock()

	installation.Duration = float64(time.Now().UnixMilli() - start)
	installation.notify()
}

func InstallQuick(installationId float64, directory string) {
	start := time.Now().UnixMilli()

	installation := Installation{
		Id:                     installationId,
		BaseDirectory:          directory,
		PackagesInstalledCount: 0,
	}

	lockFile := path.Join(installation.BaseDirectory, "lock.json")
	exists, isFile := fs.Exists(lockFile)

	if !exists || !isFile {
		installation.Duration = float64(time.Now().UnixMilli() - start)
		installation.notify()
		return
	}

	installation.loadLocalPackages()

	// shortest path first to avoid cleaning a directory where a sub-dependency was installed
	sort.Slice(installation.LocalPackages, func(i, j int) bool {
		return installation.LocalPackages[i].Locations[0] < installation.LocalPackages[j].Locations[0]
	})

	wg := sync.WaitGroup{}
	mutex := sync.Mutex{}

	for _, pInfo := range installation.LocalPackages {
		v, _ := semver.NewVersion(pInfo.Version)
		p := NewPackageFromLock(pInfo.Name, v, "")

		sort.Slice(pInfo.Locations, func(i, j int) bool {
			return pInfo.Locations[i] < pInfo.Locations[j]
		})

		for _, l := range pInfo.Locations {
			wg.Add(1)
			go p.Install(&installation, l, &wg, &mutex)
		}
	}

	wg.Wait()

	installation.Duration = float64(time.Now().UnixMilli() - start)
	installation.notify()
}

type DirectPackageJSON struct {
	Dependencies    map[string]string `json:"dependencies"`
	DevDependencies map[string]string `json:"devDependencies"`
	raw             map[string]json.RawMessage
}

type PackageLock struct {
	Packages []PackageLockJSON `json:"packages"`
}

func (installation *Installation) updatePackageAndLock() {
	direct := DirectPackageJSON{
		Dependencies: map[string]string{},
		DevDependencies: map[string]string{},
		raw: map[string]json.RawMessage{},
	}

	packageJsonFilePath := path.Join(installation.BaseDirectory, "package.json");

	exists, isFile := fs.Exists(packageJsonFilePath);
	if(exists && isFile) {
		packageJsonData, _ := fs.ReadFile(packageJsonFilePath);
		json.Unmarshal(packageJsonData, &direct.raw);
	}

	for _, p := range installation.Packages {
		if !p.Direct {
			continue
		}

		if p.Dev {
			if direct.DevDependencies == nil {
				direct.DevDependencies = map[string]string{}
			}

			v := "^" + p.Version.String()
			p.As = appendIfContainsNot(p.As, v)
			if p.VersionOriginal != "" {
				v = p.VersionOriginal
				p.As = appendIfContainsNot(p.As, v)
			}
			direct.DevDependencies[p.Name] = v
		} else {
			if direct.Dependencies == nil {
				direct.Dependencies = map[string]string{}
			}

			v := "^" + p.Version.String()
			p.As = appendIfContainsNot(p.As, v)
			if p.VersionOriginal != "" {
				v = p.VersionOriginal
				p.As = appendIfContainsNot(p.As, v)
			}
			direct.Dependencies[p.Name] = v
		}
	}

	if(len(direct.Dependencies) > 0) {
		dependencies, _ := json.MarshalIndent(direct.Dependencies, "", "    ")
		direct.raw["dependencies"] = json.RawMessage(dependencies)
	}
	if(len(direct.DevDependencies) > 0) {
		devDependencies, _ := json.MarshalIndent(direct.DevDependencies, "", "    ")
		direct.raw["devDependencies"] = json.RawMessage(devDependencies)
	}

	jsonData, err := json.MarshalIndent(direct.raw, "", "    ")
	if err != nil {
		fmt.Println(err)
	}
	fs.WriteFile(packageJsonFilePath, jsonData, fileEventOrigin)

	lock := &PackageLock{
		Packages: []PackageLockJSON{},
	}
	lock.addPackagesToLock(installation.Packages)

	sort.Slice(lock.Packages, func(i, j int) bool {
		if lock.Packages[i].Name == lock.Packages[j].Name {
			return lock.Packages[i].Version < lock.Packages[j].Version
		}
		return lock.Packages[i].Name < lock.Packages[j].Name
	})

	jsonData, err = json.MarshalIndent(lock, "", "    ")
	if err != nil {
		fmt.Println(err)
	}
	fs.WriteFile(path.Join(installation.BaseDirectory, "lock.json"), jsonData, fileEventOrigin)
}

func (lock *PackageLock) addPackagesToLock(packages []*Package) {
	for _, p := range packages {
		for _, pp := range lock.Packages {
			if pp.Name == p.Name && pp.Version == p.Version.String() {
				return
			}
		}

		lock.Packages = append(lock.Packages, p.toJSON())

		if len(p.Dependencies) > 0 {
			lock.addPackagesToLock(p.Dependencies)
		}
	}
}

func (installation *Installation) loadDirectPackages() []*Package {
	directPackages := []*Package{}
	packagesJsonFile := path.Join(installation.BaseDirectory, "package.json")
	exists, isFile := fs.Exists(packagesJsonFile)

	if !exists || !isFile {
		return directPackages
	}

	packageJsonData, err := fs.ReadFile(packagesJsonFile)
	if err != nil {
		fmt.Println(err)
		return directPackages
	}

	packageJson := &PackageJSON{}
	err = json.Unmarshal(packageJsonData, packageJson)
	if err != nil {
		fmt.Println(err)
		return directPackages
	}

	if packageJson.Dependencies != nil {
		for n, v := range packageJson.Dependencies {
			p := NewPackageWithVersionStr(n, v, installation.LocalPackages)
			p.VersionOriginal = v
			p.Direct = true
			directPackages = append(directPackages, &p)
		}
	}

	if packageJson.DevDependencies != nil {
		for n, v := range packageJson.DevDependencies {
			p := NewPackageWithVersionStr(n, v, installation.LocalPackages)
			p.VersionOriginal = v
			p.Direct = true
			p.Dev = true
			directPackages = append(directPackages, &p)
		}
	}

	return directPackages
}

func (installation *Installation) loadLocalPackages() {
	installation.LocalPackages = []PackageLockJSON{}
	lockFile := path.Join(installation.BaseDirectory, "lock.json")
	exists, isFile := fs.Exists(lockFile)
	if !exists || !isFile {
		return
	}

	lockData, err := fs.ReadFile(lockFile)

	if err != nil {
		fmt.Println(err)
		return
	}

	lock := &PackageLock{}
	err = json.Unmarshal(lockData, lock)

	if err != nil {
		fmt.Println(err)
		return
	}

	installation.LocalPackages = lock.Packages
}

func mergeSlices(arr1 []string, arr2 []string) []string {
	for _, b := range arr2 {
		seen := false
		for _, a := range arr1 {
			if a == b {
				seen = true
				break
			}
		}
		if !seen {
			arr1 = append(arr1, b)
		}
	}
	return arr1
}

func contains(arr []string, e string) bool {
	for _, i := range arr {
		if i == e {
			return true
		}
	}
	return false
}

func appendIfContainsNot(arr []string, e string) []string {
	for _, i := range arr {
		if e == i {
			return arr
		}
	}

	return append(arr, e)
}
