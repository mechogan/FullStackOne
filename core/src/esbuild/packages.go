package esbuild

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	fs "fullstacked/editor/src/fs"
	setup "fullstacked/editor/src/setup"
	"io"
	"net/http"
	"path"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	semver "github.com/Masterminds/semver/v3"
)

type PackageJSON struct {
	Main             string            `json:"main"`
	Browser          json.RawMessage   `json:"browser"`
	Module           string            `json:"module"`
	Exports          json.RawMessage   `json:"exports"`
	Dependencies     map[string]string `json:"dependencies"`
	PeerDependencies map[string]string `json:"peerDependencies"`
}

type PackageDependencies map[string]*Package

type Package struct {
	Name    string
	Version *semver.Version

	Installed bool

	Progress struct {
		Stage  string
		Loaded int
		Total  int
	}

	// ignore this for json notify
	Dependencies PackageDependencies `json:"-"`
}

//	name    modulePath
//
// |      ⌄       | ⌄ |
// @scoped/package/file
func ParseName(name string) (string, string) {
	scoped := strings.HasPrefix(name, "@")
	parts := strings.Split(name, "/")
	modulePath := ""

	if scoped {
		name = parts[0] + "/" + parts[1]
		if len(parts) > 2 {
			modulePath = "/" + strings.Join(parts[2:], "/")
		}
	} else {
		name = parts[0]
		if len(parts) > 1 {
			modulePath = "/" + strings.Join(parts[1:], "/")
		}
	}

	return name, modulePath
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

	// version used is not in dist-tags
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

	// return latest
	if len(availableVersions) > 0 {
		return availableVersions[0]
	}

	return nil
}

// mostly for esbuild onResolve first clean build
// create package from:
//
// import ... from "..."
//
//	           ⌄
//	@scoped/package/file
func New(name string) *Package {
	name, _ = ParseName(name)
	version := findAvailableVersion(name, "latest")

	return &Package{
		Name:         name,
		Version:      version,
		Installed:    false,
		Dependencies: PackageDependencies{},
	}
}

// if projects has lock file
// onResolve will create package with
//
// import ... from "..."               lock.json file
//
//	        ⌄                        ⌄
//	@scoped/package/file          18.3.1
func NewWithLockedVersion(name string, lockedVersion string) *Package {
	version, err := semver.NewVersion(lockedVersion)
	if err != nil {
		fmt.Println(err)
		return nil
	}

	name, _ = ParseName(name)

	return &Package{
		Name:         name,
		Version:      version,
		Installed:    false,
		Dependencies: PackageDependencies{},
	}
}

// When installing a package dependencies,
// we use the version string from package.json
// we'll lock in package afterwards
//
//	    name      version string
//	      ⌄             ⌄
//	"loose-envify": "^1.1.0"
func newWithVersionString(name string, versionStr string) *Package {
	name, _ = ParseName(name)
	version := findAvailableVersion(name, versionStr)

	return &Package{
		Name:         name,
		Version:      version,
		Installed:    false,
		Dependencies: PackageDependencies{},
	}
}

func (p *Package) Path() string {
	if p.Version == nil {
		panic("called Path on package without any version")
	}

	return path.Join(
		// setup.Directories.NodeModules, 
		p.Name, p.Version.Original())
}

// for downloading progress
func (p *Package) Write(data []byte) (int, error) {
	n := len(data)
	p.Progress.Loaded += n
	p.notify()
	return n, nil
}

func (p *Package) notify() {
	jsonData, err := json.Marshal(p)
	jsonStr := string(jsonData)

	if err != nil {
		fmt.Println(err)
		return
	}

	setup.Callback("", "package", jsonStr)
}

type npmPackageInfoVersion struct {
	Dist struct {
		Tarball string `json:"tarball"`
	} `json:"dist"`
}

type npmPackageInfo struct {
	Tags     map[string]string                `json:"dist-tags"`
	Versions map[string]npmPackageInfoVersion `json:"versions"`
}

func CheckIfTypesExists(name string) bool {
	if strings.HasPrefix(name, "@types/") {
		return false
	}

	request, _ := http.NewRequest("GET", "https://registry.npmjs.org/@types/"+name, nil)
	client := &http.Client{}
	client.Timeout = 5 * time.Second

	res, err := client.Do(request)
	if err != nil {
		return false
	}

	return res.StatusCode <= 299
}

