package git

import (
	fs "fullstacked/editor/src/fs"
	"io"
	"math/rand"
	"os"
	"path"
	"time"

	"github.com/go-git/go-billy/v5"
)

type WasmFS struct {
	root string
}

type File struct {
	filename string
	path     string
	reader   *FileReader
}

type FileReader struct {
	path   string
	data   []byte
	cursor int64
}

func (f *FileReader) Read(p []byte) (n int, err error) {
	f.data, err = fs.ReadFile(f.path)

	pLength := int64(len(p))
	fLength := int64(len(f.data))

	if err != nil || f.cursor >= fLength {
		return 0, io.EOF
	}

	from := f.cursor
	f.cursor = f.cursor + pLength

	if f.cursor > fLength {
		f.cursor = fLength
	}

	copy(p, f.data[from:f.cursor])

	if f.cursor >= fLength {
		return int(f.cursor - from), nil
	}

	return len(p), nil
}

func (f File) ReadAt(p []byte, off int64) (n int, err error) {
	return len(p), nil
}

func (f File) Close() error {
	return nil
}

func (f File) Write(p []byte) (n int, err error) {
	chunk := make([]byte, len(p))
	copy(chunk, p)

	if f.reader.cursor == 0 {
		f.reader.data = chunk
	} else if f.reader.cursor == int64(len(f.reader.data)) {
		f.reader.data = append(f.reader.data, chunk...)
	} else {
		data := []byte{}

		before := make([]byte, f.reader.cursor)
		copy(before, f.reader.data[0:f.reader.cursor])

		data = append(data, chunk...)

		after := make([]byte, int64(len(f.reader.data))-f.reader.cursor)
		copy(after, f.reader.data[f.reader.cursor:])

		f.reader.data = data
	}

	fs.WriteFile(f.path, f.reader.data)
	f.reader.cursor += int64(len(chunk))
	return len(chunk), nil
}

func (f File) Read(p []byte) (n int, err error) {
	return f.reader.Read(p)
}

func (f File) Seek(offset int64, whence int) (int64, error) {
	switch whence {
	case 0:
		f.reader.cursor = offset
	case 1:
		f.reader.cursor += offset
	case 2:
		f.reader.cursor = int64(len(f.reader.data)) - offset
	}
	return f.reader.cursor, nil
}

func (f File) Size() int64 {
	info := fs.Stat(f.path)
	if info == nil {
		return 0
	}
	return info.Size
}
func (f File) Mode() os.FileMode {
	info := fs.Stat(f.path)
	if info != nil {
		return info.Mode
	}
	return os.ModeDir
}
func (f File) ModTime() time.Time {
	info := fs.Stat(f.path)
	return info.ModTime
}
func (f File) IsDir() bool {
	_, isFile := fs.Exists(f.path)
	return !isFile
}
func (f File) Sys() any {
	return nil
}

func (f File) Name() string {
	return f.filename
}

func (f File) Lock() error {
	return nil
}
func (f File) Unlock() error {
	return nil

}
func (f File) Truncate(size int64) error {
	return nil
}

func (w WasmFS) createFile(filename string) File {
	filePath := path.Join(w.root, filename)
	return File{
		filename: filename,
		path:     filePath,
		reader: &FileReader{
			path: filePath,
		},
	}
}

func (w WasmFS) createFileWithName(filename string, name string) File {
	filePath := path.Join(w.root, filename)
	return File{
		filename: name,
		path:     filePath,
		reader: &FileReader{
			path: filePath,
		},
	}
}

func (w WasmFS) Create(filename string) (billy.File, error) {
	f := w.createFile(filename)

	dir := path.Dir(f.path)
	fs.Mkdir(dir)

	fs.WriteFile(f.path, []byte{})

	return f, nil
}

func (w WasmFS) Open(filename string) (billy.File, error) {
	f := w.createFile(filename)

	exists, _ := fs.Exists(f.path)
	if !exists {
		return nil, os.ErrNotExist
	}

	return f, nil
}

func (w WasmFS) OpenFile(filename string, flag int, perm os.FileMode) (billy.File, error) {
	f := w.createFile(filename)

	exists, _ := fs.Exists(f.path)
	if !exists {
		return w.Create(filename)
	}

	return f, nil
}

func (w WasmFS) Stat(filename string) (os.FileInfo, error) {
	f := w.createFile(filename)

	exists, _ := fs.Exists(f.path)
	if !exists {
		return nil, os.ErrNotExist
	}

	return f, nil
}

func (w WasmFS) Rename(oldpath, newpath string) error {
	fs.Rename(w.Join(w.root, oldpath), w.Join(w.root, newpath))
	return nil
}

func (w WasmFS) Remove(filename string) error {
	path := w.Join(w.root, filename)

	_, isFile := fs.Exists(path)
	if isFile {
		fs.Unlink(path)
	} else {
		fs.Rmdir(path)
	}
	return nil
}

func (WasmFS) Join(elem ...string) string {
	return path.Join(elem...)
}

var letterRunes = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

func RandStringRunes(n int) string {
	b := make([]rune, n)
	for i := range b {
		b[i] = letterRunes[rand.Intn(len(letterRunes))]
	}
	return string(b)
}

func (w WasmFS) TempFile(dir, prefix string) (billy.File, error) {
	filePath := path.Join(dir, prefix+RandStringRunes(6))
	return w.Create(filePath)
}

func (w WasmFS) ReadDir(path string) ([]os.FileInfo, error) {
	f := w.createFile(path)

	contents, _ := fs.ReadDir(f.path, false)

	items := []os.FileInfo{}
	for _, item := range contents {
		items = append(items, w.createFileWithName(w.Join(path, item.Name), item.Name))
	}
	return items, nil
}

func (w WasmFS) MkdirAll(filename string, perm os.FileMode) error {
	f := w.createFile(filename)
	fs.Mkdir(f.path)
	return nil
}

func (w WasmFS) Lstat(filename string) (os.FileInfo, error) {
	return w.Stat(filename)
}

func (WasmFS) Symlink(target, link string) error {
	return nil
}

func (WasmFS) Readlink(link string) (string, error) {
	return "", nil
}

func (WasmFS) Chmod(name string, mode os.FileMode) error {
	return nil
}

func (WasmFS) Lchown(name string, uid, gid int) error {
	return nil
}

func (WasmFS) Chown(name string, uid, gid int) error {
	return nil
}

func (WasmFS) Chtimes(name string, atime time.Time, mtime time.Time) error {
	return nil
}

func (w WasmFS) Chroot(path string) (billy.Filesystem, error) {
	return WasmFS{
		root: path,
	}, nil
}

func (w WasmFS) Root() string {
	return w.root
}
