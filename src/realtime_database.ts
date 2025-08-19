import { database, auth } from './firebase';
import { ref, get, set, update, onValue, push, serverTimestamp } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';

import {
  DatabaseReference,
  DataSnapshot
} from "@firebase/database";
import { FirebaseError } from 'firebase/app';
import {
  User
} from "@firebase/auth";


console.log("realtime_database.js is Running");
getOp();
listenOp();
writeOp();
postOp();
listenServerTimeOffset();

let timeDiff: number = 0;


// const testRef = ref(database, "/test/something");
// try {
//   // await push(testRef, {'message': 'All work and no play makes Jack a dull boy.'});
//   await set(testRef, {text: 'Live and let die'});
//   console.log("Successfully created data");
// } catch(error) {
//   displayError(error.code);
// }


// Get data
async function getOp() {
  const getInput = document.getElementById('get-input') as HTMLInputElement;
  const getButton = document.getElementById('get-button') as HTMLButtonElement;
  const getData = document.getElementById('get-data') as HTMLDivElement;
  const getError = document.getElementById('get-error') as HTMLDivElement;

  getInput.value = '/test/something';
  getButton.onclick = function() {
    console.log('clicked! value is ->', getInput.value);
    if (getInput.value == '') {
      return;
    }
    const path: string = getInput.value;
    get(ref(database, path)).then((snapshot: DataSnapshot) => {
      if (snapshot.exists() && snapshot.val() != null) {
        console.log('snapshot exists!');
        const data = snapshot.val();
        console.log('data ->', data);
        getData.innerText = JSON.stringify(data);
      } else {
        getError.innerText = 'Data not exists';
      }
    }).catch((error) => {
      displayError(error.code);
      getError.innerText = 'Problem occurred';
    });
  }
}


// Listen data
async function listenOp() {
  const listenInput = document.getElementById('listen-input') as HTMLInputElement;
  const listenButton = document.getElementById('listen-button') as HTMLButtonElement;
  const listenData = document.getElementById('listen-data') as HTMLDivElement;
  const listenError = document.getElementById('listen-error') as HTMLDivElement;
  let unsubscribe: () => void | null;
  var isListening = false;
  listenInput.value = '/test/something';

  listenOnData();
  function listenOnData() {
    const lRef: DatabaseReference = ref(database, listenInput.value);
    unsubscribe = onValue(lRef, (snapshot: DataSnapshot) => {
      if (snapshot.exists() && snapshot.val() != null) {
        listenData.innerText = JSON.stringify(snapshot.val());
        listenButton.innerText = 'Stop Listening'
        isListening = true;
        listenError.innerText = '';
      } else {
        if (unsubscribe) unsubscribe();
        listenError.innerText = 'Data not exists';
      }
    }, (error) => {
      console.error('Error listening on', listenInput.value);
      if (error instanceof FirebaseError) {
        console.error(error.code);
        console.error(error.message);
        if (unsubscribe) unsubscribe();
      } else {
        console.error(error);
      }
      listenError.innerText = 'Problem occurred';
    });
  }

  listenButton.onclick = function() {
    listenError.innerText = '';
    if (isListening) {
      console.log('Stop listening...');
      unsubscribe();
      isListening = false;
      listenButton.innerText = 'Listen';
    } else {
      console.log('Start listening....');
      listenOnData();
    }
  }
}

// Write Data
async function writeOp() {
  const writeInput = document.getElementById('write-path-input') as HTMLInputElement;
  const writeButton = document.getElementById('write-button') as HTMLButtonElement;
  const writeBody = document.getElementById('write-body') as HTMLTextAreaElement;
  const writeError = document.getElementById('write-error') as HTMLDivElement;
  writeInput.value = '/test/something';
  get(ref(database, writeInput.value)).then((snapshot: DataSnapshot) => {
    if (snapshot.exists() && snapshot.val() != null && snapshot.val().text != null) {
      writeBody.value = snapshot.val().text;
    }
  });
  writeButton.onclick = function() {
    if (writeBody.value == '' || writeInput.value == '') return;
    writeError.innerText = '';
    const text = writeBody.value;
    const path = writeInput.value;
    set(ref(database, path), {text: text}).then(() => {
      console.log('Successfully Wrote data');
    })
    .catch((error) => {
      console.error('Error writing to', path);
      console.error(error.code);
      console.error(error.message);
      writeError.innerText = 'Problem occurred';
    });
  }
}

// Push Post
async function postOp() {
  const postDiv = document.getElementById('post-div') as HTMLDivElement;
  const postAuthor = document.getElementById('post-author') as HTMLInputElement;
  const postBody = document.getElementById('post-body') as HTMLTextAreaElement;
  const postButton = document.getElementById('post-button') as HTMLButtonElement;
  const postError = document.getElementById('post-error') as HTMLDivElement;
  let authUser: User|null;
  onAuthStateChanged(auth, (user) => {
    authUser = user;
    if (!authUser) {
      postDiv.style.display = 'none';
    }
  });

  postButton.onclick = function() {
    console.log('postButton clicked');
    postError.innerText = '';
    const body: string = postBody.value;
    const author: string = postAuthor.value;
    if (!authUser || body == '' || author == '') return;
    const data = {
      author: author,
      uid: authUser.uid,
      body: body,
      created: serverTimestamp(),
      inverted_created: -(Date.now() + timeDiff)
    };
    const newRef: DatabaseReference = push(ref(database, '/posts'));
    console.log('random key ->', newRef.key);
    update(newRef, data).then(() => {
      console.log('Successfully posted');
      postBody.value = '';
      postAuthor.value = '';
    }).catch((error) => {
      console.log('Error while writing to /posts');
      console.error(error.code);
      console.error(error.message);
      postError.innerText = "Problem occurred";
    });
  }
}

function listenServerTimeOffset() {
  onValue(ref(database, '.info/serverTimeOffset'), (snapshot: DataSnapshot) => {
    timeDiff = parseInt(snapshot.val() ?? 0);
  });
}


function displayError(errorCode: string) {
  console.log("displayError:", errorCode);
  switch (errorCode) {
    case 'PERMISSION_DENIED':
      console.error(`Permission denied to write. Check your Firebase Database Rules.`);
      break;
    case 'DATABASE_ERROR':
      console.error(`A database error occurred. Details: ${errorCode}`);
      break;
    default:
      console.error(`An unexpected error occurred. Error code: ${errorCode}`);
      break;
  }
}