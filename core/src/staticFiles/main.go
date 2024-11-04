package staticFiles

import (
	"os"
	"path"
	"strings"
)

func Serve(baseDir string, filePath string) ([]byte) {
	if(strings.HasPrefix("/", filePath)) {
		filePath = filePath[1:]
	}

	if(strings.HasSuffix("/", filePath)) {
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
	}





	return nil
}