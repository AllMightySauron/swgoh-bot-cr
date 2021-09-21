# start with official node.js 3.12
FROM arm64v8/node:lts-alpine3.12

# set workdir
WORKDIR /app

# copy application
COPY *.js /app
COPY *.json /app
COPY commands/ commands/

# copy default configuration
COPY config/ config/

# install dependencies (ignoring dev dependencies)
RUN npm install --only=production

# starting command
CMD node index.js
