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
	"sort"
	"strconv"
	"strings"
	semver "github.com/Masterminds/semver/v3"
)

type Progress struct {
	Name   string
	Version string
	Stage  string
	Loaded int
	Total  int
}

type ResponseNPM struct {
	Dist map[string]any
}

type DownloadProgress struct {
	Name   string
	Loaded int
	Total  int
}

func (dlProgress *DownloadProgress) Write(p []byte) (int, error) {
	n := len(p)
	dlProgress.Loaded += n
	notifyProgress(Progress{
		Name:   dlProgress.Name,
		Stage:  "downloading",
		Loaded: dlProgress.Loaded,
		Total:  dlProgress.Total,
	})
	return n, nil
}

func cleanName(name string) string {
	scoped := strings.HasPrefix(name, "@")
	parts := strings.Split(name, "/")

	if(scoped) {
		return parts[0] + "/" + parts[1]
	}

	return parts[0]
}

var installing = []string{}

func Install(name string) {
	name = cleanName(name)

	for _, n := range installing {
		if n == name {
			return
		}
	}

	installing = append(installing, name)
	go install(name)
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

func findBestMatchingVersion(info npmPackageInfo, version string) *semver.Version {
	constraints, _ := semver.NewConstraint(version)
	availableVersions := []*semver.Version{}
	for v := range info.Versions {
		version, err := semver.NewVersion(v)
		if err == nil {
			availableVersions = append(availableVersions, version)
		}
	}
	
	vc := semver.Collection(availableVersions)
	sort.Sort(sort.Reverse(vc))

	for _, v := range availableVersions {
		if(constraints.Check(v)){
			return v
		}
	}

	return nil
}

func install(name string) {
	scoped := false
	versionStr := "latest"

	if strings.HasPrefix(name, "@") {
		scoped = true
	}

	parts := strings.Split(name, "@")

	if scoped && len(parts) == 3 {
		name = "@" + parts[1]
		versionStr = parts[2]
	} else if len(parts) == 2 {
		name = parts[0]
		versionStr = parts[1]
	}

	fmt.Println(name, versionStr)

	// get available versions and tag on npmjs
	npmVersions, err := http.Get("https://registry.npmjs.org/" + name)
	if err != nil {
		fmt.Println(err)
		notifyProgress(Progress{
			Name:   name,
			Version: versionStr,
			Stage:  "error",
			Loaded: 1,
			Total:  1,
		})
		return
	}
	defer npmVersions.Body.Close()

	npmVersionsJSON := &npmPackageInfo{}
	err = json.NewDecoder(npmVersions.Body).Decode(npmVersionsJSON)
	if err != nil {
		fmt.Println(err)
		notifyProgress(Progress{
			Name:   name,
			Version: versionStr,
			Stage:  "error",
			Loaded: 1,
			Total:  1,
		})
		return
	}

	// version used is not in dist-tags
	if(npmVersionsJSON.Tags[versionStr] != "") {
		versionStr = npmVersionsJSON.Tags[versionStr]
	}

	version := findBestMatchingVersion(*npmVersionsJSON, versionStr)

	lastPart := strconv.Itoa(int(version.Patch()))
	if(version.Prerelease() != "") {
		lastPart += "-" + version.Prerelease()
	}

	packageDir := path.Join(
		setup.Directories.NodeModules, 
		name, 
		strconv.Itoa(int(version.Major())), 
		strconv.Itoa(int(version.Minor())),
		lastPart,
	)

	exists, _ := fs.Exists(packageDir)
	if exists {
		fs.Rmdir(packageDir)
	}

	fs.Mkdir(packageDir)

	notifyProgress(Progress{
		Name:   name,
		Version: version.Original(),
		Stage:  "downloading",
		Loaded: 0,
		Total:  0,
	})

	tarballUrl := npmVersionsJSON.Versions[version.Original()].Dist.Tarball
	packageRes, err := http.Get(tarballUrl)
	if err != nil {
		fs.Rmdir(packageDir)
		notifyProgress(Progress{
			Name:   name,
			Version: version.Original(),
			Stage:  "error",
			Loaded: 1,
			Total:  1,
		})
		return
	}
	defer packageRes.Body.Close()

	// download tarball
	dlTotal, _ := strconv.Atoi(packageRes.Header.Get("content-length"))
	dlProgress := DownloadProgress{
		Name:   name,
		Loaded: 0,
		Total:  dlTotal,
	}
	dlReader := io.TeeReader(packageRes.Body, &dlProgress)
	packageDataGZIP, _ := io.ReadAll(dlReader)

	notifyProgress(Progress{
		Name:   name,
		Version: version.Original(),
		Stage:  "unpacking",
		Loaded: 0,
		Total:  0,
	})

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
	notifyProgress(Progress{
		Name:   name,
		Version: version.Original(),
		Stage:  "unpacking",
		Loaded: 0,
		Total:  totalItemCount,
	})

	// untar
	packageDataGZIPBuffer := bytes.NewBuffer(packageDataGZIP)
	gunzipReader, _ := gzip.NewReader(packageDataGZIPBuffer)
	defer gunzipReaderCount.Close()

	tarReader := tar.NewReader(gunzipReader)
	itemCount := 0
	for {
		header, err := tarReader.Next()

		if err == io.EOF {
			break
		}

		if header != nil {

			// strip 1
			filePath := strings.Join(strings.Split(header.Name, "/")[1:], "/")

			target := path.Join(packageDir, filePath)

			if header.Typeflag == tar.TypeDir {
				fs.Mkdir(target)
			} else if header.Typeflag == tar.TypeReg {
				dir, fileName := path.Split(target)
				fs.Mkdir(dir)
				fileData, _ := io.ReadAll(tarReader)
				fs.WriteFile(target, fileData)

				if fileName == "package.json" {
					// processPackageJSON(fileData)
				}
			}
		}

		itemCount += 1

		notifyProgress(Progress{
			Name:   name,
			Version: version.Original(),
			Stage:  "unpacking",
			Loaded: itemCount,
			Total:  totalItemCount,
		})
	}

	notifyProgress(Progress{
		Name:   name,
		Version: version.Original(),
		Stage:  "done",
		Loaded: 1,
		Total:  1,
	})
}

func notifyProgress(progress Progress) {
	jsonData, _ := json.Marshal(progress)
	jsonStr := string(jsonData)
	setup.Callback("", "package-install-progress", jsonStr)
}

type PackageJSON struct {
	Dependencies map[string]string
}

func processPackageJSON(packageJSONData []byte) {
	packageJSON := PackageJSON{}
	json.Unmarshal(packageJSONData, &packageJSON)

	for dep := range packageJSON.Dependencies {
		Install(dep)
	}
}
