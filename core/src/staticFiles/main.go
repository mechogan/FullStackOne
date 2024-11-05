package staticFiles

import (
	"mime"
	"os"
	"path"
	"strings"

	serialize "fullstacked/editor/src/serialize"
)

func Serve(baseDir string, filePath string) ([]byte) {
	if(strings.HasPrefix(filePath, "/")) {
		filePath = filePath[1:]
	}

	if(strings.HasSuffix(filePath, "/")) {
		filePath = filePath[:len(filePath) - 1]
	}

	filePathComponents := []string{baseDir}
	filePathComponents = append(filePathComponents, strings.Split(filePath, "/")...)
	filePathAbs := path.Join(filePathComponents...)

	fileStat, err := os.Stat(filePathAbs)
	if(err != nil) {
		return nil
	}

	if(fileStat.IsDir()) {
		filePathAbs += "/index.html"
		_, err := os.Stat(filePathAbs)
		if(err != nil) {
			return nil
		}
	}

	fileExtComponents := strings.Split(filePathAbs, ".")
	ext := fileExtComponents[len(fileExtComponents) - 1]
	mimeType := mime.TypeByExtension("." + ext)

	fileData, _ := os.ReadFile(filePathAbs)

	data := serialize.SerializeString(mimeType)
	data = append(data, serialize.SerializeBuffer(fileData)...)

	return data
}