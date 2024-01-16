# go/Makefile
# https://rogchap.com/2020/09/14/running-go-code-on-ios-and-android/

ESBUILD_DIR = $(CURDIR)/../../../lib/esbuild
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
	go build -buildmode=c-archive -tags ios -o $(IOS_OUT)/arm64.a ./cmd/esbuild && \
	cd $(ESBUILD_DIR) && git clean -f

ios-x86_64:
	cd $(ESBUILD_DIR) && git clean -f && \
	cp $(CURDIR)/cmd/* $(ESBUILD_DIR)/cmd/esbuild && \
	CGO_ENABLED=1 \
	GOOS=ios \
	GOARCH=amd64 \
	SDK=iphonesimulator \
	CC=$(CURDIR)/clangwrap.sh \
	go build -buildmode=c-archive -tags ios -o $(IOS_OUT)/x86_64.a ./cmd/esbuild && \
	cd $(ESBUILD_DIR) && git clean -f

ios: ios-arm64 ios-x86_64
	lipo $(IOS_OUT)/x86_64.a $(IOS_OUT)/arm64.a -create -output $(IOS_OUT)/esbuild.a
	cp $(IOS_OUT)/arm64.h $(IOS_OUT)/esbuild.h