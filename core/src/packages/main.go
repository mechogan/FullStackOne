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
	Id       float64    `json:"id"`
	Packages []*Package `json:"packages"`
	Duration float64    `json:"duration"`
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

	if(constraints != nil) {
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

func (installation *Installation) getDependencies() {
	packages := installation.Packages
	i := 0

	for i < len(packages) {
		p := packages[i]

		deps := p.getDependencies()

		for _, dep := range deps {

			otherVersionSeen := false
			for k, pp := range installation.Packages {
				if pp.Name == dep.Name && !pp.Version.Equal(dep.Version) {

					// keep greater version in root install
					if pp.Version.GreaterThan(dep.Version) {
						otherVersionSeen = true
						p.Dependencies = append(p.Dependencies, &dep)
					} else {
						// we need to swap the package in root

						// add other version in dependants deps
						for _, ppp := range pp.Dependant {
							ppp.Dependencies = append(ppp.Dependencies, pp)
						}

						// remove at k
						installation.Packages[k] = installation.Packages[len(installation.Packages)-1]
						installation.Packages = installation.Packages[:len(installation.Packages)-1]
					}

					break
				}
			}

			// verify if already in list
			seen := false
			j := 0
			for j < len(packages) {

				if packages[j].Name == dep.Name && packages[j].Version.Equal(dep.Version) {
					seen = true
					packages[j].Dependant = append(packages[j].Dependant, p)
					break
				}

				j += 1
			}
			if seen {
				continue
			}

			packages = append(packages, &dep)

			if !otherVersionSeen {
				installation.Packages = append(installation.Packages, &dep)
			}
		}

		i += 1
	}

}

func Install(installationId float64, directory string, packagesName []string) {
	start := time.Now().UnixMilli()

	installation := Installation{
		Id: installationId,
	}

	for _, pName := range packagesName {
		p := NewPackage(pName)
		p.Direct = true
		installation.Packages = append(installation.Packages, &p)
	}

	installation.getDependencies()

	if len(installation.Packages) == 0 {
		fmt.Println("no package to install")
		return
	}

	packageDirectory := path.Join(directory, "node_modules")
	exists, _ := fs.Exists(packageDirectory)
	if !exists {
		fs.Mkdir(packageDirectory)
	}

	wg := sync.WaitGroup{}

	for _, p := range installation.Packages {
		p.InstallationId = installation.Id
		wg.Add(1)
		go p.Install(packageDirectory, &wg)
	}

	wg.Wait()

	installation.Duration = float64(time.Now().UnixMilli() - start)
	installation.notify()
}
