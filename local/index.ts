import * as express from "express";
import * as http from "http";
import * as WebSocket from "ws";
import YSockets from "../helpers/ysockets";
import { toBase64, fromBase64 } from "lib0/buffer";
const queryString = require("query-string");

const app = express();
app.get("/", (req, res) => {
  res.sendStatus(200);
});

// const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const ySockets = new YSockets();

const connectedClients = {};

wss.on("connection", (ws, req) => {
  ws.binaryType = "arraybuffer";
  const sendToClient = async (name: string, b64Message: string) => {
    if (connectedClients[name]) {
      connectedClients[name].send(b64Message);
      console.log("Broadcasting Message to peers");
    }
  };

  const clientName = queryString.parse(req.url)["?name"];
  const docName = queryString.parse(req.url)["/?"];
  connectedClients[clientName] = ws;

  ySockets.onConnection(clientName, docName);

  ws.on("message", (message) => {
    // console.log(message.toString());
    // message is b64 string
    // console.log(`Received message => ${fromBase64(message.toString())}`);
    ySockets.onMessage(clientName, message.toString(), sendToClient);
    //ws.send(`Sent updates to peers`)
    console.log("Sending updates to peers");
  });

  //ws.send(`A ${clientName} connected to the  Server!`)
});

wss.on("close", (ws, req) => {
  const name = queryString.parse(req.url)["?name"];
  ySockets.onDisconnect(name);
  //ws.send('Disconnected from Server')
});

//start our server
const server = app.listen(5000);
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (socket) => {
    wss.emit("connection", socket, request);
  });
});
