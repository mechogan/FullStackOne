package git

import (
	"encoding/json"
	"path"
	"time"

	git "github.com/go-git/go-git/v5"
	gitConfig "github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/format/gitignore"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/plumbing/transport/http"

	fs "fullstacked/editor/src/fs"
	serialize "fullstacked/editor/src/serialize"
	setup "fullstacked/editor/src/setup"
)

type GitError struct {
	Error string
}

func errorFmt(e error) *string {
	gitError := GitError{
		Error: e.Error(),
	}
	jsonData, _ := json.Marshal(gitError)
	jsonStr := string(jsonData)
	return &jsonStr
}

func getRepo(directory string) (*git.Repository, *string) {
	repo, err := git.PlainOpen(directory)

	if err != nil {
		return nil, errorFmt(err)
	}

	return repo, nil
}

func getWorktree(directory string) (*git.Worktree, *string) {
	repo, err := getRepo(directory)

	if err != nil {
		return nil, err
	}

	worktree, err2 := repo.Worktree()

	if err2 != nil {
		return nil, errorFmt(err2)
	}

	// always ignore FullStacked artifacts
	worktree.Excludes = append(worktree.Excludes,
		gitignore.ParsePattern("/.build", []string{}),
		gitignore.ParsePattern("/data", []string{}))

	return worktree, nil
}

type GitProgress struct {
	Name     string
	Progress string
}

func (gitProgress *GitProgress) Write(p []byte) (int, error) {
	n := len(p)
	setup.Callback("", gitProgress.Name, string(p))
	return n, nil
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
	}

	_, err := git.PlainClone(into, false, &git.CloneOptions{
		Auth:     auth,
		URL:      url,
		Progress: &progress,
	})

	if err != nil {
		progress.Write([]byte(*errorFmt(err)))
		return
	}

	progress.Write([]byte("done"))
}

type HeadObj struct {
	Name string
	Hash string
}

