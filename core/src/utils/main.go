package utils

import (
	"archive/zip"
	"bytes"
	"io"

	fs "fullstacked/editor/src/fs"
)

func Unzip(dest string, data []byte) bool {
	zipReader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
    if err != nil {
        return false
    }

	for _, zipFile := range zipReader.File {
		if(zipFile.FileInfo().IsDir()) {
			fs.Mkdir(dest + "/" + zipFile.Name)
		} else {
			data, err := readZipFile(zipFile)
			if err != nil {
				return false
			}
			fs.WriteFile(dest + "/" + zipFile.Name, data)
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