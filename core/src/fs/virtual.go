package fs

import (
	"errors"
	"path"
	"path/filepath"
	"strings"
	"time"
)

var virtFS = make(map[string][]byte)
var virtDirs = []string{}

func vReadFile(path string) ([]byte, error) {
	f := virtFS[path]

	if f == nil {
		return nil, errors.New("ENOENT")
	}

	return f, nil
}

func vWriteFile(path string, data []byte) error {
	virtFS[path] = data
	return nil
}

func vMkdir(path string) error {
	for _, dir := range virtDirs {
		if dir == path {
			return nil
		}
	}

	virtDirs = append(virtDirs, path)
	return nil
}

func vStat(path string) (*SmallFileInfo, error) {
	f := virtFS[path]
	d := false

	for _, dir := range virtDirs {
		if dir == path {
			d = true
			break
		}
	}

	if f == nil && !d {
		return nil, errors.New("ENOENT")
	}

	pathComponents := strings.Split(path, "/")

	return &SmallFileInfo{
		pathComponents[len(pathComponents)-1],
		int64(len(f)),
		time.Unix(0, 0),
		d,
	}, nil
}

func vRename(oldPath string, newPath string) error {
	for i, dir := range virtDirs {
		if strings.HasPrefix(dir, oldPath) {
			virtDirs[i] = strings.Replace(dir, oldPath, newPath, 1)
			break
		}
	}

	for file, data := range virtFS {
		if strings.HasPrefix(file, oldPath) {
			newFile := strings.Replace(file, oldPath, newPath, 1)
			virtFS[newFile] = data
			delete(virtFS, file)
			break
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

		if(dir == "") {
			break
		}

		remaining = dir[:len(dir) - 2]
	}
	
	reversed := make([]string, len(pathComponents))

	for i := range reversed {
		reversed[i] = pathComponents[len(pathComponents) - 1 - i]
	}

	return reversed
}



func vReadDir(path string, recursive bool) []SmallFileInfo {
	items := []SmallFileInfo{}

	pathComponents := splitPath(path)

	for _, dir := range virtDirs {
		if(strings.HasPrefix(dir, path)) {
			dirComponents := splitPath(dir);
			relativeName := filepath.Join(dirComponents[len(pathComponents):]...)
			if(recursive || len(dirComponents) - len(pathComponents) == 1) {
				items = append(items, SmallFileInfo{
					Name: relativeName,
					IsDir: true,
				})
			}
		}
	}

	for file := range virtFS {
		if(strings.HasPrefix(file, path)) {
			fileComponents := splitPath(file);
			relativeName := filepath.Join(fileComponents[len(pathComponents):]...)
			if(recursive || len(fileComponents) - len(pathComponents) == 1) {
				items = append(items, SmallFileInfo{
					Name: relativeName,
					IsDir: false,
				})
			}
		}
	}

	return items
}
