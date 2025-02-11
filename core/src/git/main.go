package git

import (
	"encoding/json"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/go-git/go-billy/v5"
	"github.com/go-git/go-billy/v5/osfs"
	git "github.com/go-git/go-git/v5"
	gitConfig "github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/cache"
	"github.com/go-git/go-git/v5/plumbing/format/gitignore"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/go-git/go-git/v5/storage/filesystem"

	"fullstacked/editor/src/fs"
	serialize "fullstacked/editor/src/serialize"
	setup "fullstacked/editor/src/setup"
)

var ignoredDirectories = []string{
	"/.build",
	"/data",
	"/node_modules",
}

type GitMessageJSON struct {
	Url   string
	Data  string
	Error bool
}

func errorFmt(e error) string {
	gitError := GitMessageJSON{
		Data:  strings.ReplaceAll(strings.TrimSpace(e.Error()), "\"", "\\\""),
		Error: true,
	}
	jsonData, _ := json.Marshal(gitError)
	jsonStr := string(jsonData)
	return jsonStr
}

func getRepo(directory string) (*git.Repository, error) {
	repo := (*git.Repository)(nil)
	err := (error)(nil)

	
	wg := sync.WaitGroup{}

	dotDir := path.Join(directory, ".git");
	gitFs := (billy.Filesystem)(nil)
	if(fs.WASM) {
		gitStorage := newStorage(dotDir, &wg)
		gitFs = NewBillyFS(gitStorage, []string{})
	} else {
		gitFs = osfs.New(dotDir)
	}

	repoStorage := newStorage(directory, &wg)
	repoFs := NewBillyFS(repoStorage, ignoredDirectories)

	repo, err = git.Open(filesystem.NewStorage(gitFs, cache.NewObjectLRUDefault()), repoFs)

	if err != nil {
		return nil, err
	}

	wg.Wait()

	return repo, nil
}

func getWorktree(directory string) (*git.Worktree, error) {
	repo, err := getRepo(directory)

	if err != nil {
		return nil, err
	}

	worktree, err := repo.Worktree()

	if err != nil {
		return nil, err
	}

	// always ignore FullStacked artifacts
	for _, d := range ignoredDirectories {
		worktree.Excludes = append(worktree.Excludes, gitignore.ParsePattern("/"+d, []string{}))
	}

	return worktree, nil
}

type GitProgress struct {
	Name string
	Url  string
}

func (gitProgress *GitProgress) Write(p []byte) (int, error) {
	n := len(p)

	jsonData, _ := json.Marshal(GitMessageJSON{
		Url:   gitProgress.Url,
		Data:  strings.TrimSpace(string(p)),
		Error: false,
	})

	setup.Callback("", gitProgress.Name, string(jsonData))
	return n, nil
}

func (gitProgress *GitProgress) Error(message string) {
	jsonData, _ := json.Marshal(GitMessageJSON{
		Url:   gitProgress.Url,
		Data:  strings.ReplaceAll(strings.TrimSpace(message), "\"", "\\\""),
		Error: true,
	})

	setup.Callback("", gitProgress.Name, string(jsonData))
}

func Clone(into string, url string, username *string, password *string) {
	auth := (*http.BasicAuth)(nil)
	if username != nil && password != nil {
		auth = &http.BasicAuth{
			Username: *username,
			Password: *password,
		}
	}

	progress := GitProgress{
		Name: "git-clone",
		Url:  url,
	}

	wg := sync.WaitGroup{}

	dotDir := path.Join(into, ".git");
	gitFs := (billy.Filesystem)(nil)
	if(fs.WASM) {
		gitStorage := newStorage(dotDir, &wg)
		gitFs = NewBillyFS(gitStorage, []string{})
	} else {
		gitFs = osfs.New(dotDir)
	}

	repoStorage := newStorage(into, &wg)
	repoFs := NewBillyFS(repoStorage, ignoredDirectories)

	_, err := git.Clone(filesystem.NewStorage(gitFs, cache.NewObjectLRUDefault()), repoFs, &git.CloneOptions{
		Auth:     auth,
		URL:      url,
		Progress: &progress,
	})
	

	if err != nil {
		progress.Error(err.Error())
		fs.Rmdir(into, fileEventOrigin)
		return
	}

	wg.Wait()

	progress.Write([]byte("done"))
}

