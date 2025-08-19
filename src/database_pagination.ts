import { database } from "./firebase";
import { ref, get, query, orderByChild, startAfter, endBefore, limitToFirst, limitToLast } from "firebase/database";

import {
  Query,
  DatabaseReference,
  DataSnapshot
} from "@firebase/database";

let firstKey: string|null = null;
let firstTimestamp: string|null = null;
let lastKey: string|null = null;
let lastTimestamp: string|null = null;
let page: number = 1;
const itemsPerPage: number = 10;
const dataTable = document.getElementById('data-table') as HTMLDivElement;
const prevDom = document.getElementById('prev-button') as HTMLButtonElement;
const nextDom = document.getElementById('next-button') as HTMLButtonElement;
const pageText = document.getElementById('page-number') as HTMLDivElement;


fetchItems();
async function fetchItems(type?: string) {
  console.log('CALLED: fetchItems');
  let postRef: Query;
  switch(type) {
    case 'next': 
      postRef = query(ref(database, 'posts'), 
        orderByChild('inverted_created'), startAfter(lastTimestamp, lastKey!), 
        limitToFirst(itemsPerPage));
      console.log(`[+] NEXT lastTimestamp: ${lastTimestamp}, lastKey: ${lastKey}`);
      break;
    case 'prev':
      postRef = query(ref(database, 'posts'),
        orderByChild('inverted_created'), endBefore(firstTimestamp, firstKey!), 
        limitToLast(itemsPerPage));
      console.log(`[+] PREV firstTimestamp: ${firstTimestamp}, firstKey: ${firstKey}`);
      break;
    default:
      postRef = query(ref(database, 'posts'),
        orderByChild('inverted_created'), limitToFirst(itemsPerPage));
      console.log('[+] page 1');
  }

  console.log('[+] Getting /posts items');
  get(postRef).then((snapshot: DataSnapshot) => {
    console.log('snapshot.size ->', snapshot.size);
    if (snapshot.exists()) {
      let i = 1;
      dataTable.innerHTML = '';
      nextDom.style.display = snapshot.size >= itemsPerPage ? 'inline' : 'none';

      if (type == 'next') {
        page += 1;
      } else if (type == 'prev') {
        page -= 1;
      } else {
        page = 1;
      }
      prevDom.style.display = (page == 1) ? 'none' : 'inline';
      pageText.innerText = 'Current page: ' + page;

      // snapshot.val() is not ordered correctly
      snapshot.forEach((childSnapshot) => {
        if (i === 1) {
          firstKey = childSnapshot.key;
          firstTimestamp = childSnapshot.val().inverted_created;
        } else if (i === itemsPerPage) {
          lastKey = childSnapshot.key;
          lastTimestamp = childSnapshot.val().inverted_created;
        }
        i++;
        const div = document.createElement('div');
        const author = document.createElement('h3');
        const body = document.createElement('h4');
        const timeLapse = document.createElement('p');
        div.classList.add('card');
        author.innerText = childSnapshot.val().author;
        body.innerText = childSnapshot.val().body;
        const timelapse = Date.now() - childSnapshot.val().created;
        const timeText = timestampToText(timelapse);
        timeLapse.innerText = timeText + ' ago';
        div.appendChild(author);
        div.appendChild(body);
        div.appendChild(timeLapse);
        dataTable.appendChild(div);
      });
    } else {
      console.log('the provided query does not exist');
      nextDom.style.display = 'none';
    }
  }).catch((error) => {
    console.error('Failed to get /posts items');
    console.error(error.message);
  });
}

nextDom.onclick = () => {
  console.log('Clicked next');
  if (lastKey != null && lastTimestamp != null) {
    fetchItems('next');
  }
}

prevDom.onclick = () => {
  console.log('Clicked prev');
  if (firstKey != null && firstTimestamp != null) {
    fetchItems('prev')
  }
}

function timestampToText(millisec: number, text?: string): string {
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