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

type Installation struct {
	Id                     float64    `json:"id"`
	Packages               []*Package `json:"-"`
	PackagesInstalledCount float64    `json:"packagesInstalledCount"`
	Duration               float64    `json:"duration"`
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

	return NewPackageWithVersionStr(name, versionStr)
}

func NewPackageWithVersionStr(name string, versionStr string) Package {
	if versionStr == "" {
		versionStr = "latest"
	}

	version := findAvailableVersion(name, versionStr)

	return Package{
		Name:    name,
		Version: version,
	}
}

func (installation *Installation) getPackageDependencies(p *Package, wg *sync.WaitGroup, mutex *sync.Mutex) {
	defer wg.Done()

	deps := p.getDependencies()

	newPackages := []*Package{}
	for _, dep := range deps {
		seen := false

		mutex.Lock()
		for _, pp := range installation.Packages {
			if pp.Name == dep.Name && pp.Version.Equal(dep.Version) {
				seen = true
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

func Install(installationId float64, directory string, packagesName []string) {
	start := time.Now().UnixMilli()

	installation := Installation{
		Id: installationId,
	}

	directPackages := []*Package{}
	for _, pName := range packagesName {
		p := NewPackage(pName)
		p.Direct = true
		directPackages = append(directPackages, &p)
	}

	wg := sync.WaitGroup{}
	mutex := sync.Mutex{}

	installation.Packages = directPackages
	installation.getDependencies(directPackages, &wg, &mutex)

	wg.Wait()

	installation.PackagesInstalledCount = float64(len(installation.Packages))

	installation.untanglePackages()

	packageDirectory := path.Join(directory, "node_modules")
	exists, _ := fs.Exists(packageDirectory)
	if !exists {
		fs.Mkdir(packageDirectory)
	}

	for _, p := range installation.Packages {
		p.InstallationId = installation.Id
		wg.Add(1)
		go p.Install(packageDirectory, &wg)
	}

	wg.Wait()

	installation.updatePackageAndLock(directory)

	installation.Duration = float64(time.Now().UnixMilli() - start)
	installation.notify()
}

type DirectPackageJSON struct {
	Dependencies map[string]string `json:"dependencies,omitempty"`
}

func (installation *Installation) updatePackageAndLock(directory string){
	lock := map[string]PackageJSON{}
	direct := DirectPackageJSON{}

	for _, p := range installation.Packages {
		lock[p.Name] = p.toJSON()

		if(p.Direct) {
			if(direct.Dependencies == nil) {
				direct.Dependencies = map[string]string{}
			}

			direct.Dependencies[p.Name] = "^" + p.Version.String()
		}
	}

	jsonData, _ := json.MarshalIndent(lock, "", "    ")
	fs.WriteFile(path.Join(directory, "lock.json"), jsonData)

	jsonData, _ = json.MarshalIndent(direct, "", "    ")
	fs.WriteFile(path.Join(directory, "package.json"), jsonData)
}