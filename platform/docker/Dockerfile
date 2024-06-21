FROM node:20-alpine

RUN apk add --no-cache tini \
    udev \
    ttf-freefont \
    chromium

COPY ./package /fullstacked

RUN chown node:node -R /fullstacked

USER node

ENV WSS_PORT=14000

RUN cd /fullstacked && \
    npm init -y && \
    npm i esbuild@0.21.5 ./puppeteer-stream.tgz

CMD ["/sbin/tini", "--", "node", "/fullstacked/index.mjs"]