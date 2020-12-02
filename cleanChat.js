const { Airgram, Auth, prompt, toObject, TdJsonClient } = require('airgram');
const path = require('path');
const fs = require('fs');

const CHAT_ID = '-1001143645037';
const WHITE_LIST = ['747232871', '696648592', '259882904', '204301894'];

function getUserNameFromResponse(response) {
  const a = [];

  if (response.firstName) {
    a.push(response.firstName);
  }
  if (response.lastName) {
    a.push(response.lastName);
  }
  if (response.username) {
    a.push('@' + response.username);
  }

  if (response.phoneNumber) {
    a.push(response.phoneNumber);
  }

  if (!response.isVerified) {
    a.push('(not verified)');
  }

  if (response.isScam) {
    a.push('(scam)');
  }

  return a.join(' ');
}

const tdJsonClient = new TdJsonClient({
  command: path.resolve('libtdjson'),
});

const airgram = new Airgram(tdJsonClient, {
  apiId: 'APPIID',
  apiHash: 'APIHASH',
  logVerbosityLevel: 0,
  useSecretChats: false,
  deviceModel: 'server',
  systemVersion: 'Linux',
  applicationVersion: '1.0',
  databaseDirectory: path.join(__dirname, 'database')
});

airgram.use(new Auth({
  code: () => prompt(`Please enter the secret code:\n`),
  password: () => Promise.resolve('PASSWORD'),
  phoneNumber: () => Promise.resolve('+PHONE')
}))


// Getting all updates
airgram.use((ctx, next) => {
  if ('update' in ctx) {
    // console.log(`[all updates][${ctx._}]`, JSON.stringify(ctx.update))
  }
  return next()
})

// Getting new messages
airgram.on('updateNewMessage', async ({ update }, next) => {
  const { message } = update
  // console.log('[new message]', message)
  return next()
});

(async function() {
  console.log("Started");
  const me = toObject(await airgram.api.getMe())
  console.log("Got myself", me);

  const chats = await airgram.api.getChats({ limit: 50, offsetOrder: '9223372036854775807', offsetChatId: 0 });

  console.log("Got chat list");

  const searchChatMembersResponse = toObject(await airgram.api.searchChatMembers({
    chatId: parseInt(CHAT_ID),
    limit: 200
  }));

  const members = searchChatMembersResponse.members;
  console.log("Got %d chat members list", members.length);
  console.dir(members, { depth: 6, maxDepth: 6});

  const seenByUserId = JSON.parse(fs.readFileSync('seen.json').toString());

  const cutoffUnixtime = Math.floor((Date.now() - (86400 * 31 * 1000))/1000);

  const membersToDeleteByUserId = {};

  for (const member of members) {
    const userId = member.userId;

    if (member.status?._ == 'chatMemberStatusAdministrator' || member.status?._ == 'chatMemberStatusCreator') {
      console.log("%d is admin or creator", userId);
      continue;
    }

    if (member._ != 'chatMember') {
      console.log("Is not chatMember", member);
      continue;
    }

    if (member.status?._ != 'chatMemberStatusMember') {
      console.log("Is not chatMemberStatusMember", member);
      continue;
    }

    if (member.botInfo) {
      console.log("%d is bot", userId);
      continue;
    }

    const lastSeenUnixtime = seenByUserId[userId];
    if (!lastSeenUnixtime) {
      const userInfo = await airgram.api.getUser({ userId });
      console.log("I haven't seen %d (%s)", userId, getUserNameFromResponse(userInfo.response));
      membersToDeleteByUserId[userId] = getUserNameFromResponse(userInfo.response);
      continue;
    }

    if (lastSeenUnixtime < cutoffUnixtime) {
      const userInfo = await airgram.api.getUser({ userId });
      console.log("I have seen %d (%s) long ago at %s", userId, getUserNameFromResponse(userInfo.response), new Date(lastSeenUnixtime * 1000));
      membersToDeleteByUserId[userId] = getUserNameFromResponse(userInfo.response);
      continue;
    }

    console.log("I have seen %d recently at %s", userId, new Date(lastSeenUnixtime * 1000));
  }

  console.log('---------------------');

  for (const [ userId, title ] of Object.entries(membersToDeleteByUserId)) {
    if (WHITE_LIST.includes(String(userId))) {
      console.log("%d (%s) skip", userId, title);
      continue;
    }

    const result = await airgram.api.setChatMemberStatus({
      chatId: parseInt(CHAT_ID),
      userId,
      status: {
        _: 'chatMemberStatusLeft'
      }
    });

    if (result?.response?._ != 'ok') {
      console.log("Failed to ban %d (%s)", userId, title);
      console.log(result);
      process.exit(0);
    }

    console.log("Banned %d (%s)", userId, title);
  }

  console.log("All done");

  await airgram.api.logOut();
}());
