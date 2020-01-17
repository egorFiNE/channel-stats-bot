'use strict';

/* eslint-disable camelcase */

const config = require('./config');

const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3');

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

const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: true });
const db = new sqlite3.Database('./stats.sqlite3');

createDb(db);

bot.on('message', msg => {
	if (msg.from.is_bot) {
		return;
	}

	if (msg.chat.type == 'private') {
		// if (msg.text == '/start') {
		bot.sendMessage(msg.chat.id, NOT_WELCOME_MESSAGE, { parse_mode: 'Markdown' });
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
