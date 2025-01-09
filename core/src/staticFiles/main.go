package staticFiles

import (
	"bytes"
	"errors"
	"fmt"
	"mime"
	"path"
	"strings"

	fs "fullstacked/editor/src/fs"
	serialize "fullstacked/editor/src/serialize"

	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

func Serve(baseDir string, filePath string) []byte {
	filePath = strings.TrimPrefix(filePath, "/")
	filePath = strings.TrimSuffix(filePath, "/")

	// check if file exists
	filePathAbs := path.Join(baseDir, filePath)
	exists, isFile := fs.Exists(filePathAbs)

	// then try in .build directory,
	// if exists, use this
	buildDir := path.Join(baseDir, ".build")
	buildFilePathAbs := path.Join(buildDir, filePath)
	buildFileExists, buildFileIsFile := fs.Exists(buildFilePathAbs)
	if buildFileExists && buildFileIsFile {
		filePathAbs = buildFilePathAbs
		isFile = buildFileIsFile
		exists = buildFileExists
	}

	if !exists {
		return nil
	}

	// path is directory,
	// look for index.html
	// if exists, parse and inject `<script type="module" src="index.js"></script>`
	// else, send base HTML index file that includes `<script type="module" src="index.js"></script>`
	if !isFile {
		data := serialize.SerializeString("text/html")
		data = append(data, serialize.SerializeBuffer(indexHTML(filePathAbs))...)
		return data
	}

	fileExtComponents := strings.Split(filePathAbs, ".")
	ext := fileExtComponents[len(fileExtComponents)-1]

	mimeType := strings.Split(mime.TypeByExtension("."+ext), ";")[0]

	// file types fix
	switch ext {
	case "mjs", "cjs":
		mimeType = strings.Split(mime.TypeByExtension(".js"), ";")[0]
	case "woff2":
		mimeType = "font/woff2"
	}

	if mimeType == "" {
		mimeType = "text/plain"
	}

	data := serialize.SerializeString(mimeType)
	data = append(data, fs.ReadFileSerialized(filePathAbs, false)...)

	return data
}

var defaultHTML = bytes.Buffer{}

func indexHTML(directoryPath string) []byte {
	maybeIndexFilePath := path.Join(directoryPath, "index.html")
	indexFileExists, isFile := fs.Exists(maybeIndexFilePath)

	if !indexFileExists || !isFile {
		return generateDefaultHTML()
	}

	htmlContent, err := fs.ReadFile(maybeIndexFilePath)

	if err != nil {
		fmt.Println(err)
		return generateDefaultHTML()
	}

	htmlContent, err = injectScriptInHTML(htmlContent)

	// in case of errors, should return
	// non-injected html content and alert user
	if err != nil {
		fmt.Println(err)
		return generateDefaultHTML()
	}

	return htmlContent
}

func generateDefaultHTML() []byte {
	if len(defaultHTML.Bytes()) == 0 {
		doc, _ := html.Parse(strings.NewReader(""))
		injectScriptInBody(doc)
		html.Render(&defaultHTML, doc)
	}

	return defaultHTML.Bytes()
}

var scriptHTML = "<script type=\"module\" src=\"/index.js\"></script>"

func getScriptNode() *html.Node {
	doc, _ := html.Parse(strings.NewReader(scriptHTML))

	for n := range doc.Descendants() {
		if n.Type == html.ElementNode && n.DataAtom == atom.Script {
			n.Parent.RemoveChild(n)
			return n
		}
	}

	return nil
}

func injectScriptInHTML(htmlContent []byte) ([]byte, error) {
	doc, err := html.Parse(strings.NewReader(string(htmlContent)))

	if err != nil {
		return nil, err
	}

	err = injectScriptInBody(doc)

	// could not find body,
	// simply append script to content
	if err != nil {
		return append(htmlContent, []byte(scriptHTML)...), nil
	}

	HTML := bytes.Buffer{}
	err = html.Render(&HTML, doc)

	if err != nil {
		return nil, err
	}

	return HTML.Bytes(), nil
}

func injectScriptInBody(doc *html.Node) error {
	script := getScriptNode()

	for n := range doc.Descendants() {
		if n.Type == html.ElementNode && n.DataAtom == atom.Body {
			n.AppendChild(script)
			return nil
		}
	}

	return errors.New("could not find body in doc")
}
