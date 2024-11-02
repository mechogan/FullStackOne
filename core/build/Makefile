OUT = $(CURDIR)/../bin

###### MacOS #######

macos-x86_64:
	CGO_ENABLED=1 \
	GOOS=darwin \
	GOARCH=amd64 \
	SDK=macosx \
	CC=$(CURDIR)/apple/clangwrap.sh \
	CGO_CFLAGS="-target x86_64-apple-darwin" \
	go build -buildmode=c-shared -o $(OUT)/macos-x86_64 ..

###### iOS/iPadOS #######

###### Android #######

###### Windows #######

###### Linux #######