func Head(directory string) []byte {
	repo, err := getRepo(directory)

	if err != nil {
		return serialize.SerializeString(*err)
	}

	head, err2 := repo.Head()

	if err2 != nil {
		return serialize.SerializeString(*errorFmt(err2))
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
		return serialize.SerializeString(*err)
	}

	err2 := worktree.AddGlob(".")
	if err2 != nil {
		return serialize.SerializeString(*errorFmt(err2))
	}

	status, err2 := worktree.Status()
	if err2 != nil {
		return serialize.SerializeString(*errorFmt(err2))
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

	progress.Write([]byte("start"))

	worktree, err := getWorktree(directory)

	if err != nil {
		progress.Write([]byte(*err))
		return
	}

	repo, err := getRepo(directory)

	if err != nil {
		progress.Write([]byte(*err))
		return
	}

	auth := (*http.BasicAuth)(nil)
	if username != nil && password != nil {
		auth = &http.BasicAuth{
			Username: *username,
			Password: *password,
		}
	}

	err2 := worktree.AddGlob(".")
	if err2 != nil {
		progress.Write([]byte(*errorFmt(err2)))
		return
	}

	head, err2 := repo.Head()

	if err2 != nil {
		progress.Write([]byte(*errorFmt(err2)))
		return
	}

	err3 := worktree.Pull(&git.PullOptions{
		Auth:          auth,
		ReferenceName: head.Name(),
		Progress:      &progress,
	})

	if err3 != nil && err3.Error() != "already up-to-date" {
		progress.Write([]byte(*errorFmt(err3)))
		return
	}

	progress.Write([]byte("done"))
}

func Push(directory string, username *string, password *string) {
	progress := GitProgress{
		Name: "git-push",
	}

	progress.Write([]byte("start"))

	repo, err := getRepo(directory)

	if err != nil {
		progress.Write([]byte(*err))
		return
	}

	auth := (*http.BasicAuth)(nil)
	if username != nil && password != nil {
		auth = &http.BasicAuth{
			Username: *username,
			Password: *password,
		}
	}

	err2 := repo.Push(&git.PushOptions{
		Auth: auth,
		Progress: &GitProgress{
			Name: "git-push",
		},
	})

	if err2 != nil {
		progress.Write([]byte(*errorFmt(err2)))
		return
	}

	progress.Write([]byte("done"))
}

func Restore(directory string, files []string) []byte {
	worktree, err := getWorktree(directory)

	if err != nil {
		return serialize.SerializeString(*err)
	}

	err2 := worktree.Restore(&git.RestoreOptions{
		Staged:   true,
		Worktree: true,
		Files:    files,
	})

	if err2 != nil {
		return serialize.SerializeString(*errorFmt(err2))
	}

	return nil
}

func Fetch(directory string, username *string, password *string) []byte {
	repo, err := getRepo(directory)

	if err != nil {
		return serialize.SerializeString(*err)
	}

	auth := (*http.BasicAuth)(nil)
	if username != nil && password != nil {
		auth = &http.BasicAuth{
			Username: *username,
			Password: *password,
		}
	}

	err2 := repo.Fetch(&git.FetchOptions{
		Auth: auth,
	})

	if err2 != nil && err2.Error() != "already up-to-date" {
		return serialize.SerializeString(*errorFmt(err2))
	}

	return nil
}

func Commit(directory string, commitMessage string, authorName string, authorEmail string) []byte {
	worktree, err := getWorktree(directory)

	if err != nil {
		return serialize.SerializeString(*err)
	}

	_, err2 := worktree.Commit(commitMessage, &git.CommitOptions{
		All: true,
		Author: &object.Signature{
			Name:  authorName,
			Email: authorEmail,
			When:  time.Now(),
		},
	})

	if err2 != nil {
		return serialize.SerializeString(*errorFmt(err2))
	}

	return nil
}

func getRemoteBranches(directory string, username *string, password *string) ([]plumbing.Reference, *string) {
	repo, err := getRepo(directory)

	if err != nil {
		return nil, err
	}

	remote, err2 := repo.Remote("origin")

	if err2 != nil {
		return nil, errorFmt(err2)
	}

	auth := (*http.BasicAuth)(nil)
	if username != nil && password != nil {
		auth = &http.BasicAuth{
			Username: *username,
			Password: *password,
		}
	}

	remoteRefs, err3 := remote.List(&git.ListOptions{
		Auth: auth,
	})

	if err3 != nil {
		return nil, errorFmt(err3)
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
		return serialize.SerializeString(*err)
	}

	remoteBranches, err := getRemoteBranches(directory, username, password)

	if err != nil {
		return serialize.SerializeString(*err)
	}

	branches := []Branch{}

	for _, r := range remoteBranches {
		branches = append(branches, Branch{
			Name:   r.Name().Short(),
			Remote: true,
			Local:  false,
		})
	}

	localRefs, err2 := repo.Branches()
	if err2 != nil {
		return serialize.SerializeString(*errorFmt(err2))
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
		return serialize.SerializeString(*err)
	}

	localBranches, err2 := repo.Branches()

	if err2 != nil {
		return serialize.SerializeString(*errorFmt(err2))
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
		return serialize.SerializeString(*err)
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

		remote, err2 := repo.Remote("origin")

		if err2 != nil {
			return serialize.SerializeString(*errorFmt(err2))
		}

		err2 = remote.Fetch(&git.FetchOptions{
			Auth:     auth,
			RefSpecs: []gitConfig.RefSpec{gitConfig.RefSpec(branchRefName.String() + ":" + branchRefName.String())},
		})

		if err2 != nil && err2.Error() != "already up-to-date" {
			return serialize.SerializeString(*errorFmt(err2))
		}
	}

	worktree, err := getWorktree(directory)

	if err != nil {
		return serialize.SerializeString(*err)
	}

	if branchRefName == nil {
		rName := plumbing.NewBranchReferenceName(branch)
		branchRefName = &rName
	}

	// checkout clears all untracked files
	// https://github.com/go-git/go-git/issues/970
	// Keep is not helping
	dataPath := path.Join(directory, "data")
	dataTmpPath := path.Join(setup.Directories.Tmp, "data")
	dataExists, dataIsFile := fs.Exists(dataPath)
	if dataExists && !dataIsFile {
		fs.Rename(dataPath, dataTmpPath)
	}

	err2 = worktree.Checkout(&git.CheckoutOptions{
		Branch: *branchRefName,
		Create: create,
	})

	if dataExists && !dataIsFile {
		fs.Rename(dataTmpPath, dataPath)
	}

	if err2 != nil {
		return serialize.SerializeString(*errorFmt(err2))
	}

	return nil
}

func BranchDelete(directory string, branch string) []byte {
	repo, err := getRepo(directory)

	if err != nil {
		return serialize.SerializeString(*err)
	}

	err2 := repo.Storer.RemoveReference(plumbing.NewBranchReferenceName(branch))

	if err2 != nil {
		return serialize.SerializeString(*errorFmt(err2))
	}

	return nil
}
