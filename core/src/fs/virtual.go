package fs

import (
	"errors"
	"path"
	"path/filepath"
	"strings"
	"time"
)

var VirtFS = make(map[string][]byte)
var VirtDirs = []string{}

func vReadFile(path string) ([]byte, error) {
	f := VirtFS[path]

	if f == nil {
		return nil, errors.New("ENOENT")
	}

	return f, nil
}

func vWriteFile(path string, data []byte) error {
	VirtFS[path] = data
	return nil
}

func vUnlink(path string) error {
	delete(VirtFS, path)
	return nil
}

func vMkdir(path string) error {
	// no trailing slash
	if(strings.HasSuffix(path, "/")) {
		path = path[:len(path) - 1]
	}

	for _, dir := range VirtDirs {
		if dir == path {
			return nil
		}
	}

	VirtDirs = append(VirtDirs, path)
	return nil
}

func vRmdir(path string) error {
	indexesToRemove := []int{}

	for i, dir := range VirtDirs {
		if strings.HasPrefix(dir, path) {
			indexesToRemove = append(indexesToRemove, i)
		}
	}

	for i := len(indexesToRemove) - 1; i >= 0; i-- {
		indexToRemove := indexesToRemove[i]
		VirtDirs[indexToRemove] = VirtDirs[len(VirtDirs)-1]
		VirtDirs = VirtDirs[:len(VirtDirs)-1]
	}

	for file := range VirtFS {
		if strings.HasPrefix(file, path) {
			delete(VirtFS, file)
		}
	}

	return nil
}

func vExists(path string) (bool, bool) {
	for _, dir := range VirtDirs {
		if path == dir {
			return true, false
		}
	}

	for file := range VirtFS {
		if file == path {
			return true, true
		}
	}

	return false, false
}

func vStat(path string) *SmallFileInfo {
	f := VirtFS[path]
	d := false

	for _, dir := range VirtDirs {
		if dir == path {
			d = true
			break
		}
	}

	if f == nil && !d {
		return nil
	}

	pathComponents := strings.Split(path, "/")

	return &SmallFileInfo{
		pathComponents[len(pathComponents)-1],
		int64(len(f)),
		time.Unix(0, 0),
		d,
	}
}

func vRename(oldPath string, newPath string) error {
	for i, dir := range VirtDirs {
		if strings.HasPrefix(dir, oldPath) {
			VirtDirs[i] = strings.Replace(dir, oldPath, newPath, 1)
		}
	}

	for file, data := range VirtFS {
		if strings.HasPrefix(file, oldPath) {
			newFile := strings.Replace(file, oldPath, newPath, 1)
			VirtFS[newFile] = data
			delete(VirtFS, file)
		}
	}

	return nil
}

func splitPath(filePath string) []string {
	pathComponents := []string{}
	remaining := filePath

	for remaining != "" {
		dir, file := path.Split(remaining)
		pathComponents = append(pathComponents, file)

		if dir == "" {
			break
		}

		remaining = dir[:len(dir)-1]
	}

	reversed := make([]string, len(pathComponents))

	for i := range reversed {
		reversed[i] = pathComponents[len(pathComponents)-1-i]
	}

	return reversed
}

func vReadDir(path string, recursive bool) []SmallFileInfo {
	items := []SmallFileInfo{}

	pathComponents := splitPath(path)

	for _, dir := range VirtDirs {
		if strings.HasPrefix(dir, path) {
			dirComponents := splitPath(dir)
			relativeName := filepath.Join(dirComponents[len(pathComponents):]...)
			if recursive || len(dirComponents)-len(pathComponents) == 1 {
				items = append(items, SmallFileInfo{
					Name:  relativeName,
					IsDir: true,
				})
			}
		}
	}

	for file := range VirtFS {
		if strings.HasPrefix(file, path) {
			fileComponents := splitPath(file)
			relativeName := filepath.Join(fileComponents[len(pathComponents):]...)
			if recursive || len(fileComponents)-len(pathComponents) == 1 {
				items = append(items, SmallFileInfo{
					Name:  relativeName,
					IsDir: false,
				})
			}
		}
	}

	return items
}
