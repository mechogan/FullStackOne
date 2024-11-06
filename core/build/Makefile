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

android-arm64:
	CGO_ENABLED=1 \
	GOOS=android \
	GOARCH=arm64 \
	CGO_LDFLAGS="-Wl,-soname,android-arm64.so" \
	CC=~/Library/Android/sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/darwin-x86_64/bin/aarch64-linux-android34-clang \
	go build -buildmode=c-shared -o $(OUT)/android-arm64.so -v ..

###### Windows #######

win-x86_64:
	CGO_ENABLED=1 \
	GOOS=windows \
	GOARCH=amd64 \
	CC=x86_64-w64-mingw32-gcc \
	go build -buildmode=c-shared -o $(OUT)/win-x86_64.dll -v ..

###### Linux #######