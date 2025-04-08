rm -rf out
mkdir out
cp -r ../../core/bin .
cp -r ../../out/editor ./out
g++ main.cpp bin/linux-x86_64 -g -o out/fullstacked `pkg-config gtkmm-4.0 webkitgtk-6.0 --libs --cflags`