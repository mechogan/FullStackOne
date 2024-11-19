package git

import (
	serialize "fullstacked/editor/src/serialize"
	setup "fullstacked/editor/src/setup"
	git "github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
)

type CloneProgress struct {
	Url string
	Progress string
}
func (cloneProgess *CloneProgress) Write(p []byte) (int, error) {
	n := len(p)
	setup.Callback("", "git-clone", string(p))
	return n, nil
}

func Clone(url string, username *string, password *string) []byte {
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
	_, err := git.PlainClone(setup.Directories.Tmp, false, &git.CloneOptions{
		Auth: auth,
		URL: url,
		Progress: &progess,
		SingleBranch: true,
	});

	if(err != nil) {
		return serialize.SerializeString(err.Error())
	}

	return nil
}