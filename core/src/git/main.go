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

func errorFmt(e string) string {
	gitError := GitError{
		Error: e,
	}
	jsonData, _ := json.Marshal(gitError)
	jsonStr := string(jsonData)
	return jsonStr
}

type CloneProgress struct {
	Url string
	Progress string
}
func (cloneProgess *CloneProgress) Write(p []byte) (int, error) {
	n := len(p)
	setup.Callback("", "git-clone", string(p))
	return n, nil
}

func Clone(url string, into string, username *string, password *string) []byte {
	auth := (*http.BasicAuth)(nil)
	if(username != nil && password != nil) {
		auth = &http.BasicAuth{
			Username: *username,
			Password: *password,
		}
	}

	progess := CloneProgress{
		Url: url,
	}
	_, err := git.PlainClone(into, false, &git.CloneOptions{
		Auth: auth,
		URL: url,
		Progress: &progess,
		SingleBranch: true,

	});

	if(err != nil) {
		return serialize.SerializeString(errorFmt(err.Error()))
	}

	return nil
}

type HeadObj struct {
	Name string
	Hash string
}

func Head(directory string) []byte {
	repo, err := git.PlainOpen(directory)

	if(err != nil) {
		return serialize.SerializeString(errorFmt(err.Error()))
	}

	head, err := repo.Head()

	if(err != nil) {
		return serialize.SerializeString(errorFmt(err.Error()))
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
	repo, err := git.PlainOpen(directory)
	if(err != nil) {
		return serialize.SerializeString(errorFmt(err.Error()))
	}

	worktree, err := repo.Worktree()
	if(err != nil) {
		return serialize.SerializeString(errorFmt(err.Error()))
	}

	worktree.Excludes = append(worktree.Excludes, 
		gitignore.ParsePattern("/.build", []string{}),
		gitignore.ParsePattern("/data", []string{}))
	
	err = worktree.AddGlob(".")
	if(err != nil) {
		return serialize.SerializeString(errorFmt(err.Error()))
	}

	status, err := worktree.Status()
	if(err != nil) {
		return serialize.SerializeString(errorFmt(err.Error()))
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