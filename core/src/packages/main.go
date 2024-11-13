package packages

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/json"
	fs "fullstacked/editor/src/fs"
	setup "fullstacked/editor/src/setup"
	"io"
	"net/http"
	"path"
	"strconv"
	"strings"
)

type Progress struct {
	Name   string
	Stage  string
	Loaded int
	Total  int
}

type ResponseNPM struct {
	Dist map[string]string
}

type DownloadProgress struct {
	Name string
	Loaded int
	Total int
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

func Install(name string) {
	packageDir := path.Join(setup.Directories.NodeModules, name);

	exists, _ := fs.Exists(packageDir)
	if exists {
		return
	}

	fs.Mkdir(packageDir)

	notifyProgress(Progress{
		Name:   name,
		Stage:  "downloading",
		Loaded: 0,
		Total:  0,
	})

	// get tarball url
	npmRes, err := http.Get("https://registry.npmjs.org/" + name + "/latest")
	if(err != nil) {
		return
	}
	defer npmRes.Body.Close()

	npmResJSON := &ResponseNPM{}
	json.NewDecoder(npmRes.Body).Decode(npmResJSON)

	packageRes, err := http.Get(npmResJSON.Dist["tarball"])
	if(err != nil) {
		fs.Rmdir(packageDir)
		notifyProgress(Progress{
			Name:   name,
			Stage:  "done",
			Loaded: 1,
			Total:  1,
		})
		return
	}
	defer packageRes.Body.Close()

	// download tarball
	dlTotal, _ := strconv.Atoi(packageRes.Header.Get("content-length"))
	dlProgress := DownloadProgress{
		Name: name,
		Loaded: 0,
		Total: dlTotal,
	}
	dlReader := io.TeeReader(packageRes.Body, &dlProgress)
	packageDataGZIP, _ := io.ReadAll(dlReader)

	notifyProgress(Progress{
		Name: name,
		Stage: "unpacking",
		Loaded: 0,
		Total: 0,
	})

	// get item count
	packageDataGZIPBufferCount := bytes.NewBuffer(packageDataGZIP)
	gunzipReaderCount, _ := gzip.NewReader(packageDataGZIPBufferCount)
	defer gunzipReaderCount.Close()

	tarReaderCount := tar.NewReader(gunzipReaderCount)
	totalItemCount := 0
	for {
		_, err := tarReaderCount.Next()
		if(err == io.EOF) {
			break
		}
		totalItemCount += 1
	}
	notifyProgress(Progress{
		Name: name,
		Stage: "unpacking",
		Loaded: 0,
		Total: totalItemCount,
	})


	// untar
	packageDataGZIPBuffer := bytes.NewBuffer(packageDataGZIP)
	gunzipReader, _ := gzip.NewReader(packageDataGZIPBuffer)
	defer gunzipReaderCount.Close()

	tarReader := tar.NewReader(gunzipReader)
	itemCount := 0
	for {
		header, err := tarReader.Next()

		if(err == io.EOF) {
			break
		}

		if(header != nil) {

			// strip 1
			filePath := strings.Join(strings.Split(header.Name, "/")[1:], "/")

			target := path.Join(packageDir, filePath)

			if(header.Typeflag == tar.TypeDir) {
				fs.Mkdir(target)
			} else if(header.Typeflag == tar.TypeReg) {
				dir, fileName := path.Split(target);
				fs.Mkdir(dir);
				fileData, _ := io.ReadAll(tarReader)
				fs.WriteFile(target, fileData)

				if(fileName == "package.json") {
					processPackageJSON(fileData)
				}
			}
		}
		
		itemCount += 1

		notifyProgress(Progress{
			Name: name,
			Stage: "unpacking",
			Loaded: itemCount,
			Total: totalItemCount,
		})
	}
	
	notifyProgress(Progress{
		Name: name,
		Stage: "done",
		Loaded: 1,
		Total: 1,
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