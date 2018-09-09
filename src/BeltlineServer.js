
import socketIO from 'socket.io';
import Promise from 'bluebird';

export default class BeltlineServer {
  constructor(app, databaseConnection) {
    this.db = databaseConnection;

    this.io = socketIO(app);

    this.publishHandlers = {};
    this.queries = {};
    this.methods = {};
    this.isServer = true;

    this.io.on('connection', (socket) => {
      socket.on('subscribe', ({ id, subscriptionName, params }) =>
        this.onSubscribe(id, subscriptionName, params, socket));
      socket.on('call', ({ methodName, params, callId }) =>
        this.onCall(methodName, params, callId, socket));
      socket.on('unsubscribe', ({ id }) =>
        this.onUnsubscribe(id, socket));
      socket.on('disconnect', () => this.onDisconnect(socket));
    });
  }

  async onSubscribe(id, subscriptionName, params, socket) {
    if (this.publishHandlers[subscriptionName]) {
      const query = this.publishHandlers[subscriptionName](params);
      if (this.queries[query]) {
        this.queries[query].push({ id, subscriptionName, socket });
      } else {
        this.queries[query] = [{ id, subscriptionName, socket }];
      }
      const graph = await this.db.execute(query);
      socket.emit('published', {
        id,
        graph: graph.toNT(),
        query,
      });
    }
  }

  async onCall(methodName, params, callId) {
    await this.methods[methodName](params, this.db);
    await Promise.map(Object.keys(this.queries), async (query) => {
      const clientInfo = this.queries[query];
      const graph = await this.db.execute(query);
      clientInfo.forEach((client) => {
        client.socket.emit('update', {
          id: client.id,
          graph: graph.toNT(),
          callId,
        });
      });
    });
  }

  onUnsubscribe(id) {
    Object.keys(this.queries).forEach((query) => {
      this.queries[query] = this.queries[query].filter(clientInfo => clientInfo.id !== id);
    });
  }

  onDisconnect(socket) {
    Object.keys(this.queries).forEach((query) => {
      this.queries[query] = this.queries[query].filter(clientInfo => clientInfo.socket !== socket);
    });
  }

  publish(subscriptionName, publishHandler) {
    this.publishHandlers[subscriptionName] = publishHandler;
  }

  method(methodName, method) {
    this.methods[methodName] = method;
  }
}
