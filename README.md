# beltline.js
A JavaScript framework using Dristriubted Data Protocol for the Semantic Web

## Demo
Explore an example of beltline's usage at .

## Installation
```bash
npm install beltline --save
```

## Usage

To illustrait the usuage of beltline.js we'll be walking through how to build an application that keeps track of a list of people. An example can be seen [here](https://github.com/jaxoncreed/beltline-example).

### 1) Define Publish Methods

Publish methods only are executed on the server and use SPARQL ``CONSTRUCT`` queries to define a subgraph. Later we will use "subscribe" methods on the client to subscribe to these publish methods.

The following example receives an "id" parameter from the client 

personApi.js
```js
export default function personApi(beltline) {
  if (beltline.isServer) {
    beltline.publish('person', ({ id }) => {
      return `
        PREFIX f: <http://example.com/owl/families#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        CONSTRUCT { ?s ?p ?o } WHERE {
          f:${id} ?p ?o .
          ?s rdf:type f:Person .
          ?s ?p ?o 
        }
      `;
    });
  }
}
```

### 2) Define Shared Methods
Shared methods modify the database in some way. They are shared between both the client and the server. Calling a shared method on the client will update the data on the client, server, and all other clients that are subscribed to a subgraph that contains the modified data.

In this example, we define a method to change a person's name.

personApi.js
```js
export default function personApi(beltline) {
  // ...
  beltline.method('changeName', async ({ id, newName }, db) => {
    await db.execute(`
      PREFIX f: <http://example.com/owl/families#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      DELETE { f:${id} rdf:name ?o }
      INSERT { f:${id} rdf:name "${newName}"^^xsd:string }
      WHERE  { f:${id} rdf:name ?o }
    `);
  });
}
```

### 3) Initialize Beltline on the Server
Attach your Node.js Server to Beltline by creating a database connection, providing beltline with than database connection, and adding your custom APIs to beltline.

server.js
```js
import express from 'express'
import BeltlineServer from 'beltline';
import initDatabase from 'beltline-local-storage-database';
import personApi from './beltlineMethods/personApi';

const app = express();
const server = require('http').createServer(app);

initDatabase(async (db) => {
  await db.load('text/turtle', turtleString);
  const beltline = new BeltlineServer(server, db);
  personApi(beltline);
});

server.listen(8080);
```

### 4) Initialize Beltline on the Client
Point the beltline client to your server and initialize it with your custom api.

client.js
```js
import BeltlineClient from 'beltline-client';
import personApi from '../../beltlineMethods/personApi';

const beltlineClient = new BeltlineClient('http://localhost:8080');
personApi(beltlineClient);
```

### 5) Call Subscriptions and Methods from the Client
Subscribe to your publish methods by using the subscribe methods. Once you subscribe, the callback will be called with the current subgraph. It will also be called with any subsequent updates to this subgraph.

peopleActions.js
```js
await beltline.subscribe(
  'person',
  { id },
  (newGraph) => {
    // Do what you will with your new sub-graph
  }
);
```

Modify your database with calls to your predefined methods.

peopleActions.js
```js
beltline.call('changeName', { id, newName });
```