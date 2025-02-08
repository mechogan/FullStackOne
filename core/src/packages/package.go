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
	Name            string          `json:"name"`
	Version         *semver.Version `json:"version"`
	VersionOriginal string          `json:"-"`
	As              []string        `json:"as"`
	Direct          bool            `json:"direct"`

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
	Name      string   `json:"name"`
	Version   string   `json:"version"`
	As        []string `json:"as,omitempty"`
	Locations []string `json:"location"`
}

func (p *Package) toJSON() PackageLockJSON {
	return PackageLockJSON{
		Name:      p.Name,
		As:        p.As,
		Locations: p.Locations,
		Version:   p.Version.String(),
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

func (p *Package) getDependencies(i *Installation) []Package {
	if p.Version == nil {
		panic("trying to get dependencies without resolved version [" + p.Name + "]")
	}

	dependencies := Dependencies{
		packages: []Package{},
	}

	deps := p.getDependenciesList(i)

	if deps == nil {
		return dependencies.packages
	}

	wg := sync.WaitGroup{}
	mutex := sync.Mutex{}
	for n, v := range deps {
		wg.Add(1)
		go NewDependency(i, p, n, v, &dependencies, &wg, &mutex)
	}
	wg.Wait()

	return dependencies.packages
}

func (p *Package) getDependenciesList(i *Installation) map[string]string {
	for _, pp := range i.LocalPackages {
		if pp.Name != p.Name || pp.Version != p.Version.String() {
			continue
		}

		for _, l := range pp.Locations {
			pDir := path.Join(i.BaseDirectory, l, p.Name)
			ppp := NewPackageFromLock(pp.Name, p.Version, "")
			if ppp.isInstalled(pDir) {
				return ppp.getDependenciesFromLocal(pDir)
			}
		}
	}

	return p.getDependenciesFromRemote()
}

func (p *Package) getDependenciesFromLocal(directory string) map[string]string {
	packageJsonFile := path.Join(directory, "package.json")

	packageJsonData, err := fs.ReadFile(packageJsonFile)

	if err != nil {
		return nil
	}

	packageJson := &PackageJSON{}
	err = json.Unmarshal(packageJsonData, packageJson)

	if err != nil {
		return nil
	}

	return packageJson.Dependencies
}

func (p *Package) getDependenciesFromRemote() map[string]string {
	npmPackageInfo, err := http.Get("https://registry.npmjs.org/" + p.Name + "/" + p.Version.String())
	if err != nil {
		fmt.Println(err)
		return nil
	}
	defer npmPackageInfo.Body.Close()

	npmPackageInfoJSON := &npmPackageInfoVersion{}
	err = json.NewDecoder(npmPackageInfo.Body).Decode(npmPackageInfoJSON)
	if err != nil {
		fmt.Println(err)
		return nil
	}

	return npmPackageInfoJSON.Dependencies
}

func NewDependency(
	installation *Installation,
	dependant *Package,
	name string,
	versionStr string,
	dependencies *Dependencies,
	wg *sync.WaitGroup,
	mutex *sync.Mutex,
) {
	defer wg.Done()
	p := NewPackageWithVersionStr(name, versionStr, installation.LocalPackages)
	p.Dependants = []*Package{dependant}
	mutex.Lock()
	dependencies.packages = append(dependencies.packages, p)
	mutex.Unlock()
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
	i *Installation,
	directory string,
	wg *sync.WaitGroup,
	mutex *sync.Mutex,
) {
	defer wg.Done()

	pLocation := path.Join(directory, p.Name)
	pDir := path.Join(i.BaseDirectory, pLocation)

	if p.Locations == nil {
		p.Locations = []string{}
	}
	p.Locations = append(p.Locations, directory)

	if !p.isInstalled(pDir) {
		mutex.Lock()
		i.PackagesInstalledCount += 1
		mutex.Unlock()
		p.installFromRemote(pDir)
	}

	if len(p.Dependencies) > 0 {
		for _, dep := range p.Dependencies {
			wg.Add(1)
			go dep.Install(i, path.Join(pLocation, "node_modules"), wg, mutex)
		}
	}
}

func (p *Package) installFromRemote(directory string) {
	// clean
	exists, _ := fs.Exists(directory)
	if exists {
		fs.Rmdir(directory, fileEventOrigin)
	}
	fs.Mkdir(directory, fileEventOrigin)

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
				fs.Mkdir(target, fileEventOrigin)
			} else if header.Typeflag == tar.TypeReg {
				dir, _ := path.Split(target)
				fs.Mkdir(dir, fileEventOrigin)
				fileData, _ := io.ReadAll(tarReader)
				fs.WriteFile(target, fileData, fileEventOrigin)
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
