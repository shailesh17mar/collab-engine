import { Server, storePayload } from "@hocuspocus/server";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { Logger } from "@hocuspocus/extension-logger";
import { Redis } from "@hocuspocus/extension-redis";
import { Database } from "@hocuspocus/extension-database";
import { MongoClient, ObjectId } from "mongodb";
import { mergeUpdates } from "yjs";

// const uri = "mongodb://mongo:27017/dev";
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  tlsCAFile: `rds-combined-ca-bundle.pem`,
  tls: true,
});
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USERPOOL_ID,
  tokenUse: "access",
  clientId: process.env.COGNITO_CLIENTID.split(","),
});

const DATABASE = process.env.DATABASE || "local";
var db;
const initConnection = async () => {
  try {
    // Connect the client to the server
    await client.connect();
    // Establish and verify connection
    await client.db(DATABASE).command({ ping: 1 });
    db = client.db(DATABASE);
    if (!db.collection("documents").exists())
      await db.createCollection("documents");
    console.log("Connected successfully to mongodb");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
};

interface NDocument {
  _id: ObjectId;
  documentName: string;
  updates: Array<Uint8Array>;
}
const startServer = async () => {
  await initConnection();
  const server = Server.configure({
    port: 5000,
    extensions: [
      new Logger(),
      new Redis({
        host: process.env.REDIS_HOST || "redis",
        port: (process.env.REDIS_PORT as unknown as number) || 6379,
      }),
      new Database({
        fetch: async ({ documentName }) => {
          try {
            const documentsCollection = db.collection("documents");
            const document = await documentsCollection.findOne({
              documentName,
            });
            // if (!document) return null;
            const updates = document.updates.map(
              (update) => update.buffer
            ) as Uint8Array[];
            return mergeUpdates(updates);
          } catch (error) {
            throw error;
          }
        },
        store: async ({ documentName, state }: storePayload) => {
          try {
            const documentsCollection = db.collection("documents");
            const document = (await documentsCollection.findOne({
              documentName,
            })) as NDocument;
            if (!document)
              documentsCollection.insertOne({
                documentName,
                updates: [state],
              });
            else
              documentsCollection.updateOne(
                { documentName },
                {
                  $push: { updates: state },
                }
              );
          } catch (error) {
            throw error;
          }
        },
      }),
    ],
    async onAuthenticate(data) {
      const { token } = data;
      try {
        await verifier.verify(token);
        data.connection.isAuthenticated = true;
        data.connection.readOnly = false;
      } catch (error) {
        data.connection.isAuthenticated = false;
        data.connection.readOnly = true;
      }
    },
  });

  server.listen();
};

startServer();
