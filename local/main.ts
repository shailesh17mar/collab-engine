import { Server } from "@hocuspocus/server";
import { Logger } from "@hocuspocus/extension-logger";
import { Redis } from "@hocuspocus/extension-redis";

console.log(process.env);
const server = Server.configure({
  port: 5000,
  extensions: [
    new Logger(),
    new Redis(
      process.env.REDIS_HOST && {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT || 6379,
      }
    ),
  ],
  async onAuthenticate(data) {
    const { token } = data;
    data.connection.readOnly = token !== "token";
  },
});

server.listen();
