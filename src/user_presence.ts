import { onAuthStateChanged } from "firebase/auth";
import { 
  ref, get, set, onValue, query, orderByChild,
  onDisconnect, serverTimestamp, limitToFirst,
orderByKey, 
} from "firebase/database";

import { database, auth, subscribeAuthState } from "./firebase";

import {
  DatabaseReference,
  DataSnapshot,
  Query
} from "@firebase/database";
import { User } from "@firebase/auth";
import { FirebaseError } from "firebase/app";

let timeDiff: number = 0;

console.log('user_presence.js is Running');

onValue(ref(database, '.info/serverTimeOffset'), (snapshot: DataSnapshot) => {
  timeDiff = parseInt(snapshot.val() ?? 0);
});

// Update online/offline status in Realtime Database
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const statusRef: DatabaseReference = ref(database, '/status/' + user.uid);
    onValue(ref(database, '.info/connected'), (snapshot: DataSnapshot) => {
      if (snapshot.val() === true) {
        console.log(".info/connected: Connected!!!");
        onDisconnect(statusRef).set({
          state: 'offline',
          last_changed: serverTimestamp(),
          inverted_last_changed: -(Date.now() + timeDiff),
        }).then(() => {
          // After the user goes back online
          // This is called at least once when a user opens the page
          console.log("Back Online!!!");
          set(statusRef, {
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
    }, (error) => {
      console.error(error.message);
    });
  } else {
    console.log("You are not logged in!");
    const sl = document.getElementById('suggest-login') as HTMLElement;
    sl.style.display = 'block';
  }
});

// Listen to user's online status change
listenUserStatus();
async function listenUserStatus() {
  const statusQuery: Query = query(ref(database, '/status'), 
    orderByChild('inverted_last_changed'), limitToFirst(100));
  const presenceListDiv = document.getElementById('presence-list') as HTMLDivElement;
  onValue(statusQuery, (snapshot) => {
    presenceListDiv.innerHTML = '';
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        const user = childSnapshot.val();
        const isOnline = user.state == 'online';
        const userDiv = document.createElement('div');
        const email = user.email;
        const uid = childSnapshot.key;
        const lapseInMillisec: number = Date.now() - user.last_changed;
        const timeText: string = timestampToText(lapseInMillisec);
        userDiv.classList.add('user');
        userDiv.classList.add(isOnline ? 'online' : 'offline');
        userDiv.innerHTML = `<h4>${email ?? uid}: ${isOnline ? 'Online' : 'Offline'} ${timeText} ago</h4>`;
        presenceListDiv.appendChild(userDiv);
      });
    }
  }, (error: unknown) => {
    console.error("Error listening on 'status'");
    if (error instanceof FirebaseError) {
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
    } else {
      console.error(error);
    }
  });
}


getNodes();
async function getNodes() {
  console.log('CALLING: getNodes');
  const div = document.createElement('div');
  div.setAttribute('id', 'order-test-list');
  document.body.appendChild(div);
  const title = document.createElement('h3');
  title.innerText = 'Order items';
  div.appendChild(title);
  const queryRef = query(ref(database, 'order_test_list'), orderByKey());
  get(queryRef).then((snapshot) => {
    console.log("size ->", snapshot.size);
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        const item = document.createElement('div');
        item.innerHTML = '<p> key: ' + childSnapshot.key
          + ', value: ' + JSON.stringify(childSnapshot.val())
          + '</p>';
        div.appendChild(item);
      });
    } else {
      console.log("order_test_list does not exist");
    }
  }).catch((error) => {
    console.error('Error Occurred');
    console.error(error.message);
  });
}

function timestampToText(millisec: number, text?: string) : string {
  if (text == undefined) text = '';
  if (millisec >= 1000) {
    const seconds = Math.floor(millisec / 1000);
    if (seconds >= 60) {
      const minutes = Math.floor(seconds / 60);
      if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        if (hours >= 24) {
          const days = Math.floor(hours / 24);
          if (days >= 365) {
            const years = Math.floor(days / 365);
            text = (years == 1) ? `${years} year ` : `${years} years `;
            millisec -= years * 31536000000;
            return timestampToText(millisec, text);
          } else {
            text += (days == 1) ? `${days} day ` : `${days} days `;
            millisec -= days * 86400000;
            return timestampToText(millisec, text);
          }
        } else {
          text += (hours == 1) ? `${hours} hour ` : `${hours} hours `;
          millisec -= hours * 3600000;
          return timestampToText(millisec, text);
        }
      } else {
        text += (minutes == 1) ? `${minutes} minute ` : `${minutes} minutes `;
        millisec -= minutes * 60000;
        return timestampToText(millisec, text);
      }
    } else {
      text += (seconds == 1) ? `${seconds} second ` : `${seconds} seconds `;
      millisec -= seconds * 1000;
      return timestampToText(millisec, text);
    }
  } else {
    text += (millisec == 1) ? `${millisec} millisecond` : `${millisec} milliseconds`;
    return text;
  }
}