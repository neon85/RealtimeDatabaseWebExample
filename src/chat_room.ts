import { database, auth } from "./firebase";
import {
  ref, query, get, push, update, remove,
  limitToLast, orderByChild, serverTimestamp, endBefore, startAfter,
  onValue, onDisconnect, onChildAdded,
} from 'firebase/database';
import { onAuthStateChanged } from "firebase/auth";

import {
  DatabaseReference,
  DataSnapshot,
  Query,
  ThenableReference
} from "@firebase/database";
import { User } from "@firebase/auth";


// Get roomId from url base
// const pathname = window.location.pathname;
// console.log('pathname ->', pathname);
// const parts = pathname.split('/');
// const roomId = parts[parts.length - 1];

// Get roomId from url parameter
const params = new URLSearchParams(document.location.search);
const roomId: string|null = params.get('id');

console.log('roomId ->', roomId);
const messageContainer = document.getElementById('message-container') as HTMLDivElement;
const messageInput = document.getElementById('message-input') as HTMLInputElement;
const sendButton = document.getElementById('send-button') as HTMLButtonElement;

const usersInfo = new Map<string, Map<string, any>>();
const itemSize: number = 30;
var timeDiff: number = 0;

let isLoading: boolean = false;
let noMoreItems: boolean = false;
let authUser: User|null;
let userId: string|null;
let firstTimestamp: string|null;
let firstKey: string|null;


onAuthStateChanged(auth, (user) => {
  authUser = user;
  if (authUser != null) {
    run();
  }
});

async function run() {
  getUserInfo();
  getInitialMessages();
  onlineStatusUpdate();
  userOnlineStatusCheck();
  listenTimeDiff();
}

async function getUserInfo() {
  const roomsRef: DatabaseReference = ref(database, '/users_private/' + authUser!.uid + '/chat_rooms/' + roomId);
  get(roomsRef).then((snapshot: DataSnapshot) => {
    if (snapshot.exists()) {
      const _userId: string|null = snapshot.val().user_id;
      if (_userId != null) {
        userId = _userId;
        const userRef = ref(database, '/users_public/' + userId);
        get(userRef).then((userSnap) => {
          if (userSnap.exists()) {
            const username: string|null = userSnap.val().username;
            const displayName: string|null = userSnap.val().display_name;
            if (displayName != null) {
              const dnameDom = document.getElementById('user-display-name') as HTMLElement;
              dnameDom.innerHTML = displayName;
            }
            if (username != null) {
              const unameDom = document.getElementById('username') as HTMLElement;
              unameDom.innerHTML = '@' + username;
            }
          }
        });
      }
    }
  }).catch((error) => {
    console.error(error.message);
  });
}

async function getInitialMessages() {
  const mRef = ref(database, '/chat_rooms/' + roomId + '/messages');
  const mQuery = query(mRef, orderByChild('created'), limitToLast(itemSize));
  const snapshot = await get(mQuery);
  const items: DataSnapshot[] = [];
  snapshot.forEach((child: DataSnapshot) => {
    items.push(child);
  });

  const lastSnap = items[items.length-1];
  const latestKey = lastSnap.key!;
  const latestTimestamp = lastSnap.val().created;
  listenMessages(latestKey, latestTimestamp);

  for (const snap of items) {
    if (!firstKey) {
      firstKey = snap.key!
      firstTimestamp = snap.val().created!;
    }
    try {
      const messDom = await composeMessageUI(snap);
      messageContainer.appendChild(messDom);
      messageContainer.scrollTop = messageContainer.scrollHeight;
    } catch(e) {
      console.error(e);
    }
  }
}

async function listenMessages(latestKey: string, latestTimestamp: number) {
  // Listen to /messages
  const roomMessRef: DatabaseReference = ref(database, '/chat_rooms/' + roomId + '/messages');
  const mQuery: Query = query(roomMessRef, orderByChild('created'), startAfter(latestTimestamp, latestKey));
  onChildAdded(mQuery, async (snapshot) => {
    console.log('Message received:', snapshot.key);
    composeMessageUI(snapshot).then((dom) => {
      messageContainer.appendChild(dom);
      messageContainer.scrollTop = messageContainer.scrollHeight;
    });
  }, (error) => {
    console.error(error.message);
  });
}

