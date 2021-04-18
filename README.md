## Table of Contents

- [About the Project](#about-the-project)
- [Getting Started](#getting-started)
  - [Installation](#installation)
  - [Environmental Variables](#environmental-variables)
  - [Running](#running)
- [Testing](#testing)

<!-- ABOUT THE PROJECT -->

## About The Project

A telegram bot that broadcasts a message in `@CufeNatiga` whenever a new exam results appears. 


<!-- GETTING STARTED -->

## Getting Started

This is an example of how you may give instructions on setting up your project locally.
To get a local copy up and running follow these simple example steps.

### Installation

1. Clone the repo

```sh
git clone https://github.com/Hassan950/CufeNatigaTelegramBot.git
```

2. Install dependencies

```sh
npm install
```

 ### Environmental Variables

 you need to make your own `.env` with the following structure.
 
 ```
dbURI=mongodb+srv://XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TELEGRAM_BOT_TOKEN=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
MY_PRIVATE_CHAT_ID=XXXXXXXXXX
 ```
* `dbURI`: The uri of the mongodb cluster.
* `TELEGRAM_BOT_TOKEN`: Token of your telegram bot (See this [guide](https://core.telegram.org/bots#3-how-do-i-create-a-bot) for more info).
* `MY_PRIVATE_CHAT_ID`: This is actually for testing in your private chat instead of filling the channel's chat with false alarms.

### Running

Upon creating `.env` like in [Environmental Variables](#environmental-variables) section. run this in your terminal:

```sh
node index.js
```


<!-- TESTING -->

## Testing
You can test on your private chat by setting `test` variable in `index.js` to true (default: false).
