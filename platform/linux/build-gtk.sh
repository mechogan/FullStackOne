# ./build-gtk.sh [ arm64 | x64 ]
sh ./prebuild.sh $1

gcc src/utils.cpp \
    src/gtk/gtk.cpp \
    src/instance.cpp \
    src/app.cpp \
    src/main.cpp \
    src/base64.cpp \
    bin/linux-$1.a -DGTK=1 -o out/usr/bin/fullstacked `pkg-config gtkmm-4.0 webkitgtk-6.0 --libs --cflags` -lstdc++