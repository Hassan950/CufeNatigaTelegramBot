import dotenv from 'dotenv';
dotenv.config();

import * as keep_alive from './keep_alive.js';

//set this to true if you want to test without sending message on public channel & writing into database
const test = !process.env.NODE_ENV || process.env.NODE_ENV === 'test';
console.log(new Date().toISOString() + ':\t', 'test: ', test);

//constants to map numbers to department-year form
import {
  YEARS_LABEL,
  DEPARTMENTS_IDS_MAP,
  PREP_YEAR_LABEL,
  SHOWN_INITIAL_VALUE,
} from './constants.js';

//telegram bot for sending the notifications
import TelegramBot from 'node-telegram-bot-api';
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
const chatId = !test ? '-1001382133604' : process.env.MY_PRIVATE_CHAT_ID;

//to fetch the current shown results from website
import fetch from 'isomorphic-fetch';

//to save previous shown results. to avoid sending message for already shown results when restarting the app
import MongoClient from 'mongodb';

const connection = MongoClient.MongoClient.connect(process.env.dbURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});


(async () => {
  const collection = (await connection).db('test').collection('natiga');
  let prevShown = await collection.findOne({});
  while (true) {
    try {
      prevShown = await check(prevShown, collection);
    } catch (err) {
      console.log(new Date().toISOString() + ':\t', err);
    }
    await new Promise((resolve) => setTimeout(resolve, 2 * 60 * 1000));
  }
})();

async function check({ prevShown, _id }, collection) {
  const shown = await fetchShown();
  console.log(new Date().toISOString() + ':\t', shown, prevShown);

  if (!shown) throw 'shown is null';
  if (shown.length !== 54) throw 'Corrupted Response: Error in Length';
  if (isResultsInited(shown, prevShown)) {
    prevShown = SHOWN_INITIAL_VALUE;
    sendMessage("تم تحديث صفحة النتائج")
  }
  if (shown !== prevShown) {
    console.log(new Date().toISOString() + ':\t', 'change detected');
    const depts = detectChanges(shown, prevShown);

    if (depts.length) {
      await Promise.all([sendMessageInTelegram(depts), sendMessageInFacebook(depts)]);
      await updatePrevShown(collection, _id, shown);
    }
  }
  return { prevShown: shown, _id };
}

async function updatePrevShown(collection, _id, shown) {
  if (!test)
    await collection.updateOne(
      {
        _id,
      },
      {
        $set: { prevShown: shown },
      }
    );
  else console.log(new Date().toISOString() + ':\t', 'saved in db');
}

async function sendMessageInFacebook(depts) {
  return;
}

async function sendMessageInTelegram(depts) {
  await sendMessage(
    'ظهرت النتائج التالية:\n' + depts.join('\n') + '\nhttps://std.eng.cu.edu.eg/'
  );
}

function sendMessage(message) {
  return bot.sendMessage(chatId, message);
}

function detectChanges(shown, prevShown) {
  const depts = [];
  [...shown].forEach((value, i) => {
    if (value === '1' && value !== prevShown[i]) {
      //detected
      const dep = getDepartment(i);
      if (dep !== null) depts.push(dep);
    }
  });
  return depts;
}

async function fetchShown() {
  if (test) return '100000110000000000000010000000000000000000010000000110';
  const response = await fetch('http://natigaupload.eng.cu.edu.eg/Config/Shown.js?r=59840366');
  const text = await response.text();
  const shown = text.match(/[01]{54}/)?.[0];
  return shown;
}

function getDepartment(i) {
  for (const [dep, index] of Object.entries(DEPARTMENTS_IDS_MAP)) {
    let year = index.findIndex((value) => value === i);
    if (year !== -1) {
      if (dep === 'اعدادي') return `${dep} ${PREP_YEAR_LABEL[year]}`;
      if (['ميكانيا قوى', 'ميكانيكا انتاج'].includes(dep)) year += 2;
      return `${YEARS_LABEL[year]} ${dep}`;
    }
  }
  return null;
}

function isResultsInited(shown, prevShown) {
  const shownResults = shown.split('').reduce((acc, value) => acc + +value, 0);
  const prevShownResults = prevShown.split('').reduce((acc, value) => acc + +value, 0);
  return shownResults < prevShownResults;
}
