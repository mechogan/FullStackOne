package packages

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"fullstacked/editor/src/fs"
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
	Direct  bool            `json:"direct"`

	InstallationId float64 `json:"id"`

	Dependant    []*Package `json:"-"`
	Dependencies []*Package`json:"dependencies"`

	Progress struct {
		Stage  string `json:"stage"`
		Loaded int    `json:"loaded"`
		Total  int    `json:"total"`
	} `json:"progress"`
}

// for downloading progress
func (p *Package) Write(data []byte) (int, error) {
	n := len(data)
	p.Progress.Loaded += n
	p.notify()
	return n, nil
}

func (p *Package) notify(){
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
	dependencies := Dependencies{}

	if p.Version == nil {
		panic("trying to get dependencies without resolved version [" + p.Name + "]")
	}

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
	version string,
	dependencies *Dependencies,
	wg *sync.WaitGroup,
) {
	defer wg.Done()
	p := NewPackageWithVersionStr(name, version)
	p.Dependant = []*Package{dependant}
	dependencies.packages = append(dependencies.packages, p)
}

func (p *Package) Install(directory string, wg *sync.WaitGroup) {
	defer wg.Done()

	pDir := path.Join(directory, p.Name)
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

			target := path.Join(pDir, filePath)

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

	if len(p.Dependencies) > 0 {
		for _, dep := range p.Dependencies {
			wg.Add(1)
			go dep.Install(path.Join(pDir, "node_modules"), wg)
		}
	}
}
