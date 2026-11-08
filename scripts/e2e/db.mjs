// Local end-to-end database: PGlite (folder .data/e2e-db, git-ignored) served as Postgres on 127.0.0.1:5433.
// pglite-socket's multiplexer interleaves clients message by message, so two clients using the
// extended protocol (Parse/Bind/Execute/Sync) clobber each other's unnamed statement
// ("bind message supplies 2 parameters, but prepared statement "" requires 5").
// This patch keeps one client in charge from its first extended-protocol message until its Sync,
// the same way the library already does inside explicit transactions.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const db = await PGlite.create("./.data/e2e-db");
const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 5433, maxConnections: 10 });
const queue = server.queryQueue;

// Parse, Bind, Describe, Execute, Close, Flush: the cycle stays open until Sync.
const EXTENDED = new Set([0x50, 0x42, 0x44, 0x45, 0x43, 0x48]);
let pinned = null;

queue.processQueue = async function processQueue() {
  if (this.processing || this.queue.length === 0) return;
  this.processing = true;
  while (this.queue.length > 0) {
    const owner = pinned ?? (db.isInTransaction() ? this.lastHandlerId : null);
    let item;
    if (owner !== null) {
      const index = this.queue.findIndex((q) => q.handlerId === owner);
      if (index === -1) break; // wait for the owner's next message
      item = this.queue.splice(index, 1)[0];
    } else {
      item = this.queue.shift();
    }
    let bytes = 0;
    try {
      await db.runExclusive(() =>
        db.execProtocolRawStream(item.message, {
          onRawData: (data) => {
            bytes += data.length;
            item.onData(data);
          },
        }),
      );
    } catch (err) {
      pinned = null;
      item.reject(err);
      continue;
    }
    pinned = EXTENDED.has(item.message[0]) ? item.handlerId : null;
    this.lastHandlerId = item.handlerId;
    item.resolve(bytes);
  }
  this.processing = false;
};

const clearQueueForHandler = queue.clearQueueForHandler.bind(queue);
queue.clearQueueForHandler = (id) => {
  clearQueueForHandler(id);
  if (pinned === id) {
    pinned = null;
    void queue.processQueue();
  }
};

await server.start();
console.log("e2e db listening on 127.0.0.1:5433");
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  });
}
