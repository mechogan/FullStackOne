FROM node:20-alpine

RUN apk add --no-cache tini

COPY ./package /package

RUN npm i -g /package/$(ls /package)

RUN rm -rf /package

ENV NO_OPEN=1

CMD ["/sbin/tini", "--", "npx", "fullstacked"]