package utils

import (
	"math/rand"
	"sync"
	"time"
)

var letterRunes = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

func RandString(n int) string {
	b := make([]rune, n)
	for i := range b {
		b[i] = letterRunes[rand.Intn(len(letterRunes))]
	}
	return string(b)
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
