# go/Makefile
# https://rogchap.com/2020/09/14/running-go-code-on-ios-and-android/

ESBUILD_DIR = $(CURDIR)/../../../lib/esbuild
GO_EXEC = $(CURDIR)/../../../lib/go/bin/go
IOS_OUT = $(CURDIR)/out

ios-arm64:
	cd $(ESBUILD_DIR) && git clean -f && \
	cp $(CURDIR)/cmd/* $(ESBUILD_DIR)/cmd/esbuild && \
	CGO_ENABLED=1 \
	GOOS=ios \
	GOARCH=arm64 \
	SDK=iphoneos \
	CC=$(CURDIR)/clangwrap.sh \
	CGO_CFLAGS="-fembed-bitcode" \
	$(GO_EXEC) build -buildmode=c-archive -tags ios -o $(IOS_OUT)/ios-arm64.a ./cmd/esbuild && \
	cd $(ESBUILD_DIR) && git clean -f

ios-x86_64:
	cd $(ESBUILD_DIR) && git clean -f && \
	cp $(CURDIR)/cmd/* $(ESBUILD_DIR)/cmd/esbuild && \
	CGO_ENABLED=1 \
	GOOS=ios \
	GOARCH=amd64 \
	SDK=iphonesimulator \
	CC=$(CURDIR)/clangwrap.sh \
	$(GO_EXEC) build -buildmode=c-archive -tags ios -o $(IOS_OUT)/ios-x86_64.a ./cmd/esbuild && \
	cd $(ESBUILD_DIR) && git clean -f

ios: ios-arm64 ios-x86_64
	lipo $(IOS_OUT)/ios-x86_64.a $(IOS_OUT)/ios-arm64.a -create -output $(IOS_OUT)/esbuild-ios.a
	cp $(IOS_OUT)/ios-arm64.h $(IOS_OUT)/esbuild-ios.h
	rm $(IOS_OUT)/ios-x86_64.a $(IOS_OUT)/ios-x86_64.h $(IOS_OUT)/ios-arm64.a $(IOS_OUT)/ios-arm64.h


macos-arm64:
	cd $(ESBUILD_DIR) && git clean -f && \
	cp $(CURDIR)/cmd/* $(ESBUILD_DIR)/cmd/esbuild && \
	CGO_ENABLED=1 \
	GOOS=darwin \
	GOARCH=arm64 \
	SDK=macosx \
	CC=$(CURDIR)/clangwrap.sh \
	CGO_CFLAGS="-fembed-bitcode -target x86_64-apple-ios-macabi" \
	$(GO_EXEC) build -buildmode=c-archive -tags maccatalyst -o $(IOS_OUT)/macos-arm64.a ./cmd/esbuild && \
	cd $(ESBUILD_DIR) && git clean -f

macos-x86_64:
	cd $(ESBUILD_DIR) && git clean -f && \
	cp $(CURDIR)/cmd/* $(ESBUILD_DIR)/cmd/esbuild && \
	CGO_ENABLED=1 \
	GOOS=darwin \
	GOARCH=amd64 \
	SDK=macosx \
	CC=$(CURDIR)/clangwrap.sh \
	CGO_CFLAGS="-target x86_64-apple-ios-macabi" \
	$(GO_EXEC) build -buildmode=c-archive -tags maccatalyst -o $(IOS_OUT)/macos-x86_64.a ./cmd/esbuild && \
	cd $(ESBUILD_DIR) && git clean -f

macos: macos-arm64 macos-x86_64
	lipo $(IOS_OUT)/macos-x86_64.a $(IOS_OUT)/macos-arm64.a -create -output $(IOS_OUT)/esbuild-macos.a
	cp $(IOS_OUT)/macos-arm64.h $(IOS_OUT)/esbuild-macos.h
	rm $(IOS_OUT)/macos-x86_64.a $(IOS_OUT)/macos-x86_64.h $(IOS_OUT)/macos-arm64.a $(IOS_OUT)/macos-arm64.h

all: ios macos