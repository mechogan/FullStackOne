rm -rf ./package && mkdir ./package

cd ../node && npm pack --pack-destination ../docker/package && cd ../docker

docker build -t fullstackedorg/editor .