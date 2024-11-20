package git

import (
	"encoding/json"
	serialize "fullstacked/editor/src/serialize"
	setup "fullstacked/editor/src/setup"

	git "github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/format/gitignore"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
)

type GitError struct {
	Error string
}

func errorFmt(e error) *[]byte {
	gitError := GitError{
		Error: e.Error(),
	}
	jsonData, _ := json.Marshal(gitError)
	jsonStr := string(jsonData)
	jsonSerialized := serialize.SerializeString(jsonStr)
	return &jsonSerialized
}

func getRepo(directory string) (*git.Repository, *[]byte) {
	repo, err := git.PlainOpen(directory)

	if(err != nil) {
		return nil, errorFmt(err)
	}

	return repo, nil
}

func getWorktree(directory string) (*git.Worktree, *[]byte) {
	repo, err := getRepo(directory)

	if(err != nil){
		return nil, err
	}

	worktree, err2 := repo.Worktree()

	if(err2 != nil) {
		return nil, errorFmt(err2)
	}

	// always ignore FullStacked artifacts
	worktree.Excludes = append(worktree.Excludes, 
		gitignore.ParsePattern("/.build", []string{}),
		gitignore.ParsePattern("/data", []string{}))

	return worktree, nil
}

type GitProgress struct {
	Name string
	Progress string
}
func (gitProgress *GitProgress) Write(p []byte) (int, error) {
	n := len(p)
	setup.Callback("", gitProgress.Name, string(p))
	return n, nil
}

func Clone(into string, url string, username *string, password *string) []byte {
	auth := (*http.BasicAuth)(nil)
	if(username != nil && password != nil) {
		auth = &http.BasicAuth{
			Username: *username,
			Password: *password,
		}
	}

	_, err := git.PlainClone(into, false, &git.CloneOptions{
		Auth: auth,
		URL: url,
		Progress: &GitProgress{
			Name: "git-clone",
		},
		SingleBranch: true,

	});

	if(err != nil) {
		return *errorFmt(err)
	}

	return nil
}

type HeadObj struct {
	Name string
	Hash string
}

func Head(directory string) []byte {
	repo, err := getRepo(directory)

	if(err != nil) {
		return *err
	}

	head, err2 := repo.Head()

	if(err2 != nil) {
		return *errorFmt(err2)
	}

	headObj := HeadObj{
		Name: head.Name().String(),
		Hash: head.Hash().String(),
	}

	jsonData, _ := json.Marshal(headObj)
	jsonStr := string(jsonData)
	return serialize.SerializeString(jsonStr)
}

type GitStatus struct {
	Added []string
	Modified []string
	Deleted []string
}

func Status(directory string) []byte {
	worktree, err := getWorktree(directory)

	if(err != nil) {
		return *err
	}
	
	err2 := worktree.AddGlob(".")
	if(err2 != nil) {
		return *errorFmt(err2)
	}

	status, err2 := worktree.Status()
	if(err2 != nil) {
		return *errorFmt(err2)
	}

	gitStatus := GitStatus{
		Added: []string{},
		Modified: []string{},
		Deleted: []string{},
	}

	for file, fileStatus := range(status) {
		if(fileStatus.Staging == git.Added) {
			gitStatus.Added = append(gitStatus.Added, file)
		} else if (fileStatus.Staging == git.Deleted) {
			gitStatus.Deleted = append(gitStatus.Deleted, file)
		} else {
			gitStatus.Modified = append(gitStatus.Modified, file)
		}
	}

	jsonData, _ := json.Marshal(gitStatus)
	jsonStr := string(jsonData)
	return serialize.SerializeString(jsonStr)
}

func Pull(directory string, username *string, password *string) []byte {
	worktree, err := getWorktree(directory)

	if(err != nil) {
		return *err
	}

	auth := (*http.BasicAuth)(nil)
	if(username != nil && password != nil) {
		auth = &http.BasicAuth{
			Username: *username,
			Password: *password,
		}
	}

	progress := GitProgress{
		Name: "git-pull",
	}

	progress.Write([]byte("start"))

	err2 := worktree.Pull(&git.PullOptions{
		Auth: auth,
		Progress: &progress,
		SingleBranch: true,
	})

	progress.Write([]byte("done"))

	if(err2 != nil && err2.Error() != "already up-to-date") {
		return *errorFmt(err2)
	}

	return nil
}


func Push(directory string, username *string, password *string) []byte {
	repo, err := getRepo(directory)

	if(err != nil) {
		return *err
	}

	auth := (*http.BasicAuth)(nil)
	if(username != nil && password != nil) {
		auth = &http.BasicAuth{
			Username: *username,
			Password: *password,
		}
	}

	progress := GitProgress{
		Name: "git-push",
	}

	progress.Write([]byte("start"))

	err2 := repo.Push(&git.PushOptions{
		Auth: auth,
		Progress: &GitProgress{
			Name: "git-push",
		},
	})

	progress.Write([]byte("done"))

	if(err2 != nil) {
		return *errorFmt(err2)
	}

	return nil
}