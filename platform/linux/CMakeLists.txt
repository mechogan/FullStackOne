# cmake -DARCH=[ arm64 | x64 ] .
# make

cmake_minimum_required(VERSION 3.22.1)
project(fullstacked)

execute_process(
    COMMAND bash prebuild.sh ${ARCH}
    WORKING_DIRECTORY ${PROJECT_SOURCE_DIR}
)

set(CMAKE_CXX_STANDARD 20)

find_package(Qt6 COMPONENTS Core Widgets WebEngineWidgets WebEngineCore)

qt_add_executable(${PROJECT_NAME} main.cpp app.cpp instance.cpp utils.cpp base64.cpp qt/qt.cpp)
set_target_properties(${PROJECT_NAME} PROPERTIES AUTOMOC ON)
target_link_libraries(${PROJECT_NAME} PUBLIC 
    Qt6::Core Qt6::Widgets 
    Qt6::WebEngineWidgets
    Qt6::WebEngineCore 
    ${CMAKE_SOURCE_DIR}/bin/linux-${ARCH}.a)

set(EXECUTABLE_OUTPUT_PATH ${CMAKE_SOURCE_DIR}/out/usr/bin)