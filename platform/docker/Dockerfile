FROM node:20-alpine

RUN apk add --no-cache tini && \
    npm i -g esbuild@0.21.5

COPY ./package /fullstacked

RUN cd /fullstacked && npm link esbuild

USER node

CMD ["/sbin/tini", "--", "node", "/fullstacked/index.mjs"]