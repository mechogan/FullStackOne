package git

import (
	fs "fullstacked/editor/src/fs"
	utils "fullstacked/editor/src/utils"
	"io"
	"os"
	"path"
	"strings"
	"time"

	"github.com/go-git/go-billy/v5"
)

var fileEventOrigin = "git"

type BillyFS struct {
	root string
	ignore []string
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

	fs.WriteFile(f.path, f.reader.data, fileEventOrigin)
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
	info, _ := fs.Stat(f.path)
	if info == nil {
		return 0
	}
	return info.Size
}
func (f File) Mode() os.FileMode {
	info, _ := fs.Stat(f.path)
	if info != nil {
		return info.Mode
	}
	return os.ModeDir
}
func (f File) ModTime() time.Time {
	info, _ := fs.Stat(f.path)
	return info.MTime
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

func (b BillyFS) createFile(filename string) File {
	filePath := path.Join(b.root, filename)
	return File{
		filename: filename,
		path:     filePath,
		reader: &FileReader{
			path: filePath,
		},
	}
}

func (b BillyFS) createFileWithName(filename string, name string) File {
	filePath := path.Join(b.root, filename)
	return File{
		filename: name,
		path:     filePath,
		reader: &FileReader{
			path: filePath,
		},
	}
}

func (b BillyFS) Create(filename string) (billy.File, error) {
	f := b.createFile(filename)

	dir := path.Dir(f.path)
	fs.Mkdir(dir, fileEventOrigin)

	fs.WriteFile(f.path, []byte{}, fileEventOrigin)

	return f, nil
}

func (b BillyFS) Open(filename string) (billy.File, error) {
	f := b.createFile(filename)

	exists, _ := fs.Exists(f.path)
	if !exists {
		return nil, os.ErrNotExist
	}

	return f, nil
}

func (b BillyFS) OpenFile(filename string, flag int, perm os.FileMode) (billy.File, error) {
	f := b.createFile(filename)

	exists, _ := fs.Exists(f.path)
	if !exists {
		return b.Create(filename)
	}

	return f, nil
}

func (b BillyFS) Stat(filename string) (os.FileInfo, error) {
	f := b.createFile(filename)

	exists, _ := fs.Exists(f.path)
	if !exists {
		return nil, os.ErrNotExist
	}

	return f, nil
}

func (b BillyFS) Rename(oldpath, newpath string) error {
	fs.Rename(b.Join(b.root, oldpath), b.Join(b.root, newpath), fileEventOrigin)
	return nil
}

func (b BillyFS) Remove(filename string) error {
	for _, d := range b.ignore {
		if(strings.HasPrefix(filename, d)) {
			return nil
		}
	}

	path := b.Join(b.root, filename)

	_, isFile := fs.Exists(path)
	if isFile {
		fs.Unlink(path, fileEventOrigin)
	} else {
		fs.Rmdir(path, fileEventOrigin)
	}
	return nil
}

func (BillyFS) Join(elem ...string) string {
	return path.Join(elem...)
}

func (b BillyFS) TempFile(dir, prefix string) (billy.File, error) {
	filePath := path.Join(dir, prefix+utils.RandString(6))
	return b.Create(filePath)
}

func (b BillyFS) ReadDir(path string) ([]os.FileInfo, error) {
	for _, d := range b.ignore {
		if(strings.HasPrefix(path, d)) {
			return []os.FileInfo{}, nil
		}
	}

	f := b.createFile(path)

	contents, _ := fs.ReadDir(f.path, false, []string{})

	items := []os.FileInfo{}
	for _, item := range contents {
		items = append(items, b.createFileWithName(b.Join(path, item.Name), item.Name))
	}
	return items, nil
}

func (b BillyFS) MkdirAll(filename string, perm os.FileMode) error {
	f := b.createFile(filename)
	fs.Mkdir(f.path, fileEventOrigin)
	return nil
}

func (b BillyFS) Lstat(filename string) (os.FileInfo, error) {
	return b.Stat(filename)
}

func (BillyFS) Symlink(target, link string) error {
	return nil
}

func (BillyFS) Readlink(link string) (string, error) {
	return "", nil
}

func (BillyFS) Chmod(name string, mode os.FileMode) error {
	return nil
}

func (BillyFS) Lchown(name string, uid, gid int) error {
	return nil
}

func (BillyFS) Chown(name string, uid, gid int) error {
	return nil
}

func (BillyFS) Chtimes(name string, atime time.Time, mtime time.Time) error {
	return nil
}

func (b BillyFS) Chroot(path string) (billy.Filesystem, error) {
	return BillyFS{
		root: path,
	}, nil
}

func (b BillyFS) Root() string {
	return b.root
}
