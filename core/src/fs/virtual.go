package fs

import (
	"errors"
	"strings"
	"time"
)


var virtFS = make(map[string][]byte)
var virtDirs = make(map[string]bool)

func vReadFile(path string) ([]byte, error) {
	f := virtFS[path]

	if(f == nil) {
		return nil, errors.New("ENOENT")
	}

	return f, nil
}

func vWriteFile(path string, data []byte) error {
	virtFS[path] = data
	return nil
}

func vMkDir(path string) error {
	virtDirs[path] = true
	return nil
}

func vStat(path string) (*SmallFileInfo, error) {
	f := virtFS[path]
	d := virtDirs[path]

	if(f == nil && !d) {
		return nil, errors.New("ENOENT")
	}

	pathComponents := strings.Split(path, "/")

	return &SmallFileInfo{
		pathComponents[len(pathComponents) - 1],
		int64(len(f)),
		time.Unix(0, 0),
		virtDirs[path],
	}, nil
}