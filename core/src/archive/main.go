package archive

import (
	"archive/zip"
	"bytes"
	"io"
	"path"
	"strings"

	fs "fullstacked/editor/src/fs"
)

var fileEventOrigin = "archive"

func Unzip(dest string, data []byte) bool {
	zipReader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return false
	}

	exists, isFile := fs.Exists(dest)
	if exists && isFile {
		fs.Unlink(dest, fileEventOrigin)
	} else if exists && !isFile {
		fs.Rmdir(dest, fileEventOrigin)
	}

	fs.Mkdir(dest, fileEventOrigin)

	for _, zipFile := range zipReader.File {
		if zipFile.FileInfo().IsDir() {
			fs.Mkdir(dest + "/" + zipFile.Name, fileEventOrigin)
		} else {
			data, err := readZipFile(zipFile)
			if err != nil {
				continue
			}
			err = fs.WriteFile(dest+"/"+zipFile.Name, data, fileEventOrigin)
			if err != nil {
				continue
			}
		}
	}

	return true
}

func readZipFile(zf *zip.File) ([]byte, error) {
	f, err := zf.Open()
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return io.ReadAll(f)
}

type inMemoryZipData struct {
	data []byte
}

func (w *inMemoryZipData) Write(chunk []byte) (n int, err error) {
	w.data = append(w.data, chunk...)
	return len(chunk), nil
}

func Zip(directory string) []byte {
	acc := inMemoryZipData{}
	w := zip.NewWriter(&acc)

	files, _ := fs.ReadDir(directory, true, []string{})

	for _, f := range files {
		if strings.HasPrefix(f.Name, "data") ||
			strings.HasPrefix(f.Name, ".build") ||
			strings.HasPrefix(f.Name, ".git") {
			continue
		}

		if f.IsDir {
			w.Create(f.Name + "/")
		} else {
			zipFile, _ := w.Create(f.Name)
			data, _ := fs.ReadFile(path.Join(directory, f.Name))
			zipFile.Write(data)
		}
	}
	w.Close()

	return acc.data
}
