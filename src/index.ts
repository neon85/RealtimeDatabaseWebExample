import { 
  onAuthStateChanged, 
  signOut 
} from "firebase/auth";
import { 
  ref, onValue, update, onDisconnect, serverTimestamp
} from "firebase/database";

import {auth, database, authStateListeners} from "./firebase";

import {
  DatabaseReference,
  DataSnapshot
} from "@firebase/database";
import { User } from "@firebase/auth";


let isSignedIn: boolean = auth.currentUser != null;
let timeDiff: number = 0;


onValue(ref(database, '.info/serverTimeOffset'), (snapshot: DataSnapshot) => {
  timeDiff = parseInt(snapshot.val() ?? 0);
});

onAuthStateChanged(auth, (_user: User|null) => {
  console.log('onAuthStateChanged');
  console.log('user.uid ->', _user?.uid);
  isSignedIn = _user != null;
  authStateListeners.forEach((listener: (arg0: User|null) => void) => listener(_user));
  if (isSignedIn) {
    console.log(`user ${_user!.email} is logged in`);
    changeOnlineState(_user!);
    showUserInfo();
  } else {
    console.log('user is not logged in');
  }
  changeSignOutBtn();
  changeLoginStateUI();
  const signupLink = document.getElementById('signup-link') as HTMLElement;
  const loginLink = document.getElementById('login-link') as HTMLElement;
  signupLink.style.display = isSignedIn ? 'none' : 'block';
  loginLink.style.display = isSignedIn ? 'none' : 'block';
});

window.addEventListener("load", function () {
  const signOutBtn = document.getElementById('signout-button');
  if (!signOutBtn) return;
  signOutBtn.addEventListener('click', function () {
    signOut(auth).then(() => {
      console.log('User signed out successfully');
    }).catch((error) => {
      console.error("Error signing out:", error);
    });
  });
});

function changeSignOutBtn() {
  const signOutBtn = document.getElementById('signout-button');
  if (signOutBtn) {
    signOutBtn.style.display = isSignedIn ? "block" : "none";
  }
}

function showUserInfo() {
  const ui = document.getElementById('user-info');
  const user = auth.currentUser;
  if (ui && user) {
    ui.innerHTML = `<p>ID: ${user.uid}</p>`
     + `<p>Email: ${user.email}</p>`;
  }
}

function changeLoginStateUI() {
  const el = document.getElementById("login-state");
  if (!el) return;
  if (isSignedIn) {
    el.innerHTML = "<b>Signed In</b>"
    el.style.color = 'green';
  } else {
    el.innerHTML = "<b>Signed Out</b>";
    el.style.color = 'red';
  }
}


async function changeOnlineState(user: User) {
  const statusRef: DatabaseReference = ref(database, 'status/' + user.uid);
  onValue(ref(database, '.info/connected'), (snapshot: DataSnapshot) => {
    if (snapshot.val() === true) {
      console.log(".info/connected: Connected!!!");
      onDisconnect(statusRef).update({
        state: 'offline',
        last_changed: serverTimestamp(),
        inverted_last_changed: -(Date.now() + timeDiff),
      }).then(() => {
        // After the user goes back online
        // This is called at least once when a user opens the page
        console.log("Back Online!!!");
        update(statusRef, {
          state: 'online',
          last_changed: serverTimestamp(),
          inverted_last_changed: -(Date.now() + timeDiff),
        }).catch((error) => {
          console.log('Error while writing to "status"');
          console.log(error.code);
          console.log(error.message);
        });
      });
    } else {
      console.log(".info/connected: Not Connected!!!");
    }
  });
}