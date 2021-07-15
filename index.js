import dotenv from 'dotenv';
dotenv.config();

//set this to true if you want to test without sending message on public channel & writing into database
const test = false;

//constants to map numbers to department-year form
import { years, mapping, prepYear } from './constants.js';

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

  if (shown.length !== 54) throw 'Corrupted Response: Error in Length';
  if (shown !== prevShown) {
    console.log('change detected');
    const depts = detectChanges(shown, prevShown);

    if (depts.length) {
      await Promise.all([
        sendMessageInTelegram(depts),
        sendMessageInFacebook(depts),
      ]);
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
  if(test) return;
  const image = await captureWebsite.base64(
    'http://www.results.eng.cu.edu.eg/',
    {
      fullPage: true,
      launchOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    }
  );

  const { link } = await imgur.uploadBase64(image);

  await axios.post(
    `https://graph.facebook.com/${process.env.FACEBOOK_PAGE_ID}/photos`,
    {
      caption:
        'ظهرت النتائج التالية:\n' +
        depts.join('\n') +
        '\nhttps://std.eng.cu.edu.eg/' +
        '\nJoin our telegram channel:\n' +
        process.env.TELEGRAM_CHANNEL_LINK,
      url: link,
      access_token: process.env.FACEBOOK_PAGE_TOKEN,
    }
  );
}

async function sendMessageInTelegram(depts) {
  const chatId = !test ? '-1001382133604' : process.env.MY_PRIVATE_CHAT_ID;
  await bot.sendMessage(
    chatId,
    'ظهرت النتائج التالية:\n' +
      depts.join('\n') +
      '\nhttps://std.eng.cu.edu.eg/'
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
  if (test) return '100000000000000000000010000000000000000000010000000000';
  const response = await fetch(
    'http://natigaupload.eng.cu.edu.eg/Config/Shown.js?r=59840366'
  );
  const text = await response.text();
  const shown = text.match(/\d+/)[0];
  return shown;
}

function getDepartment(i) {
  for (const [dep, index] of Object.entries(mapping)) {
    let year = index.findIndex((value) => value === i);
    if (year !== -1) {
      if (dep === 'اعدادي') return `${dep} ${prepYear[year]}`;
      if (['ميكانيا قوى', 'ميكانيكا انتاج'].includes(dep)) year += 2;
      return `${years[year]} ${dep}`;
    }
  }
  return null;
}
