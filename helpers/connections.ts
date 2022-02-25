import { DDBHelper } from "../utils/ddb";
import * as Y from "yjs";

import { fromBase64, toBase64 } from "lib0/buffer";
import { last } from "lib0/array";
// import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from "y-prosemirror";

interface ConnectionItem {
  PartitionKey: string;
  DocName: string;
  data?: any;
  ttl: number;
}

interface DocumentItem {
  PartitionKey: string;
  Doc: Buffer;
}

export class ConnectionsTableHelper {
  private DatabaseHelper: DDBHelper;
  constructor() {
    this.DatabaseHelper = new DDBHelper({
      // tableName: "doc-engine-test-collab-engine-YConnectionsTable",
      tableName: "YConnectionsTable",
      primaryKeyName: "PartitionKey",
    });
  }

  async createConnection(id: string, docName: string) {
    return this.DatabaseHelper.createItem(id, {
      DocName: docName,
      ttl: Date.now() / 1000 + 3600,
    });
  }

  async getConnection(id: string): Promise<ConnectionItem | undefined> {
    const connections =
      await this.DatabaseHelper.queryItemByKey<ConnectionItem>(id);

    if (connections && connections.length > 0) {
      return connections[0];
    }

    if (!connections || connections.length === 0) {
      try {
        await this.removeConnection(id);
      } catch (error) {
        console.log(error);

        throw error;
      }
    }

    return undefined;
  }

  async removeConnection(id: string): Promise<boolean> {
    return await this.DatabaseHelper.deleteItem(id);
  }

  async getConnectionIds(docName: string): Promise<string[]> {
    const results = await this.DatabaseHelper.queryItemByKey<ConnectionItem>(
      docName,
      { indexKeyName: "DocName", indexName: "DocNameIndex" }
    );
    if (results) return results.map((item) => item.PartitionKey);

    return [];
  }

  async getOrCreateDoc(docName: string): Promise<Y.Doc> {
    const existingDoc = await this.DatabaseHelper.getItem<DocumentItem>(
      docName
    );

    let dbDoc = {
      Doc: Buffer.from([]),
    };
    if (existingDoc) {
      dbDoc = existingDoc;
    } else {
      await this.DatabaseHelper.createItem(docName, dbDoc, undefined, true);
    }

    // convert updates to an encoded array
    const lastUpdate = new Uint8Array(dbDoc.Doc);

    const ydoc = new Y.Doc();
    try {
      Y.applyUpdate(ydoc, lastUpdate);
    } catch (ex) {
      console.log("Something went wrong with applying the update");
    }

    return ydoc;
  }

  async updateDocV2(docName: string, update: Buffer) {
    await this.DatabaseHelper.updateItemAttribute(
      docName,
      "Doc",
      update,
      undefined
    );
    const existingDoc = await this.DatabaseHelper.getItem<DocumentItem>(
      docName
    );

    let dbDoc = {
      Doc: update,
    };
    if (existingDoc) {
      dbDoc = existingDoc;
    } else {
      await this.DatabaseHelper.createItem(docName, dbDoc, undefined, true);
    }

    const lastUpdate = new Uint8Array(update);
    // const oldUpdates = dbDoc.Updates.map(update => new Uint8Array(Buffer.from(update, 'base64')))

    // merge updates into one large update
    const mergedUpdate = Y.mergeUpdates([lastUpdate, update]);

    return await this.DatabaseHelper.updateItemAttributeV2(
      docName,
      "Doc",
      mergedUpdate
    );
  }

  async updateDoc(docName: string, update: string) {
    return await this.DatabaseHelper.updateItemAttribute(
      docName,
      "Updates",
      [update],
      undefined,
      { appendToList: true }
    );

    /*
    Future: Try to compute diffs as one large update
    
    const existingDoc = await this.DatabaseHelper.getItem<DocumentItem>(docName);

        let dbDoc = {
            Updates: []
        }
        if(existingDoc) {
            dbDoc = existingDoc
        }else{
            await this.DatabaseHelper.createItem(docName, dbDoc, undefined, true)
        }

        const oldUpdates = dbDoc.Updates.map(update => new Uint8Array(Buffer.from(update, 'base64')))

        // merge updates into one large update
        const mergedUpdate = Y.mergeUpdates(oldUpdates.concat([update]));

        return await this.DatabaseHelper.updateItemAttribute(docName,'Updates', [toBase64(mergedUpdate)], undefined)*/
  }
}
