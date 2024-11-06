OUT = $(CURDIR)/../bin

###### MacOS #######

macos-x86_64:
	CGO_ENABLED=1 \
	GOOS=darwin \
	GOARCH=amd64 \
	SDK=macosx \
	CC=$(CURDIR)/apple-clang.sh \
	CGO_CFLAGS="-target x86_64-apple-darwin" \
	go build -buildmode=c-shared -o $(OUT)/macos-x86_64 -v ..

###### iOS/iPadOS #######

ios-arm64:
	CGO_ENABLED=1 \
	GOOS=ios \
	GOARCH=arm64 \
	SDK=iphoneos \
	CC=$(CURDIR)/apple-clang.sh \
	CGO_CFLAGS="-fembed-bitcode" \
	go build -buildmode=c-archive -tags ios -o $(OUT)/ios-arm64.a -v ..

###### Android #######

###### Windows #######

win-x86_64:
	windows.bat

###### Linux #######