package staticFiles

import (
	"mime"
	"path"
	"strings"

	fs "fullstacked/editor/src/fs"
	serialize "fullstacked/editor/src/serialize"
)

func Serve(baseDir string, filePath string) []byte {
	filePath = strings.TrimPrefix(filePath, "/")
	filePath = strings.TrimSuffix(filePath, "/")

	// try to resolve in .build directory first
	buildDir := path.Join(baseDir, ".build")
	filePathAbs := resolveFile(buildDir, filePath)

	// then try in base directory
	if filePathAbs == nil {
		filePathAbs = resolveFile(baseDir, filePath)
	}

	if filePathAbs == nil {
		return nil
	}

	fileExtComponents := strings.Split(*filePathAbs, ".")
	ext := fileExtComponents[len(fileExtComponents)-1]
	mimeType := strings.Split(mime.TypeByExtension("."+ext), ";")[0]

	data := serialize.SerializeString(mimeType)
	data = append(data, fs.ReadFileSerialized(*filePathAbs, false)...)

	return data
}

func resolveFile(baseDir string, filePath string) *string {
	filePathComponents := []string{baseDir}
	filePathComponents = append(filePathComponents, strings.Split(filePath, "/")...)
	filePathAbs := path.Join(filePathComponents...)

	exists, isFile := fs.Exists(filePathAbs)
	if !exists {
		return nil
	}

	if !isFile { // then isDir
		// try ./index.html
		filePathAbs += "/index.html"
		exists, isFile := fs.Exists(filePathAbs)
		if !exists || !isFile {
			return nil
		}
	}

	return &filePathAbs
}
