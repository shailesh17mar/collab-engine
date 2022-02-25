# STAGE 1
FROM node:14-alpine as builder
RUN mkdir -p /app/node_modules && chown -R node:node /app
# RUN chown -R node:node /app
WORKDIR /app
COPY package*.json ./
COPY tsconfig*.json ./
COPY yarn.lock ./
# RUN npm install -g yarn
# RUN npm config set unsafe-perm true
# RUN yarn add global typescript
# RUN yarn add global ts-node
USER node
RUN yarn install
COPY --chown=node:node . .
# check files list
RUN ls -a

RUN yarn run build

# STAGE 2
FROM node:14-alpine
RUN mkdir -p /app/node_modules && chown -R node:node /app
WORKDIR //app
COPY package*.json ./
COPY yarn.lock ./
COPY tsconfig*.json ./
USER node
RUN yarn install 
COPY --from=builder /app/lib ./lib

EXPOSE 5000
CMD [ "yarn", "serve" ]