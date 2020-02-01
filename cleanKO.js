const fs = require('fs');
const { Client } = require('..')

async function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

const CHAT_ID = '-1001143645037';

const WHITE = ['anna_minnie', 'annushka_1', '419131175', 'iar0slav', 'meduza_volnaia', 'krushanovskij', 'rualyonka', '463666831'];

void async function() {
  const client = new Client({
    apiId: '790779',
    apiHash: 'ab850b0ea104810bc2080b07e68d9787',
  })

  const defaultHandler = client.callbacks['td:getInput']

  // Register own callback for returning auth details
  client.registerCallback('td:getInput', async (args) => {
    if (args.string === 'tglib.input.AuthorizationType') {
      return 'user'
    } else if (args.string === 'tglib.input.AuthorizationValue') {
      return '+380933030344';
    }
    return await defaultHandler(args)
  })

  await client.ready

  console.log("Ready");

  let chatMembers = await client.fetch({
    '@type': 'searchChatMembers',
    'chat_id': CHAT_ID,
    'filter': null,
    'limit': 200,
  });

  let isUnknownFound = false;

  const candidates = chatMembers.members.filter(member => {
    if (member['@type'] != 'chatMember') {
			return false;
		}

		if (!member.status) {
			return false;
		}

		if (member.bot_info) {
			return false;
		}

		if (member.status['@type'] == 'chatMemberStatusAdministrator') {
			return false;
		}

		if (member.status['@type'] == 'chatMemberStatusCreator') {
			return false;
		}

		if (member.status['@type'] == 'chatMemberStatusRestricted') {
			return false;
		}

		if (member.status['@type'] == 'chatMemberStatusMember') {
			return true;
		}

    console.log("UNKNOWN:");
    console.log(member);
    isUnknownFound = true;
  });

  if (isUnknownFound) {
    process.exit(0);
  }


  const seenByUserId = JSON.parse(fs.readFileSync('seen.json').toString());

  for (const member of candidates) {
    const userId = member.user_id;

    if (seenByUserId[userId]) {
      console.log("I have seen %d", userId);
      continue;
    }

    const info = await client.fetch({
      '@type': 'getUser',
      'user_id' : userId
    });

    const ises = [];
    for (const [key, value] of Object.entries(info)){ 
      if (key.startsWith('is_')) {
        ises.push(key + '=' + value);
      }
    }

    console.log(
      "%d '%s' %s %s", 
      userId, (info.first_name + ' ' + info.last_name).trim(), info.username ? '@' + info.username : '', ises.join(', ')
    );

    if (info.username && info.username.endsWith('bot')) {
      console.log("\tSKIP BOT\n");
      continue;
    }

    if (info.username && WHITE.includes(info.username.toLowerCase())) {
      console.log("\tSKIP WHITE\n");
      continue;
    }

    if (WHITE.includes[userId]) {
      console.log("\tSKIP userId\n");
      continue;
    }

    if (1) {
      const result = await client.fetch({
        '@type': 'setChatMemberStatus',
        'chat_id': CHAT_ID,
        'user_id': userId,
        'status': { '@type': 'chatMemberStatusLeft' }
      });


      if (result['@type'] == 'ok') {  
        console.log('\tdeleted');
      } else { 
        console.log(result);
      }

      await sleep(1000);
    }
  }

  console.log("All done");
  process.exit(0);

}()
