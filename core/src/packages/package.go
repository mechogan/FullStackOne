package packages

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
	"strconv"
	"strings"
	"sync"

	semver "github.com/Masterminds/semver/v3"
)

type Package struct {
	Name    string          `json:"name"`
	Version *semver.Version `json:"version"`
	As      []string        `json:"as"`
	Direct  bool            `json:"direct"`

	Locations []string `json:"-"`

	InstallationId float64 `json:"id"`

	Dependants   []*Package `json:"-"`
	Dependencies []*Package `json:"dependencies"`

	Progress struct {
		Stage  string `json:"stage"`
		Loaded int    `json:"loaded"`
		Total  int    `json:"total"`
	} `json:"progress"`
}

type PackageJSON struct {
	Version      string            `json:"version"`
	Dependencies map[string]string `json:"dependencies"`
}

type PackageLockJSON struct {
	Name         string                     `json:"name"`
	Version      string                     `json:"version"`
	As           []string                   `json:"as,omitempty"`
	Locations     []string                   `json:"location"`
	Dependencies map[string]PackageLockJSON `json:"dependencies,omitempty"`
}

func (p *Package) toJSON() PackageLockJSON {
	// if len(p.Dependencies) > 0 {
	// 	deps := map[string]PackageLockJSON{}
	// 	for _, dep := range p.Dependencies {
	// 		deps[dep.Name] = dep.toJSON()
	// 	}

	// 	return PackageLockJSON{
	// 		Name:         p.Name,
	// 		Version:      p.Version.String(),
	// 		Dependencies: deps,
	// 	}
	// }

	return PackageLockJSON{
		Name:    p.Name,
		As: p.As,
		Locations: p.Locations,
		Version: p.Version.String(),
	}
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
	if err != nil {
		fmt.Println(err)
		return
	}

	jsonStr := string(jsonData)

	setup.Callback("", "packages-installation", jsonStr)
}

type Dependencies struct {
	packages []Package
}

func (p *Package) getDependencies() []Package {
	if p.Version == nil {
		panic("trying to get dependencies without resolved version [" + p.Name + "]")
	}

	return p.getDependenciesFromRemote()
}

func (p *Package) getDependenciesFromRemote() []Package {
	dependencies := Dependencies{}

	npmPackageInfo, err := http.Get("https://registry.npmjs.org/" + p.Name + "/" + p.Version.String())
	if err != nil {
		fmt.Println(err)
		return dependencies.packages
	}
	defer npmPackageInfo.Body.Close()

	npmPackageInfoJSON := &npmPackageInfoVersion{}
	err = json.NewDecoder(npmPackageInfo.Body).Decode(npmPackageInfoJSON)
	if err != nil {
		fmt.Println(err)
		return dependencies.packages
	}

	wg := sync.WaitGroup{}
	for n, v := range npmPackageInfoJSON.Dependencies {
		wg.Add(1)
		go NewDependency(p, n, v, &dependencies, &wg)
	}
	wg.Wait()

	return dependencies.packages
}

func NewDependency(
	dependant *Package,
	name string,
	versionStr string,
	dependencies *Dependencies,
	wg *sync.WaitGroup,
) {
	defer wg.Done()
	p := NewPackageWithVersionStr(name, versionStr)
	p.Dependants = []*Package{dependant}
	dependencies.packages = append(dependencies.packages, p)
}

func (p *Package) isInstalled(directory string) bool {
	packageJsonFile := path.Join(directory, "package.json")
	exists, isFile := fs.Exists(packageJsonFile)

	if !exists || !isFile {
		return false
	}

	packageJson := &PackageJSON{}
	packageJsonData, err := fs.ReadFile(packageJsonFile)

	if err != nil {
		fmt.Println(err)
		return false
	}

	err = json.Unmarshal(packageJsonData, packageJson)

	if err != nil {
		fmt.Println(err)
		return false
	}

	installedVersion, err := semver.NewVersion(packageJson.Version)

	if err != nil || installedVersion == nil {
		fmt.Println(err)
		return false
	}

	return installedVersion.Equal(p.Version)
}

func (p *Package) Install(
	baseDirectory string,
	directory string,
	wg *sync.WaitGroup,
) {
	defer wg.Done()

	pLocation := path.Join(directory, p.Name)
	pDir := path.Join(baseDirectory, pLocation)

	if p.Locations == nil {
		p.Locations = []string{}
	}
	p.Locations = append(p.Locations, pLocation)

	if !p.isInstalled(pDir) {
		p.installFromRemote(pDir)
	}

	if len(p.Dependencies) > 0 {
		for _, dep := range p.Dependencies {
			wg.Add(1)
			go dep.Install(baseDirectory, path.Join(pLocation, "node_modules"), wg)
		}
	}
}

func (p *Package) installFromRemote(directory string) {
	// clean
	exists, _ := fs.Exists(directory)
	if exists {
		fs.Rmdir(directory)
	}
	fs.Mkdir(directory)

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
		fmt.Println("failed to get tarball url")
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

	for {
		header, err := tarReader.Next()

		if err == io.EOF {
			break
		}

		if header != nil {

			// strip 1
			filePath := strings.Join(strings.Split(header.Name, "/")[1:], "/")

			target := path.Join(directory, filePath)

			if header.Typeflag == tar.TypeDir {
				fs.Mkdir(target)
			} else if header.Typeflag == tar.TypeReg {
				dir, _ := path.Split(target)
				fs.Mkdir(dir)
				fileData, _ := io.ReadAll(tarReader)
				fs.WriteFile(target, fileData)
			}
		}

		p.Progress.Loaded += 1
		p.notify()
	}

	p.Progress.Stage = "done"
	p.Progress.Loaded = 1
	p.Progress.Total = 1
	p.notify()
}
