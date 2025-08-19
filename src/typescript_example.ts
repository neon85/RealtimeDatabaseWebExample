import {
  ref,
  get,
  getDatabase,
} from "firebase/database";

import {
  DatabaseReference,
  Database
} from '@firebase/database';


const database: Database = getDatabase();
const testRef: DatabaseReference = ref(database, '/test/something');

async function run() {
  console.log('Running "typscript_test.js"');
  try {
    const snapshot = await get(testRef);
  } catch(e) {
    console.error(e);
  }
}