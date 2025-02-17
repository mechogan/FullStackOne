package fs

import (
	"encoding/json"
	"fullstacked/editor/src/setup"
	"fullstacked/editor/src/utils"
	"path/filepath"
	"time"
)

type FileEventType int

const (
	UNKNOWN  FileEventType = 0
	CREATED  FileEventType = 1
	MODIFIED FileEventType = 2
	RENAME   FileEventType = 3
	DELETED  FileEventType = 4
)

type FileEvent struct {
	Type   FileEventType `json:"type"`
	Paths  []string      `json:"paths"`
	IsFile bool          `json:"isFile"`
	Origin string        `json:"origin"`
}

var eventsBuf = []FileEvent{}
var debounce = utils.NewDebouncer(time.Millisecond * 100) // 100ms

var sendEvents = func() func() {
	return func() {
		jsonData, _ := json.Marshal(eventsBuf)
		setup.Callback("", "file-event", string(jsonData))
		eventsBuf = []FileEvent{}
	}
}

func watchEvent(event FileEvent) {
	for i, p := range event.Paths {
		event.Paths[i] = filepath.ToSlash(p)
	}
	eventsBuf = append(eventsBuf, event)
	debounce(sendEvents())
}
