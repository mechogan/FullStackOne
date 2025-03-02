package git

import (
	"encoding/json"
	"fmt"
	"net/url"
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

	"fullstacked/editor/src/config"
	"fullstacked/editor/src/fs"
	serialize "fullstacked/editor/src/serialize"
	setup "fullstacked/editor/src/setup"
	"fullstacked/editor/src/utils"
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

func getRepo(directory string, wg *sync.WaitGroup) (*git.Repository, error) {
	repo := (*git.Repository)(nil)
	err := (error)(nil)

	dotDir := path.Join(directory, ".git")
	gitFs := (billy.Filesystem)(nil)
	if fs.WASM {
		gitStorage := newStorage(dotDir, wg)
		gitFs = NewBillyFS(gitStorage, []string{})
	} else {
		gitFs = osfs.New(dotDir)
	}

	repoStorage := newStorage(directory, wg)
	repoFs := NewBillyFS(repoStorage, ignoredDirectories)

	repo, err = git.Open(filesystem.NewStorage(gitFs, cache.NewObjectLRUDefault()), repoFs)

	if err != nil {
		return nil, err
	}

	return repo, nil
}

func getWorktree(repo *git.Repository) (*git.Worktree, error) {
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

// ref: editor/types/index.ts
type GitAuth struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type GitAuthConfig = map[string]GitAuth

func checkForGitAuth(urlStr string) *http.BasicAuth {
	gitUrl, err := url.Parse(urlStr)
	if err != nil {
		fmt.Println(err)
		return nil
	}

	gitConfig := GitAuthConfig{}
	gitConfigData, _ := config.Get("git")
	err = json.Unmarshal(gitConfigData, &gitConfig)

	if err != nil {
		fmt.Println(err)
		return nil
	}

	gitAuth, ok := gitConfig[gitUrl.Host]

	if !ok {
		return nil
	}

	return &http.BasicAuth{
		Username: gitAuth.Username,
		Password: gitAuth.Password,
	}
}

type GitAuthRequest struct {
	Id        string          `json:"id"`
	Host      string          `json:"host"`
	Canceled  bool            `json:"-"`
	WaitGroup *sync.WaitGroup `json:"-"`
}

var activeGitAuthRequests = map[string]GitAuthRequest{}

// returns success
func requestGitAuthentication(urlStr string) bool {
	gitUrl, err := url.Parse(urlStr)
	if err != nil {
		fmt.Println(err)
		return false
	}

	wg := sync.WaitGroup{}

	authRequest := GitAuthRequest{
		Id:        utils.RandString(10),
		Host:      gitUrl.Host,
		WaitGroup: &wg,
	}

	activeGitAuthRequests[authRequest.Id] = authRequest

	wg.Add(1)

	jsonData, _ := json.Marshal(authRequest)
	jsonStr := string(jsonData)
	setup.Callback("", "git-authentication", jsonStr)

	wg.Wait()
	defer delete(activeGitAuthRequests, authRequest.Id)

	return !authRequest.Canceled
}

func AuthResponse(id string, canceled bool) {
	authRequest, ok := activeGitAuthRequests[id]

	if !ok {
		return
	}

	authRequest.Canceled = canceled
	activeGitAuthRequests[authRequest.Id] = authRequest
	authRequest.WaitGroup.Done()
}

func Clone(into string, url string) {
	progress := GitProgress{
		Name: "git-clone",
		Url:  url,
	}

	wg := sync.WaitGroup{}

	dotDir := path.Join(into, ".git")
	gitFs := (billy.Filesystem)(nil)
	if fs.WASM {
		gitStorage := newStorage(dotDir, &wg)
		gitFs = NewBillyFS(gitStorage, []string{})
	} else {
		gitFs = osfs.New(dotDir)
	}

	repoStorage := newStorage(into, &wg)
	repoFs := NewBillyFS(repoStorage, ignoredDirectories)

	_, err := git.Clone(filesystem.NewStorage(gitFs, cache.NewObjectLRUDefault()), repoFs, &git.CloneOptions{
		Auth:     checkForGitAuth(url),
		URL:      url,
		Progress: &progress,
	})

	if err != nil && strings.HasPrefix(err.Error(), "authentication required") {
		if requestGitAuthentication(url) {
			fs.Rmdir(into, fileEventOrigin)
			_, err = git.Clone(filesystem.NewStorage(gitFs, cache.NewObjectLRUDefault()), repoFs, &git.CloneOptions{
				Auth:     checkForGitAuth(url),
				URL:      url,
				Progress: &progress,
			})
		}
	}

	if err != nil {
		progress.Error(err.Error())
		fs.Rmdir(into, fileEventOrigin)
		return
	}

	wg.Wait()

	progress.Write([]byte("done"))
}

func Head(directory string) []byte {
	wg := sync.WaitGroup{}

	repo, err := getRepo(directory, &wg)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	head, err := repo.Head()

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	wg.Wait()

	data := []byte{}
	data = append(data, serialize.SerializeString(head.Name().Short())...)
	data = append(data, serialize.SerializeString(head.Hash().String())...)

	return data
}

func Status(directory string) []byte {
	wg := sync.WaitGroup{}

	repo, err := getRepo(directory, &wg)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	worktree, err := getWorktree(repo)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	err = worktree.AddGlob(".")
	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	wg.Wait()

	// preload memory FS
	worktree.Status()

	wg.Wait()

	status, err := worktree.Status()
	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	data := []byte{}

	// added: 0, deleted: 1, modified: 2,
	for file, fileStatus := range status {
		data = append(data, serialize.SerializeString(file)...)
		if fileStatus.Staging == git.Added || fileStatus.Staging == git.Copied {
			// added
			data = append(data, serialize.SerializeNumber(0)...)
		} else if fileStatus.Staging == git.Deleted {
			// deleted
			data = append(data, serialize.SerializeNumber(1)...)
		} else {
			// modified
			data = append(data, serialize.SerializeNumber(2)...)
		}
	}

	return data
}

func Pull(directory string) {
	wg := sync.WaitGroup{}

	progress := GitProgress{
		Name: "git-pull",
	}

	repo, err := getRepo(directory, &wg)

	if err != nil {
		progress.Error(err.Error())
		return
	}

	worktree, err := getWorktree(repo)

	if err != nil {
		progress.Error(err.Error())
		return
	}

	remote, err := repo.Remote("origin")

	if err != nil {
		progress.Error(err.Error())
		return
	}

	wg.Wait()

	progress.Url = remote.Config().URLs[0]

	progress.Write([]byte("start"))

	err = worktree.AddGlob(".")
	if err != nil {
		progress.Error(err.Error())
		return
	}

	wg.Wait()

	head, err := repo.Head()

	if err != nil {
		progress.Error(err.Error())
		return
	}

	wg.Wait()

	err = worktree.Pull(&git.PullOptions{
		Auth:          checkForGitAuth(progress.Url),
		ReferenceName: head.Name(),
		Progress:      &progress,
	})

	if err != nil && strings.HasPrefix(err.Error(), "authentication required") {
		if requestGitAuthentication(progress.Url) {
			err = worktree.Pull(&git.PullOptions{
				Auth:          checkForGitAuth(progress.Url),
				ReferenceName: head.Name(),
				Progress:      &progress,
			});
		}
	}

	if err != nil && err.Error() != "already up-to-date" && err.Error() != "reference not found" {
		progress.Error(err.Error())
		return
	}

	wg.Wait()

	progress.Write([]byte("done"))
}

func Push(directory string) {
	wg := sync.WaitGroup{}

	progress := GitProgress{
		Name: "git-push",
	}

	repo, err := getRepo(directory, &wg)

	if err != nil {
		progress.Error(err.Error())
		return
	}

	remote, err := repo.Remote("origin")

	if err != nil {
		progress.Error(err.Error())
		return
	}

	wg.Wait()

	progress.Url = remote.Config().URLs[0]

	progress.Write([]byte("start"))

	err = repo.Push(&git.PushOptions{
		Auth: checkForGitAuth(progress.Url),
		Progress: &GitProgress{
			Name: "git-push",
		},
	})

	if(err != nil && strings.HasPrefix(err.Error(), "authentication required")) {
		if requestGitAuthentication(progress.Url) {
			err = repo.Push(&git.PushOptions{
				Auth: checkForGitAuth(progress.Url),
				Progress: &GitProgress{
					Name: "git-push",
				},
			})
		}
	}

	if err != nil {
		progress.Error(err.Error())
		return
	}

	wg.Wait()

	progress.Write([]byte("done"))
}

func Restore(directory string, files []string) []byte {
	wg := sync.WaitGroup{}

	repo, err := getRepo(directory, &wg)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	worktree, err := getWorktree(repo)

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

	wg.Wait()

	return nil
}

func Fetch(directory string) []byte {
	wg := sync.WaitGroup{}

	repo, err := getRepo(directory, &wg)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	remote, _ := repo.Remote("origin")

	err = repo.Fetch(&git.FetchOptions{
		Auth: checkForGitAuth(remote.Config().URLs[0]),
	})

	if(err != nil && strings.HasPrefix(err.Error(), "authentication required")) {
		if requestGitAuthentication(remote.Config().URLs[0]) {
			err = repo.Fetch(&git.FetchOptions{
				Auth: checkForGitAuth(remote.Config().URLs[0]),
			})
		}
	}

	if err != nil && err.Error() != "already up-to-date" {
		return serialize.SerializeString(errorFmt(err))
	}

	wg.Wait()

	return nil
}

func Commit(directory string, commitMessage string, authorName string, authorEmail string) []byte {
	wg := sync.WaitGroup{}

	repo, err := getRepo(directory, &wg)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	worktree, err := getWorktree(repo)

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

	wg.Wait()

	return nil
}

func getRemoteBranches(directory string) ([]plumbing.Reference, error) {
	wg := sync.WaitGroup{}

	repo, err := getRepo(directory, &wg)

	if err != nil {
		return nil, err
	}

	remote, err := repo.Remote("origin")

	if err != nil {
		return nil, err
	}

	remoteRefs, err := remote.List(&git.ListOptions{
		Auth: checkForGitAuth(remote.Config().URLs[0]),
	})

	if(err != nil && strings.HasPrefix(err.Error(), "authentication required")) {
		if requestGitAuthentication(remote.Config().URLs[0]) {
			remoteRefs, err = remote.List(&git.ListOptions{
				Auth: checkForGitAuth(remote.Config().URLs[0]),
			})
		}
	}

	if err != nil {
		return nil, err
	}

	remoteBranches := []plumbing.Reference{}
	for _, r := range remoteRefs {
		if r.Name().IsBranch() {
			remoteBranches = append(remoteBranches, *r)
		}
	}

	wg.Wait()

	return remoteBranches, nil
}

type Branch struct {
	Name   string
	Local  bool
	Remote bool
}

func Branches(directory string) []byte {
	remoteBranches, err := getRemoteBranches(directory)

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

	wg := sync.WaitGroup{}

	repo, err := getRepo(directory, &wg)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	localRefs, err := repo.Branches()
	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	wg.Wait()

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
) []byte {
	wg := sync.WaitGroup{}
	branchRefName := (*plumbing.ReferenceName)(nil)

	repo, err := getRepo(directory, &wg)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	localBranches, err := repo.Branches()

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}
	wg.Wait()

	localBranches.ForEach(func(r *plumbing.Reference) error {
		if r.Name().Short() == branch {
			rName := r.Name()
			branchRefName = &rName
		}
		return nil
	})

	remoteBranches, err := getRemoteBranches(directory)

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
		remote, err := repo.Remote("origin")

		if err != nil {
			return serialize.SerializeString(errorFmt(err))
		}

		refSpec := []gitConfig.RefSpec{gitConfig.RefSpec(branchRefName.String() + ":" + branchRefName.String())}

		err = remote.Fetch(&git.FetchOptions{
			Auth:     checkForGitAuth(remote.Config().URLs[0]),
			RefSpecs: refSpec,
		})

		if(err != nil && strings.HasPrefix(err.Error(), "authentication required")) {
			if requestGitAuthentication(remote.Config().URLs[0]) {
				err = remote.Fetch(&git.FetchOptions{
					Auth:     checkForGitAuth(remote.Config().URLs[0]),
					RefSpecs: refSpec,
				})
			}
		}

		if err != nil && err.Error() != "already up-to-date" {
			return serialize.SerializeString(errorFmt(err))
		}

		wg.Wait()
	}

	worktree, err := getWorktree(repo)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	if branchRefName == nil {
		rName := plumbing.NewBranchReferenceName(branch)
		branchRefName = &rName
	}

	wg.Wait()

	// preloads worktree into billy fs layer
	worktree.Status()
	wg.Wait()

	err = worktree.Checkout(&git.CheckoutOptions{
		Branch: *branchRefName,
		Create: create,
	})

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	wg.Wait()

	return nil
}

func BranchDelete(directory string, branch string) []byte {
	wg := sync.WaitGroup{}

	repo, err := getRepo(directory, &wg)

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	err = repo.Storer.RemoveReference(plumbing.NewBranchReferenceName(branch))

	if err != nil {
		return serialize.SerializeString(errorFmt(err))
	}

	wg.Wait()

	return nil
}
