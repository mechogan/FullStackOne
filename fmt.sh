npx prettier . --write

cd core 
gofmt -l -w .
cd .. 

find platform/linux/src -iname '*.h' -o -iname '*.cpp' | xargs clang-format -i --verbose 
find platform/node/gyp -iname '*.h' -o -iname '*.cc' | xargs clang-format -i --verbose