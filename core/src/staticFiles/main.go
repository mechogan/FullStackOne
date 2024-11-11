package staticFiles

import (
	"mime"
	"path"
	"strings"

	fs "fullstacked/editor/src/fs"
	serialize "fullstacked/editor/src/serialize"
)

func Serve(baseDir string, filePath string) []byte {
	if strings.HasPrefix(filePath, "/") {
		filePath = filePath[1:]
	}

	if strings.HasSuffix(filePath, "/") {
		filePath = filePath[:len(filePath)-1]
	}

	filePathComponents := []string{baseDir}
	filePathComponents = append(filePathComponents, strings.Split(filePath, "/")...)
	filePathAbs := path.Join(filePathComponents...)

	exists, isFile := fs.Exists(filePathAbs)
	if !exists {
		return nil
	}

	if !isFile { // then isDir
		filePathAbs += "/index.html"
		exists, isFile := fs.Exists(filePathAbs)
		if !exists || !isFile {
			return nil
		}
	}

	fileExtComponents := strings.Split(filePathAbs, ".")
	ext := fileExtComponents[len(fileExtComponents)-1]
	mimeType := strings.Split(mime.TypeByExtension("."+ext), ";")[0]

	data := serialize.SerializeString(mimeType)
	data = append(data, fs.ReadFileSerialized(filePathAbs, false)...)

	return data
}
