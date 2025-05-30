cmake_minimum_required(VERSION 3.22.1)
project(fullstacked)

set(CMAKE_CXX_STANDARD 20)

find_package(Qt6 COMPONENTS Core Widgets WebEngineWidgets)

qt_add_executable(${PROJECT_NAME} main.cpp app.cpp instance.cpp utils.cpp base64.cpp qt/qt.cpp)

target_link_libraries(${PROJECT_NAME} PUBLIC Qt6::Core Qt6::Widgets Qt6::WebEngineWidgets ${CMAKE_SOURCE_DIR}/bin/linux-x86_64)