type HeadObj struct {
	Name string
	Hash string
}

func Head(directory string) []byte {
	repo, err := getRepo(directory)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	head, err := repo.Head()

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	headObj := HeadObj{
		Name: head.Name().Short(),
		Hash: head.Hash().String(),
	}

	jsonData, _ := json.Marshal(headObj)
	jsonStr := string(jsonData)
	return serialize.SerializeString(jsonStr)
}

type GitStatus struct {
	Added    []string
	Modified []string
	Deleted  []string
}

func Status(directory string) []byte {
	worktree, err := getWorktree(directory)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	err = worktree.AddGlob(".")
	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	status, err := worktree.Status()
	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	gitStatus := GitStatus{
		Added:    []string{},
		Modified: []string{},
		Deleted:  []string{},
	}

	for file, fileStatus := range status {
		if fileStatus.Staging == git.Added || fileStatus.Staging == git.Copied {
			gitStatus.Added = append(gitStatus.Added, file)
		} else if fileStatus.Staging == git.Deleted {
			gitStatus.Deleted = append(gitStatus.Deleted, file)
		} else {
			gitStatus.Modified = append(gitStatus.Modified, file)
		}
	}

	jsonData, _ := json.Marshal(gitStatus)
	jsonStr := string(jsonData)
	return serialize.SerializeString(jsonStr)
}

func Pull(directory string, username *string, password *string) {
	progress := GitProgress{
		Name: "git-pull",
	}

	worktree, err := getWorktree(directory)

	if err != nil {
		progress.Error(err.Error())
		return
	}

	repo, err := getRepo(directory)

	if err != nil {
		progress.Error(err.Error())
		return
	}

	remote, err := repo.Remote("origin")

	if err != nil {
		progress.Error(err.Error())
		return
	}

	progress.Url = remote.Config().URLs[0]

	progress.Write([]byte("start"))

	auth := (*http.BasicAuth)(nil)
	if username != nil && password != nil {
		auth = &http.BasicAuth{
			Username: *username,
			Password: *password,
		}
	}

	err = worktree.AddGlob(".")
	if err != nil {
		progress.Error(err.Error())
		return
	}

	head, err := repo.Head()

	if err != nil {
		progress.Error(err.Error())
		return
	}

	err = worktree.Pull(&git.PullOptions{
		Auth:          auth,
		ReferenceName: head.Name(),
		Progress:      &progress,
	})

	if err != nil && err.Error() != "already up-to-date" {
		progress.Error(err.Error())
		return
	}

	progress.Write([]byte("done"))
}

func Push(directory string, username *string, password *string) {
	progress := GitProgress{
		Name: "git-push",
	}

	repo, err := getRepo(directory)

	if err != nil {
		progress.Error(err.Error())
		return
	}

	remote, err := repo.Remote("origin")

	if err != nil {
		progress.Error(err.Error())
		return
	}

	progress.Url = remote.Config().URLs[0]

	progress.Write([]byte("start"))

	auth := (*http.BasicAuth)(nil)
	if username != nil && password != nil {
		auth = &http.BasicAuth{
			Username: *username,
			Password: *password,
		}
	}

	err = repo.Push(&git.PushOptions{
		Auth: auth,
		Progress: &GitProgress{
			Name: "git-push",
		},
	})

	if err != nil {
		progress.Error(err.Error())
		return
	}

	progress.Write([]byte("done"))
}

func Restore(directory string, files []string) []byte {
	worktree, err := getWorktree(directory)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	err = worktree.Restore(&git.RestoreOptions{
		Staged:   true,
		Worktree: true,
		Files:    files,
	})

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	return nil
}

func Fetch(directory string, username *string, password *string) []byte {
	repo, err := getRepo(directory)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	auth := (*http.BasicAuth)(nil)
	if username != nil && password != nil {
		auth = &http.BasicAuth{
			Username: *username,
			Password: *password,
		}
	}

	err = repo.Fetch(&git.FetchOptions{
		Auth: auth,
	})

	if err != nil && err.Error() != "already up-to-date" {
		return serialize.SerializeString(errorFmt(err))
	}

	return nil
}

