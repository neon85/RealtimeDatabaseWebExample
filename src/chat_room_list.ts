import { database, auth } from './firebase';
import { get, ref, push, query, remove, update, set,
  limitToFirst, onChildAdded, 
  serverTimestamp, orderByChild,
} from 'firebase/database';
import { onAuthStateChanged } from "firebase/auth";

import {
  DatabaseReference,
  DataSnapshot,
  Query
} from "@firebase/database";
import { User } from "@firebase/auth";

import { FirebaseError } from 'firebase/app';


let authUser: User|null;
onAuthStateChanged(auth, (user) => {
  authUser = user;
  if (authUser) {
    run();
  } else {
    console.log('user is not logged in');
  }
});

async function run() {
  getChatRooms();
  getUsers();
}

async function getChatRooms() {
  const roomsDiv = document.getElementById('rooms-list') as HTMLDivElement;
  const roomsRef: DatabaseReference = ref(database, '/users_private/' + authUser!.uid + '/chat_rooms');
  console.log('fetching /users_private/' + authUser!.uid + '/chat_rooms');
  onChildAdded(roomsRef, async (snapshot: DataSnapshot) => {
    console.log('Got room:', snapshot.key);
    const roomId: string = snapshot.key!;
    const userId: string = snapshot.val().user_id;
    const roomdiv = document.createElement('div');
    roomdiv.classList.add('room-container');
    roomdiv.classList.add('card');
    roomdiv.setAttribute('id', roomId);

    // set chat room name
    const roomName: string = await getUserName(userId);
    const titleDom = domCreate('div', roomName, 'room-title');
    roomdiv.appendChild(titleDom);

    // set last_message of the chat room
    try {
      const msnap: DataSnapshot = await get(ref(database, '/chat_rooms/' + roomId + '/last_message'));
      if (msnap.exists()) {
        const lastMessage = msnap.val().text;
        const lMessageDom = domCreate('div', lastMessage, 'room-subtitle');
        roomdiv.appendChild(lMessageDom);
      }
    } catch(e) {
      if (e instanceof FirebaseError) {
        console.error(e.message);
      } else {
        console.error(e);
      }
    }

    // set menu button;
    const menuBtn = composeRoomMoreMenuButton(roomId, userId);
    roomdiv.appendChild(menuBtn);

    roomdiv.onclick = () => {
      onClickChatRoom(roomId);
    };
    roomsDiv.appendChild(roomdiv);
  }, (error) => {
    console.error(error.message);
  });
}

async function getUserName(userId: string) : Promise<string> {
  try {
    const snapshot = await get(ref(database, '/users_public/' + userId));
    return snapshot.val().display_name ?? 'Unknown';
  } catch(e) {
    console.error(e);
    return 'Unknown';
  }
}

function composeRoomMoreMenuButton(roomId: string, userId: string) : HTMLElement {
  const container = document.createElement('div');
  container.classList.add('dropdown-menu-container');

  const moreBtn = document.createElement('div');
  moreBtn.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
  moreBtn.classList.add('more-button');

  const dropdownMenu = document.createElement('div');
  dropdownMenu.classList.add('dropdown-menu-content');

  const deleteBtn = domCreate('div', 'Delete');
  dropdownMenu.appendChild(deleteBtn);

  moreBtn.onclick = (event: Event) => {
    event.stopPropagation();
    const rect = moreBtn.getBoundingClientRect();
    console.log('window.innerWidth ->', window.innerWidth);
    console.log('rect.left ->', rect.left);
    if (rect.left < window.innerWidth / 2) {
      dropdownMenu.style.left = '0';
    } else {
      dropdownMenu.style.right = '0';
    }
    if (dropdownMenu.style.display === 'block') {
      dropdownMenu.style.display = 'none';
    } else {
      dropdownMenu.style.display = 'block';
    }
  }

  deleteBtn.onclick = (event: Event) => {
    event.stopPropagation();
    deleteChatRoom(roomId, userId);
  }

  container.appendChild(moreBtn);
  container.appendChild(dropdownMenu);
  return container;
}

