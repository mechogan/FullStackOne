rm -rf out
mkdir -p out/usr/bin
cp -r ../../out/editor ./out/usr/bin
mkdir ./out/DEBIAN
cp control out/DEBIAN/control

cp -r ../../core/bin .
g++ utils.cpp instance.cpp app.cpp main.cpp bin/linux-x86_64 -o out/usr/bin/fullstacked `pkg-config gtkmm-4.0 webkitgtk-6.0 --libs --cflags`