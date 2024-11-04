package staticFiles

import (
	"os"
)

func StaticFiles() ([]byte) {
	data, _ := os.ReadFile("")
	return data
}