func (p *Package) Install(parentWG *sync.WaitGroup, projectBuild *ProjectBuild) {
	p.Installed = true

	if projectBuild != nil {
		projectBuild.packagesCache = append(projectBuild.packagesCache, p)
	}

	if parentWG != nil {
		defer parentWG.Done()
	}

	if p.Version == nil {
		panic("trying to install a package without resolved version")
	}

	pDir := p.Path()
	fs.Mkdir(pDir)

	npmPackageInfo, err := http.Get("https://registry.npmjs.org/" + p.Name + "/" + p.Version.String())
	if err != nil {
		fmt.Println(err)
		return
	}
	defer npmPackageInfo.Body.Close()

	npmPackageInfoJSON := &npmPackageInfoVersion{}
	err = json.NewDecoder(npmPackageInfo.Body).Decode(npmPackageInfoJSON)
	if err != nil {
		fmt.Println(err)
		return
	}

	tarballUrl := npmPackageInfoJSON.Dist.Tarball
	tarballResponse, err := http.Get(tarballUrl)
	if err != nil {
		p.Progress.Stage = "error"
		p.notify()
		return
	}
	defer tarballResponse.Body.Close()

	// download tarball
	dlTotal, _ := strconv.Atoi(tarballResponse.Header.Get("content-length"))
	p.Progress.Stage = "downloading"
	p.Progress.Loaded = 0
	p.Progress.Total = dlTotal
	p.notify()
	dlReader := io.TeeReader(tarballResponse.Body, p)
	packageDataGZIP, _ := io.ReadAll(dlReader)

	p.Progress.Stage = "unpacking"
	p.Progress.Loaded = 0
	p.Progress.Total = 0
	p.notify()

	// get item count
	packageDataGZIPBufferCount := bytes.NewBuffer(packageDataGZIP)
	gunzipReaderCount, _ := gzip.NewReader(packageDataGZIPBufferCount)
	defer gunzipReaderCount.Close()

	tarReaderCount := tar.NewReader(gunzipReaderCount)
	totalItemCount := 0
	for {
		_, err := tarReaderCount.Next()
		if err == io.EOF {
			break
		}
		totalItemCount += 1
	}
	p.Progress.Total = totalItemCount
	p.notify()

	// untar
	packageDataGZIPBuffer := bytes.NewBuffer(packageDataGZIP)
	gunzipReader, _ := gzip.NewReader(packageDataGZIPBuffer)
	defer gunzipReader.Close()

	tarReader := tar.NewReader(gunzipReader)

	wg := (*sync.WaitGroup)(nil)
	for {
		header, err := tarReader.Next()

		if err == io.EOF {
			break
		}

		if header != nil {

			// strip 1
			filePath := strings.Join(strings.Split(header.Name, "/")[1:], "/")

			target := path.Join(pDir, filePath)

			if header.Typeflag == tar.TypeDir {
				fs.Mkdir(target)
			} else if header.Typeflag == tar.TypeReg {
				dir, _ := path.Split(target)
				fs.Mkdir(dir)
				fileData, _ := io.ReadAll(tarReader)
				fs.WriteFile(target, fileData)

				if projectBuild != nil && filePath == "package.json" {
					packageJSON := PackageJSON{}
					json.Unmarshal(fileData, &packageJSON)

					if packageJSON.Dependencies == nil {
						packageJSON.Dependencies = map[string]string{}
					}

					if CheckIfTypesExists(p.Name) {
						packageJSON.Dependencies["@types/"+p.Name] = "^" + p.Version.String()
					}

					if len(packageJSON.Dependencies) > 0 {
						wg = &sync.WaitGroup{}

						for n, v := range packageJSON.Dependencies {
							d := newWithVersionString(n, v)
							d, _ = projectBuild.reusePackageFromCache(d)
							p.Dependencies[n] = d

							if !d.Installed {
								wg.Add(1)
								go d.Install(wg, projectBuild)
							}
						}
					}

					for n, v := range packageJSON.PeerDependencies {
						d := newWithVersionString(n, v)
						p.Dependencies[n] = d
					}
				}
			}
		}

		p.Progress.Loaded += 1
		p.notify()
	}

	p.Progress.Stage = "done"
	p.Progress.Loaded = 1
	p.Progress.Total = 1
	p.notify()

	if wg != nil {
		wg.Wait()
	}
}
