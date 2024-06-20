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
    npm i esbuild@0.21.5 puppeteer-stream

CMD ["/sbin/tini", "--", "node", "/fullstacked/index.mjs"]