async function deleteChatRoom(roomId: string, userId: string) {
  console.log('deleteChatRoom:', roomId);
  const data = <SubmitData>{};
  data['/users_private/' + userId + '/chat_rooms/' + roomId] = null;
  data['/users_private/' + userId + '/chatting_users/' + authUser!.uid] = null;
  data['/users_private/' + authUser!.uid + '/chatting_users/' + userId] = null;
  data['/users_private/' + authUser!.uid + '/chat_rooms/' + roomId] = null;
  data['/chat_rooms/' + roomId] = null;
  try {
    await update(ref(database), data);
    console.log('Successfully deleted the room');
    const roomdiv = document.getElementById(roomId);
    roomdiv?.remove();
  } catch(e) {
    console.error(e);
  }
}

async function onClickChatRoom(roomId: string) {
  console.log('chat room clicked:', roomId);
  window.location.href = `/chat_room?id=${roomId}`;
}

async function getUsers() {
  const usersDiv = document.getElementById('users-list') as HTMLDivElement;
  const r: DatabaseReference = ref(database, '/users_public');
  const q: Query = query(r, orderByChild('inverted_last_access'), limitToFirst(100));
  console.log('fetching /users_public documents');
  onChildAdded(q, (snapshot: DataSnapshot) => {
    if (snapshot.exists() && authUser!.uid != snapshot.key) {
      const user = snapshot.val();
      const userId: string = snapshot.key!;
      const div = document.createElement('div');
      div.classList.add('card');
      const dnameDom = domCreate('h3', user.display_name ?? 'Unknown', 'display-name');
      const unameDom = domCreate('p', user.username != null ? '@' + user.username : 'unknown', 'username');
      const timelapse = Date.now() - user.last_access;
      const timeText = timestampToText(timelapse);
      const timeDom = domCreate('p', timeText + ' ago', 'timestamp');
      div.append(dnameDom, unameDom, timeDom);
      div.onclick = () => { 
        onClickUserCard(userId);
      };
      usersDiv.appendChild(div);
    }
  },
  (error) => {
    console.error(error.message);
  });
}

interface SubmitData {
  [key: string]: any;
}

async function onClickUserCard(uid: string) {
  console.log('onClickUserCard ->', uid); 
  console.log('checking if a chat room exists with the user:', uid);
  const snapshot = await get(ref(database, '/users_private/' + authUser!.uid + '/chatting_users/' + uid));
  if (snapshot.exists()) {
    const roomId: string = snapshot.val().room_id;
    window.location.href = `/chat_room?id=${roomId}`;
  } else {
    createChatRoom(uid);
  }
}

async function createChatRoom(uid: string) {
  console.log('creating a chat room with a user:', uid);
  const r = push(ref(database, '/chat_rooms'));
  const roomId = r.key;
  console.log('new room id ->', roomId);
  const updates = <SubmitData>{};
  updates['/chat_rooms/' + roomId + '/created'] = serverTimestamp();
  updates['/chat_rooms/' + roomId + '/members/' + authUser!.uid] = {created: serverTimestamp()};
  updates['/chat_rooms/' + roomId + '/members/' + uid] = {created: serverTimestamp()};
  updates['/users_private/' + authUser!.uid + '/chat_rooms/' + roomId] = {user_id: uid, created: serverTimestamp()};
  updates['/users_private/' + authUser!.uid + '/chatting_users/' + uid + '/room_id'] = roomId;
  updates['/users_private/' + uid + '/chat_rooms/' + roomId] = {user_id: authUser!.uid, created: serverTimestamp()};
  updates['/users_private/' + uid + '/chatting_users/' + authUser!.uid + '/room_id'] = roomId;
  console.log('Creating a new room');
  console.log('updates ->', updates);
  try {
    await update(ref(database), updates);
    window.location.href = `/chat_room?id=${roomId}`;
  } catch(e) {
    console.error(e);
  }
}


function domCreate(tag: string, text: string, className?: string) {
  const el = document.createElement(tag);
  el.innerText = text;
  if (className) {
    el.classList.add(className);
  }
  return el;
}

window.onclick = (event: Event) => {
  for (const el of document.getElementsByClassName('dropdown-menu-content')) {
    const d = el as HTMLElement;
    d.style.display = 'none';
  }
}

function timestampToText(millisec: number, text?: string) {
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
    if (text == '') text = '0 second';
    return text;
  }
}