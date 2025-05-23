# ./build.sh [arm64|x86_64]
cp -f bin/linux-$1.h bin/linux.h

rm -rf out

mkdir -p ./out/usr/share/fullstacked
cp -r ../../out/editor ./out/usr/share/fullstacked

mkdir ./out/DEBIAN
cp control out/DEBIAN/control

mkdir -p out/usr/bin
cp -r ../../core/bin .
gcc utils.cpp instance.cpp app.cpp main.cpp bin/linux-$1 -o out/usr/bin/fullstacked `pkg-config gtkmm-4.0 webkitgtk-6.0 --libs --cflags` -lstdc++