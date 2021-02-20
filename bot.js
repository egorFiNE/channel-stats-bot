/* eslint-disable camelcase */

const config = require('./config');

const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3');
const fs = require('fs');
const BitcoinPriceHelper = require('./bitcoinPriceHelper');
const BitcoinOffense = require('./bitcoinOffense');


const bitcoinPriceHelper = new BitcoinPriceHelper();

const roundCurrencyFormatter = new Intl.NumberFormat('en-US', {
  useGrouping: true
});

const NOT_WELCOME_MESSAGE = "Привет. Я приватный бот для обслуживания одного канала. Ничем не могу помочь. До свидания и хорошего дня :-)";

function unixtime() {
	return Math.round(Date.now() / 1000);
}

function isMyGroup(msg) {
	return msg && msg.chat && msg.chat.id == config.chatId;
}

function touch({ db, fromId, firstName = '', lastName = '', username = null }) {
	db.run(`
		INSERT INTO Stats (fromId, seenAt, firstName, lastName, username) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(fromId) DO UPDATE
		SET messagesCount = messagesCount + 1, seenAt = ?, firstName = ?, lastName = ?, username = ?`,
		[
			fromId, unixtime(), firstName, lastName, username,
			unixtime(), firstName, lastName, username
		]
	);
}

function createDb(db) {
	db.run(`
	CREATE TABLE IF NOT EXISTS Stats (
		fromId VARCHAR(32) NOT NULL PRIMARY KEY,
		seenAt INTEGER NOT NULL,
		messagesCount INTEGER NOT NULL DEFAULT 1,
		firstName VARCHAR(255) NOT NULL DEFAULT '',
		lastName VARCHAR(255) NOT NULL DEFAULT '',
		username VARCHAR(255) NULL DEFAULT NULL
	)`);
}

function getSeenAtByUserId(db) {
	const hash = {};
	return new Promise(resolve => {
		db.all('SELECT fromId, seenAt FROM Stats', (err, results) => {
			if (err) {
				console.log(err);
				throw err;
			}

			for (const result of results) {
				hash[result.fromId] = result.seenAt;
			}

			resolve(hash);
		});
	});
}

async function dumpSeenList(db) {
	const seenAtByUserId = await getSeenAtByUserId(db);
	fs.writeFileSync('seen.json', JSON.stringify(seenAtByUserId, null, "\t"));
	console.log("Wrote seen.json");
}

function isBitcoinPriceCommand(text) {
	return text.startsWith('/bitcoin') || text.startsWith('/btc');
}

function isBitcoinRouletteCommand(text) {
	return text.startsWith('/roulette') || text.startsWith('/pizda');
}

async function sendBitcoinPrice(bot, msg) {
	const rate = await bitcoinPriceHelper.getRate();
	if (!rate) {
		console.log("CANNOT GET RATE");
		return;
	}

	const usdHr = roundCurrencyFormatter.format(rate);

	bot.sendMessage(msg.chat.id, `Биточек сейчас стоит примерно *$${usdHr}*`, {
		reply_to_message_id: msg.message_id,
		parse_mode: 'Markdown'
	});
}

/* main */

(async function() {

const db = new sqlite3.Database('./stats.sqlite3');

createDb(db);

if (process.argv[2] == '--kill') {
	console.log("dump db");
	await dumpSeenList(db);
	process.exit(0);
}

const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: true });

bot.on('message', msg => {
	if (msg.from.is_bot) {
		return;
	}

	const text = (msg.text || '').trim().toLowerCase();

	if (isBitcoinPriceCommand(text)) {
		sendBitcoinPrice(bot, msg);
		return;
	}

	if (isBitcoinRouletteCommand(text)) {
		BitcoinOffense.send(bot, msg, bitcoinPriceHelper, 'obscene.txt');
		return;
	}

	if (msg.chat.type == 'private') {
		if (text.startsWith('/say') && config.bosses.includes(String(msg.from.id)))  {
			bot.sendMessage(config.chatId, text.substr(4).trim(), { parse_mode: 'Markdown' });
		} else {
			bot.sendMessage(msg.chat.id, NOT_WELCOME_MESSAGE, { parse_mode: 'Markdown' });
		}
		return;
	}

	if (!isMyGroup(msg)) {
		console.log("alien message");
		console.log(msg);
		return;
	}

	console.log("group message");
	console.log(msg);

	touch({
		db,
		fromId: msg.from.id,
		firstName: msg.from.first_name,
		lastName: msg.from.last_name,
		username: msg.from.username
	});
});

}());
