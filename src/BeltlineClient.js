import io from 'socket.io-client';
import { v4 } from 'uuid';
import Promise from 'bluebird';
import { BeltlineLocalStorageDatabase } from './BeltlineLocalStorageDatabase';

export default class Beltline {
  constructor(connectUrl) {
    this.subscriptions = {};
    this.methods = {};
    this.isServer = false;
    this.callIds = new Set();

    this.socket = io(connectUrl);
    this.socket.on('update', ({ id, graph, callId }) => this.onUpdate(id, graph, callId));
    this.socket.on('published', ({ id, graph, query }) => this.onPublished(id, graph, query));
  }

  async onUpdate(id, graph, callId) {
    if (this.callIds.has(callId)) {
      this.callIds.delete(callId);
      return;
    }
    if (this.subscriptions[id]) {
      const subscription = this.subscriptions[id];
      await subscription.store.clear();
      await subscription.store.load('text/n3', graph);
      await subscription.onUpdate(await subscription.store.execute(subscription.query));
    }
  }
  async onPublished(id, graph, query) {
    if (this.subscriptions[id]) {
      this.subscriptions[id].query = query;
      this.subscriptions[id].loaded = true;
      await this.onUpdate(id, graph);
    }
  }

  async subscribe(subscriptionName, params, onSubscriptionUpdated) {
    const id = `${subscriptionName}${JSON.stringify(params)}`;
    if (this.subscriptions[id]) {
      this.subscriptions[id].isActive = true;
      this.subscriptions[id].onUpdate = onSubscriptionUpdated;
    } else {
      const store = new BeltlineLocalStorageDatabase();
      await store.initDatabase();
      this.subscriptions[id] = {
        id,
        isActive: true,
        loaded: false,
        store,
        onUpdate: onSubscriptionUpdated,
      };
    }
    this.socket.emit('subscribe', {
      id,
      subscriptionName,
      params,
    });
  }

  method(methodName, method) {
    this.methods[methodName] = method;
  }

  async call(methodName, params) {
    if (this.methods[methodName]) {
      const callId = v4();
      this.callIds.add(callId);
      this.socket.emit('call', {
        methodName,
        params,
        callId,
      });
      await Promise.map(Object.values(this.subscriptions), async (subscription) => {
        if (subscription.loaded) {
          await this.methods[methodName](params, subscription.store);
          const graph = await subscription.store.execute(subscription.query);
          await this.onUpdate(subscription.id, graph.toNT());
        }
      });
    }
  }

  unsubscribe(subscription) {
    this.subscriptions[subscription.id].isActive = false;
    this.socket.emit('unsubscribe', { id: subscription.id });
  }
}