func Commit(directory string, commitMessage string, authorName string, authorEmail string) []byte {
	worktree, err := getWorktree(directory)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	_, err = worktree.Commit(commitMessage, &git.CommitOptions{
		All: true,
		Author: &object.Signature{
			Name:  authorName,
			Email: authorEmail,
			When:  time.Now(),
		},
	})

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	return nil
}

func getRemoteBranches(directory string, username *string, password *string) ([]plumbing.Reference, error) {
	repo, err := getRepo(directory)

	if err != nil {
		return nil, err
	}

	remote, err := repo.Remote("origin")

	if err != nil {
		return nil, err
	}

	auth := (*http.BasicAuth)(nil)
	if username != nil && password != nil {
		auth = &http.BasicAuth{
			Username: *username,
			Password: *password,
		}
	}

	remoteRefs, err := remote.List(&git.ListOptions{
		Auth: auth,
	})

	if err != nil {
		return nil, err
	}

	remoteBranches := []plumbing.Reference{}
	for _, r := range remoteRefs {
		if r.Name().IsBranch() {
			remoteBranches = append(remoteBranches, *r)
		}
	}

	return remoteBranches, nil
}

type Branch struct {
	Name   string
	Local  bool
	Remote bool
}

func Branches(directory string, username *string, password *string) []byte {
	repo, err := getRepo(directory)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	remoteBranches, err := getRemoteBranches(directory, username, password)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	branches := []Branch{}

	for _, r := range remoteBranches {
		branches = append(branches, Branch{
			Name:   r.Name().Short(),
			Remote: true,
			Local:  false,
		})
	}

	localRefs, err := repo.Branches()
	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	localRefs.ForEach(func(r *plumbing.Reference) error {
		for i := range branches {
			if branches[i].Name == r.Name().Short() {
				branches[i].Local = true
				return nil
			}
		}

		branches = append(branches, Branch{
			Name:   r.Name().Short(),
			Remote: false,
			Local:  true,
		})
		return nil
	})

	branchesSerialized := []byte{}

	for _, b := range branches {
		branchesSerialized = append(branchesSerialized, serialize.SerializeString(b.Name)...)
		branchesSerialized = append(branchesSerialized, serialize.SerializeBoolean(b.Remote)...)
		branchesSerialized = append(branchesSerialized, serialize.SerializeBoolean(b.Local)...)
	}

	return branchesSerialized
}

func Checkout(
	directory string,
	branch string,
	create bool,
	username *string,
	password *string,
) []byte {
	branchRefName := (*plumbing.ReferenceName)(nil)

	repo, err := getRepo(directory)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	localBranches, err := repo.Branches()

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	localBranches.ForEach(func(r *plumbing.Reference) error {
		if r.Name().Short() == branch {
			rName := r.Name()
			branchRefName = &rName
		}
		return nil
	})

	remoteBranches, err := getRemoteBranches(directory, username, password)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	refOnRemote := false
	for _, r := range remoteBranches {
		if r.Name().IsBranch() && r.Name().Short() == branch {
			rName := r.Name()
			branchRefName = &rName
			refOnRemote = true
			break
		}
	}

	if refOnRemote {
		auth := (*http.BasicAuth)(nil)
		if username != nil && password != nil {
			auth = &http.BasicAuth{
				Username: *username,
				Password: *password,
			}
		}

		remote, err := repo.Remote("origin")

		if err != nil {
			return serialize.SerializeString(errorFmt(err))
		}

		err = remote.Fetch(&git.FetchOptions{
			Auth:     auth,
			RefSpecs: []gitConfig.RefSpec{gitConfig.RefSpec(branchRefName.String() + ":" + branchRefName.String())},
		})

		if err != nil && err.Error() != "already up-to-date" {
			return serialize.SerializeString(errorFmt(err))
		}
	}

	worktree, err := getWorktree(directory)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	if branchRefName == nil {
		rName := plumbing.NewBranchReferenceName(branch)
		branchRefName = &rName
	}

	err = worktree.Checkout(&git.CheckoutOptions{
		Branch: *branchRefName,
		Create: create,
	})

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	return nil
}

func BranchDelete(directory string, branch string) []byte {
	repo, err := getRepo(directory)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	err = repo.Storer.RemoveReference(plumbing.NewBranchReferenceName(branch))

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	return nil
}
