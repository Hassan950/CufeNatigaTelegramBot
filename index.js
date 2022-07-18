import dotenv from 'dotenv';
dotenv.config();

//set this to true if you want to test without sending message on public channel & writing into database
const test = !process.env.NODE_ENV || process.env.NODE_ENV === 'test';
console.log('test: ', test);

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

//to fetch the current shown results from website
import fetch from 'isomorphic-fetch';

import captureWebsite from 'capture-website';
import axios from 'axios';

//to save previous shown results. to avoid sending message for already shown results when restarting the app
import MongoClient from 'mongodb';

const connection = MongoClient.MongoClient.connect(process.env.dbURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

import imgur from 'imgur';
imgur.setClientId(process.env.IMGUR_CLIENT_ID);

(async () => {
  const collection = (await connection).db('test').collection('natiga');
  let prevShown = await collection.findOne({});
  while (true) {
    try {
      prevShown = await check(prevShown, collection);
    } catch (err) {
      console.log(err);
    }
    await new Promise((resolve) => setTimeout(resolve, 2 * 60 * 1000));
  }
})();

async function check({ prevShown, _id }, collection) {
  const shown = await fetchShown();
  console.log(shown, prevShown);

  if (!shown) throw 'shown is null';
  if (shown.length < 53) throw 'Corrupted Response: Error in Length';
  if (isResultsInited(shown, prevShown)) {
    prevShown = SHOWN_INITIAL_VALUE;
  }
  if (shown !== prevShown) {
    console.log('change detected');
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
  else console.log('saved in db');
}

async function sendMessageInFacebook(depts) {
  try {
    if (test) return;
    const image = await captureWebsite.base64('http://www.results.eng.cu.edu.eg/', {
      fullPage: true,
      launchOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    const { link } = await imgur.uploadBase64(image);
    console.log(link);

    await axios.post(`https://graph.facebook.com/${process.env.FACEBOOK_PAGE_ID}/photos`, {
      caption:
        'ظهرت النتائج التالية:\n' +
        depts.join('\n') +
        "\nDon't forget to join our telegram channel\n",
      url: link,
      access_token: process.env.FACEBOOK_PAGE_TOKEN,
    });
  } catch (err) {
    console.log('Error in facebook: ' + err);
  }
}

async function sendMessageInTelegram(depts) {
  const chatId = !test ? '-1001382133604' : process.env.MY_PRIVATE_CHAT_ID;
  await bot.sendMessage(
    chatId,
    'ظهرت النتائج التالية:\n' + depts.join('\n') + '\nhttps://std.eng.cu.edu.eg/'
  );
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
  const shown = text.match(/\[01]{53}/)?.[0];
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
