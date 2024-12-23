package git

import (
	fs "fullstacked/editor/src/fs"
	"io"
	"log"
	"os"
	"path"
	"strings"
	"time"

	"github.com/go-git/go-billy/v5"
)

type WasmFS struct{}

type File struct {
	filename string
	data []byte
	io.ReaderAt
	io.Seeker
}

func (File) Close() error {
	return nil
}

func (f File) Write(p []byte) (n int, err error) {
	log.Println("WRITE " + f.filename)
	f.data = append(f.data, p...)
	fs.WriteFile(f.filename, f.data)
	return len(p), nil
}

func (f File) Read(p []byte) (n int, err error) {
	log.Println("READ " + f.filename)
	f.data, _ = fs.ReadFile(f.filename)
	copy(p, f.data)
	return len(p), err
}

func (f File) Size() int64 {
	log.Println("SIZE " + f.filename)
	f.data, _ = fs.ReadFile(f.filename)
	return int64(len(f.data))
}
func (f File) Mode() os.FileMode  {
	log.Println("MODE " + f.filename)
	return os.ModePerm
}
func (f File) ModTime() time.Time {
	log.Println("MODTIME " + f.filename)
	return time.Now()
}
func (f File) IsDir() bool     {
	log.Println("IS_DIR " + f.filename)
	_, isFile := fs.Exists(f.filename)
	return !isFile
}
func (f File) Sys() any  {
	log.Println("SYS " + f.filename)
	return nil
}

func (f File) Name() string {
	log.Println("NAME " + f.filename)
	return f.filename
}

func (f File) Lock() error {
	log.Println("LOCK " + f.filename)
	return nil
}
func (f File) Unlock() error {
	log.Println("UNLOCK " + f.filename)
	return nil

}
func (f File) Truncate(size int64) error {
	log.Println("TRUNCATE " + f.filename)
	return nil
}

func createFile(filename string) File {
	log.Println("CREATE " + filename)
	return File{
		filename: filename,
	}
}

func (WasmFS) Create(filename string) (billy.File, error) {
	log.Println("CREATE " + filename)
	f := createFile(filename)

	fs.WriteFile(filename, []byte{})

	return f, nil
}

func (WasmFS) Open(filename string) (billy.File, error) {
	log.Println("OPEN " + filename)
	return createFile(filename), nil
}

func (WasmFS) OpenFile(filename string, flag int, perm os.FileMode) (billy.File, error) {
	log.Println("OPEN_FILE " + filename)
	return createFile(filename), nil
}

func (WasmFS) Stat(filename string) (os.FileInfo, error) {
	log.Println("STAT " + filename)
	return createFile(filename), nil
}

func (WasmFS) Rename(oldpath, newpath string) error {
	log.Println("RENAME " + oldpath + " | " + newpath)
	fs.Rename(oldpath, newpath)
	return nil
}

func (WasmFS) Remove(filename string) error {
	log.Println("REMOVE " + filename)
	_, isFile := fs.Exists(filename)
	if isFile {
		fs.Unlink(filename)
	} else {
		fs.Rmdir(filename)
	}
	return nil
}

func (WasmFS) Join(elem ...string) string {
	log.Println("JOIN " + strings.Join(elem, ", "))
	return path.Join(elem...)
}

func (w WasmFS) TempFile(dir, prefix string) (billy.File, error) {
	log.Println("TEMP_FILE " + dir + " | " + prefix)
	return createFile(w.Join(dir, prefix)), nil
}

func (w WasmFS) ReadDir(path string) ([]os.FileInfo, error) {
	log.Println("READ_DIR " + path)
	contents, _ := fs.ReadDir(path, false)
	
	items := []os.FileInfo{}
	for _, item := range contents {
		items = append(items, createFile(w.Join(path, item.Name)))
	}
	return items, nil
}

func (WasmFS) MkdirAll(filename string, perm os.FileMode) error {
	log.Println("MK_DIR_ALL " + filename)
	fs.Mkdir(filename)
	return nil
}

func (w WasmFS) Lstat(filename string) (os.FileInfo, error) {
	log.Println("LSTAT " + filename)
	return w.Stat(filename)
}

func (WasmFS) Symlink(target, link string) error {
	log.Println("SYMLINK " + target + " | " + link)
	return nil
}

func (WasmFS) Readlink(link string) (string, error) {
	log.Println("READLINK " + link)
	return "", nil
}

func (WasmFS) Chmod(name string, mode os.FileMode) error {
	log.Println("CHMOD " + name + " | " + mode.String())
	return nil
}

func (WasmFS) Lchown(name string, uid, gid int) error {
	log.Println("LCHOMWN " + name)
	return nil
}

func (WasmFS) Chown(name string, uid, gid int) error {
	log.Println("CHOME " + name)
	return nil
}

func (WasmFS) Chtimes(name string, atime time.Time, mtime time.Time) error {
	log.Println("CHTIMES " + name)
	return nil
}

func (w WasmFS) Chroot(path string) (billy.Filesystem, error) {
	log.Println("CHROOT " + path)
	return w, nil
}

func (WasmFS) Root() string {
	log.Println("ROOT")
	return ""
}
