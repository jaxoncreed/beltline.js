import rdfstore from 'rdfstore/src/store';
import { promisify } from 'bluebird';


export class BeltlineLocalStorageDatabase {
  async load(format, stringToLoad) {
    return await promisify(this.store.load.bind(this.store))(format, stringToLoad);
  }

  async initDatabase() {
    this.store = await promisify(rdfstore.create.bind(rdfstore))();
  }

  async execute(query) {
    return await promisify(this.store.execute.bind(this.store))(query);
  }

  async clear() {
    return await promisify(this.store.clear.bind(this.store))();
  }
}

export default async function initDatabase(func) {
  const db = new BeltlineLocalStorageDatabase();
  await db.initDatabase();
  if (func) {
    func(db);
  }
}
