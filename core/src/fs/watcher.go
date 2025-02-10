package fs

import (
	"encoding/json"
	"fullstacked/editor/src/setup"
	"sync"
	"time"
)

type FileEventType int

const (
	UKNOWN FileEventType = 0
	CREATED FileEventType = 1
	MODIFIED FileEventType = 2
	RENAME FileEventType = 3
	DELETED FileEventType = 4
)

type FileEvent struct {
	Type FileEventType
	Paths []string
	IsFile bool
	Origin string
}

var eventsBuf = []FileEvent{}
var debounce = NewDebouncer(time.Millisecond * 100) // 100ms

var sendEvents = func() func() {
    return func() {
		jsonData, _ := json.Marshal(eventsBuf)
        setup.Callback("", "file-event", string(jsonData))
		eventsBuf = []FileEvent{}
    }
}

func watchEvent(event FileEvent){
	eventsBuf = append(eventsBuf, event)
	debounce(sendEvents())
}



// source: https://stackoverflow.com/a/77944299
func NewDebouncer(dur time.Duration) func(fn func()) {
    d := &debouncer{
        dur: dur,
    }

    return func(fn func()) {
        d.reset(fn)
    }
}

type debouncer struct {
    mu    sync.Mutex
    dur   time.Duration
    delay *time.Timer
}

func (d *debouncer) reset(fn func()) {
    d.mu.Lock()
    defer d.mu.Unlock()

    if d.delay != nil {
        d.delay.Stop()
    }

    d.delay = time.AfterFunc(d.dur, fn)
}