async function getPreviousMessages() {
  if (isLoading || noMoreItems) return;
  console.log('getPreviousMessages');
  const mRef = ref(database, '/chat_rooms/' + roomId + '/messages');
  const mQuery = query(mRef, 
    orderByChild('created'), limitToLast(itemSize), endBefore(firstTimestamp!, firstKey!));
  try {
    isLoading = true;
    const snapshot = await get(mQuery);
    const firstOne = messageContainer.children[0];
    const items: DataSnapshot[] = [];

    if (snapshot.exists()) {
      noMoreItems = snapshot.size < itemSize;

      // Since forEach can't handle async function
      snapshot.forEach((child: DataSnapshot) => {
        items.push(child);
      });

      let i = 0;
      for (const snap of items) {
        if (i == 0) {
          firstKey = snap.key;
          firstTimestamp = snap.val().created;
        }
        i++;
        try {
          const messDom = await composeMessageUI(snap);
          messageContainer.insertBefore(messDom, firstOne);
        } catch(e) {
          console.error(e);
        }
      }
    } else {
      noMoreItems = true;
    }
  } catch(e) {
    console.error(e);
  } finally {
    isLoading = false;
  }
}

window.onload = () => {
  sendButton.disabled = true;
  messageInput.onkeydown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  messageInput.oninput = (event) => {
    if (!messageInput.value.trim()) {
      sendButton.disabled = true;
    } else {
      sendButton.disabled = false;
    }
  }

  sendButton.onclick = () => {
    console.log('send button clicked');
    sendMessage();
  }

  const body = document.getElementsByTagName('body')[0];
  body.onclick = () => {
    const items = document.getElementsByClassName('delete-button');
    for (let i=0; i<items.length; i++) {
      const btn = items[i] as HTMLElement;
      btn.style.display = 'none';
    }
  }

  messageContainer.onscroll = () => {
    // on reach top of message
    if (messageContainer.scrollTop <= 20) {
      getPreviousMessages();
    }
  }
}

async function sendMessage() {
  if (isLoading) return;
  const message: string = messageInput.value.trim();
  if (message) {
    isLoading = true;
    messageInput.disabled = true;
    sendButton.disabled = true;
    console.log('message:', message);
    const data = {
      user_id: authUser!.uid,
      text: message,
      created: serverTimestamp(),
      inverted_created: -(Date.now() + timeDiff),
    };
    try {
      const messRef: ThenableReference = push(ref(database, '/chat_rooms/' + roomId + '/messages'));
      await update(messRef, data);
      console.log('message sent');
      console.log('New Message ID:', messRef.key);
      updateLastMessage(messRef.key, message);
      messageInput.value = '';
    } catch(e) {
      console.error(e);
      sendButton.disabled = false;
    } finally {
      isLoading = false;
      messageInput.disabled = false;
    }
  }
}

async function updateLastMessage(messageId: string, message: string) {
  console.log('updating last message');
  const data = {
    text: message,
    user_id: authUser!.uid,
    message_id: messageId,
  }
  try {
    await update(ref(database, '/chat_rooms/' + roomId + '/last_message'), data);
  } catch(e) {
    console.error(e);
  }
}

async function composeMessageUI(snapshot: DataSnapshot) {
  const message = snapshot.val();
  const messWrap = document.createElement('div');
  messWrap.setAttribute('id', snapshot.key!);
  messWrap.classList.add('message-wrapper');
  const messDiv = document.createElement('div');
  messDiv.classList.add('message');

  let userName: string|undefined;
  if (message.user_id in usersInfo) {
    userName = usersInfo.get(message.user_id)!.get('displayName');
  } else  {
    userName = await getUsername(message.user_id);
    const data = new Map<string, string|undefined>();
    data.set('displayName', userName);
    usersInfo.set(message.user_id, data);
  }
  if (userName) {
    const userNameDom = document.createElement('div');
    userNameDom.classList.add('username');
    userNameDom.innerText = userName;
    messDiv.appendChild(userNameDom);
  }

  const textDom = document.createElement('div');
  textDom.classList.add('text');
  textDom.innerText = message.text;
  messDiv.appendChild(textDom);

  const timeText = timestampToText(Date.now() - message.created);
  const timeDom = document.createElement('div');
  timeDom.classList.add('timestamp');
  timeDom.innerText = timeText + ' ago';
  messDiv.appendChild(timeDom);

  messWrap.appendChild(messDiv);

  if (message.user_id == authUser!.uid) {
    messWrap.classList.add('self');

    // Add Delete button
    const deleteBtn = document.createElement('div');
    deleteBtn.classList.add('delete-button');
    deleteBtn.innerHTML = '<button class="circle-btn"><i class="fa fa-close"></i></button>'
    deleteBtn.style.display = 'none';
    deleteBtn.onclick = () => {
      console.log('Delete:', snapshot.key!);
      deleteMessage(snapshot.key!);
    }
    messDiv.onclick = (event) => {
      console.log('clicked message');
      deleteBtn.style.display = deleteBtn.style.display === 'none' ? 'block' : 'none';
      event.stopPropagation();
    }
    messWrap.appendChild(deleteBtn);
  }

  return messWrap;
}

