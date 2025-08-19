import { database, auth } from "./firebase";
import { get, ref, serverTimestamp, update, onValue } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";

import { User } from "@firebase/auth";
import {
  DatabaseReference,
  DataSnapshot
} from "@firebase/database";

const authInfo = document.getElementById('auth-info') as HTMLDivElement;
const usernameInput = document.getElementById('username') as HTMLInputElement;
const displaynameInput = document.getElementById('displayname') as HTMLInputElement;
const saveButton = document.getElementById('save-button') as HTMLButtonElement;
const successMessage = document.getElementById('success-message') as HTMLDivElement;
const errorMessage = document.getElementById('error-message') as HTMLDivElement;
const unameErrorMessage = document.getElementById('uname-error') as HTMLDivElement;
const dnameErrorMessage = document.getElementById('dname-error') as HTMLDivElement;

let authUser: User|null;
let username: string = '';
let displayname: string = '';
let timeDiff: number = 0;

onValue(ref(database, '.info/serverTimeOffset'), (snapshot: DataSnapshot) => {
  console.log('onValue: serverTimeOffset ->', snapshot.val());
  timeDiff = parseInt(snapshot.val() ?? 0);
});

onAuthStateChanged(auth, (_user: User|null) => {
  authUser = _user;
  if (authUser) {
    authInfo.innerHTML = '<h3>Email: ' + authUser!.email + '</h3>';
    getUserDocument();
    // test();
  } else {
    authInfo.innerHTML = '<p>You have to <a href="/login">Login</a></p>';
  }
});

async function test() {
  const r: DatabaseReference = ref(database);
  const updates = new Map<string, Object>();
  updates.set('/usernames/usernameA/' + authUser!.uid, true);
  updates.set('/users_public/' + authUser!.uid + '/username', 'usernameA');
  await update(r, updates);
  console.log('SUCCESS');
}

async function getUserDocument() {
  const userRef: DatabaseReference = ref(database, '/users_public/' + authUser!.uid);
  get(userRef).then((snapshot: DataSnapshot) => {
    if (snapshot.exists()) {
      username = snapshot.val().username ?? '';
      displayname = snapshot.val().display_name ?? '';
      console.log('username:', username);
      console.log('displayname:', displayname);
      usernameInput.value = username;
      displaynameInput.value = displayname;
    } else {
      console.log('/user_public/' + authUser!.uid + ' document does not exist.');
    }
  }).catch((e) => {
    console.log('Failed to get /user_public');
    console.error(e.message);
  });
}


usernameInput.oninput = () => {
  if ((usernameInput.value != username && usernameInput.value != '')
    || (displaynameInput.value != displayname && displaynameInput.value != '')
  ) {
    saveButton.disabled = false;
  } else {
    saveButton.disabled = true;
  }
}

displaynameInput.oninput = () => {
  if ((usernameInput.value != username && usernameInput.value != '')
    || (displaynameInput.value != displayname && displaynameInput.value != '')
  ) {
    saveButton.disabled = false;
  } else {
    saveButton.disabled = true;
  }
}

saveButton.onclick = async () => {
  saveUserDocument();
}

interface SubmitData {
  [key: string]: any;
}

async function saveUserDocument() {
  if (!authUser) return;
  console.log("CALLED: saveUserDocument");
  saveButton.disabled = true;
  successMessage.innerText = '';
  errorMessage.innerText = '';
  unameErrorMessage.innerText = '';
  dnameErrorMessage.innerText = '';
  const uname = usernameInput.value;
  const dname = displaynameInput.value;
  const vu: boolean = validateUsername(uname);
  const vd: boolean = validateDisplayname(dname);
  const data = <SubmitData>{};
  if (vu) {
    if (await usernameExists(uname)) {
      unameErrorMessage.innerText = 'The username already exists.';
      return;
    }
    if (username) {
      // await remove(ref(database, '/usernames/' + username));
      data['/usernames/' + username] = null;
    }
    data['/users_public/' + authUser!.uid + '/username'] = uname;
    data['/usernames/' + uname] = {user_id: authUser!.uid};
    // await update(ref(database, '/users_public/' + authUser!.uid), {username: uname});
    // await set(ref(database, '/usernames/' + uname), {user_id: authUser!.uid});
    // username = uname;
  }

  if (vd) {
    console.log(`DisplayName -> ${dname}`);
    data['/users_public/' + authUser!.uid + '/display_name'] = dname;
    // await update(ref(database, '/users_public/' + authUser.uid), {display_name: dname});
    // displayname = dname;
  }

  if (data.size != 0) {
    data['/users_public/' + authUser.uid + '/last_access'] = serverTimestamp();
    data['/users_public/' + authUser.uid + '/inverted_last_access'] = -(Date.now() + timeDiff);
    console.log('submitting data:', data);
    try {
      await update(ref(database), data);
      username = uname;
      displayname = dname;
      successMessage.innerText = 'Successfully updated the data';
    } catch(e) {
      console.log('Failed to submit user info');
      console.error(e);
      errorMessage.innerText = 'Failed to update the data';
      saveButton.disabled = false;
    }
  } else {
    saveButton.disabled = false;
  }
}

async function usernameExists(uname: string) : Promise<boolean> {
  const snapshot = await get(ref(database, '/usernames/' + uname));
  return snapshot.exists();
}


function validateUsername(uname: string) : boolean {
  if (uname === '') {
    unameErrorMessage.innerText = 'Required';
    return false;
  } else if (!uname.match(/^[a-z0-9_]{5,30}$/)) {
    unameErrorMessage.innerText = 'Username can contain only alphabet, digits, and _.\nAnd longer than 4 characters.';
    return false;
  } else if (username === uname) {
    return false;
  }
  return true;
}

function validateDisplayname(dname: string) : boolean {
  if (dname === '') {
    dnameErrorMessage.innerText = 'Required';
    return false;
  } else if (dname.match(/[\n\r]+/)) {
    dnameErrorMessage.innerText = 'Display name cannot contain new line.';
    return false;
  } else if (displayname === dname) {
    return false;
  }
  return true;
}