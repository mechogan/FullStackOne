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
	"time"

	semver "github.com/Masterminds/semver/v3"
)

type Installation struct {
	Id       float64      `json:"id"`
	Packages []*Package `json:"packages"`
	Duration float64      `json:"duration"`
}

func (i *Installation) notify() {
	jsonData, err := json.Marshal(i)
	jsonStr := string(jsonData)

	if err != nil {
		fmt.Println(err)
		return
	}

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

	for _, v := range availableVersions {
		if constraints.Check(v) {
			return v
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

	if versionStr == "" {
		versionStr = "latest"
	}

	return NewPackageWithVersionStr(name, versionStr)
}

func NewPackageWithVersionStr(name string, versionStr string) Package {
	version := findAvailableVersion(name, versionStr)

	return Package{
		Name:    name,
		Version: version,
	}
}

func getDependencies(installation *Installation, checked []*Package) {
	foundNewDependencies := false

	if checked == nil {
		checked = []*Package{}
	}

	for _, p := range installation.Packages {
		pChecked := false

		// dont lookup a package already checked
		for _, c := range checked {
			if c.Name == p.Name && c.Version.Equal(p.Version) {
				pChecked = true
				break
			}
		}
		if pChecked {
			continue
		}

		// get deps
		pDeps := p.getDependencies()

		// add every deps not seen previously
		for _, pDep := range pDeps {

			alreadyAdded := false
			for _, iP := range installation.Packages {
				if iP.Name == pDep.Name && iP.Version.Equal(pDep.Version) {
					alreadyAdded = true
					break
				}
			}
			if !alreadyAdded {
				foundNewDependencies = true
				installation.Packages = append(installation.Packages, &pDep)
			}
		}

		// add this package to checked to avoid lookup twice
		checked = append(checked, p)
	}

	// if we found new dependencies
	// continue lookups
	if foundNewDependencies {
		getDependencies(installation, checked)
	}
}

func Install(installationId float64, directory string, packagesName []string) {
	start := time.Now().UnixMilli()

	installation := Installation{
		Id: installationId,
	}

	for _, pName := range packagesName {
		p := NewPackage(pName)
		installation.Packages = append(installation.Packages, &p)
	}

	getDependencies(&installation, nil)

	if len(installation.Packages) == 0 {
		fmt.Println("no package to install")
		return
	}

	for i, p := range installation.Packages {
		for j, pp := range installation.Packages {
			if i < j {
				continue
			}

			if p.Name == pp.Name && !p.Version.Equal(pp.Version) {
				panic("trying to install the same package with 2 different version")
			}
		}
	}

	packageDirectory := path.Join(directory, "node_modules")
	exists, _ := fs.Exists(packageDirectory)
	if !exists {
		fs.Mkdir(packageDirectory)
	}

	for _, p := range installation.Packages {
		p.Installation = &installation
		p.Install(packageDirectory, &installation)
	}

	installation.Duration = float64(time.Now().UnixMilli() - start)
	installation.notify()
}