async function getUsername(uid: string) : Promise<string|undefined> {
  console.log('[+] CALLED: getUsername');
  const userRef = ref(database, '/users_public/' + uid);
  try {
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
      return snapshot.val().display_name;
    } else {
      return;
    }
  } catch(e) {
    console.error(e);
    return;
  }
}

async function deleteMessage(messageId: string) {
  const messRef = ref(database, '/chat_rooms/' + roomId + '/messages/' + messageId);
  try {
    await remove(messRef);
    console.log('Deleted:', messageId);
    document.getElementById(messageId)?.remove();
  } catch(e) {
    console.error(e);
  }
}

async function onlineStatusUpdate() {
   const isOfflineForDatabase = {
      state: 'offline',
      // last_changed: {'.sv': 'timestamp'},
      last_changed: serverTimestamp(),
      inverted_last_changed: -(Date.now() + timeDiff),
  };
  const isOnlineForDatabase = {
      state: 'online',
      // last_changed: {'.sv': 'timestamp'},
      last_changed: serverTimestamp(),
      inverted_last_changed: -(Date.now() + timeDiff),
  };

  const statusRef: DatabaseReference = ref(database, 'status/' + authUser!.uid);
  onValue(ref(database, '.info/connected'), (snapshot: DataSnapshot) => {
    if (snapshot.val() === true) {
      console.log(".info/connected: Connected!!!");
      onDisconnect(statusRef).set(isOfflineForDatabase).then(() => {
        // After the user goes back online
        // This is called at least once when a user opens the page
        console.log("Back Online!!!");
        update(statusRef, isOnlineForDatabase)
          .catch((error) => {
            console.log('Error while writing to "status"');
            console.log(error.code);
            console.log(error.message);
          });
      });
    } else {
      console.log(".info/connected: Not Connected!!!");
    }
  }, (e) => {
    console.error(e.message);
  });
}

async function userOnlineStatusCheck() {
  if (userId == null) {
    const roomsRef: DatabaseReference = ref(database, '/users_private/' + authUser!.uid + '/chat_rooms/' + roomId);
    const snapshot = await get(roomsRef);
    if (snapshot.exists()) {
      const _userId: string|null = snapshot.val().user_id;
      if (_userId != null) {
        userId = _userId;
      }
    }
  }
  const userStatusRef = ref(database, '/status/' + userId!);
  onValue(userStatusRef, (snapshot: DataSnapshot) => {
    if (snapshot.exists()) {
      console.log('[+] Got user status data', snapshot.val());
      const isUserOnline: boolean = snapshot.val().state == 'online';
      const statusDom = document.getElementById('user-online-status') as HTMLElement;
      statusDom.innerHTML = isUserOnline ? 'Online' : 'Offline';
      statusDom.classList.add(isUserOnline ? 'online' : 'offline');
    }
  }, (error) => {
    console.error(error.message);
  });
}

function listenTimeDiff() {
  onValue(ref(database, '.info/serverTimeOffset'), (snapshot: DataSnapshot) => {
    timeDiff = snapshot.val() as number ?? 0;
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
            text = (years == 1) ? `${years} year` : `${years} years`;
            return text;
          } else {
            text = (days == 1) ? `${days} day` : `${days} days`;
            return text;
          }
        } else {
          text = (hours == 1) ? `${hours} hour` : `${hours} hours`;
          millisec -= hours * 3600000;
          if (millisec >= 20 * 60000) {
            const minutes = Math.floor(millisec / 60000);
            text += ` ${minutes} minutes`;
          }
          return text;
        }
      } else {
        text = (minutes == 1) ? `${minutes} minute` : `${minutes} minutes`;
        return text;
      }
    } else {
      text = (seconds == 1) ? `${seconds} second` : `${seconds} seconds`;
      return text;
    }
  } else {
    text = '0 second';
    return text;
  }
}