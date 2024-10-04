FROM node:20-alpine

RUN apk add --no-cache tini \
    udev \
    ttf-freefont \
    chromium

COPY ./package /fullstacked

RUN chown node:node -R /fullstacked

USER node

RUN cd /fullstacked && \
    npm init -y && \
    npm i esbuild@0.24.0 ./puppeteer-stream.tgz

CMD ["/sbin/tini", "--", "node", "/fullstacked/index.mjs"]
