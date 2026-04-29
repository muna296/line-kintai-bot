const https = require('https');

const LINE_ACCESS_TOKEN = 'WjvTBBluC015EUiD5rDi8Rf17mvdXPjVyzKpQIs5Fmtx4gsh8jQZkjFycjgFoC9shJ90L6nBnuDfbr+CVtNHWmgnWrJOFQ49b7SiZt3yqmAddIYNv56X1IThJ6MWQhQJeOqcVirf+bhhQWjS4ypqbAdB04t89/1O/w1cDnyilFU=';
const SHEET_ID          = '1ASDXEKBNJP7o--a4dixs6TcTJNZ7qa6sfT0d-N_YFGM';
const CLIENTS           = ['Amazon', 'リコー', 'ウエルシア']; // 実際のクライアント名に変更

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, body: 'OK' };
  }

  try {
    const body   = JSON.parse(event.body);
    const events = body.events || [];

    await Promise.all(events.map(async (e) => {
      if (e.type !== 'message' || e.message.type !== 'text') return;
      await handleMessage(e.source.userId, e.message.text.trim(), e.replyToken);
    }));
  } catch (err) {
    console.error('Error:', err);
  }

  return { statusCode: 200, body: 'OK' };
};

async function handleMessage(userId, text, replyToken) {
  console.log('handleMessage called:', { userId, text, replyToken }); // ← 追加
  const state = await getState(userId);
  console.log('current state:', state); // ← 追加

  if (text === 'リセット') {
    await clearState(userId);
    await replyText(replyToken, 'リセットしました！最初からどうぞ。');
    return;
  }

  switch (state.step) {
    case undefined:
      await replyQuickReply(replyToken, 'どのクライアントの勤怠を記録しますか？', CLIENTS);
      await setState(userId, { step: 'WAIT_CLIENT' });
      break;

    case 'WAIT_CLIENT':
      if (!CLIENTS.includes(text)) {
        await replyQuickReply(replyToken, 'リストから選んでください', CLIENTS);
        return;
      }
      await setState(userId, { step: 'WAIT_DATE', client: text });
      await replyText(replyToken, `【${text}】\n作業日を入力してください\n例：2025/1/5`);
      break;

    case 'WAIT_DATE':
      if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(text)) {
        await replyText(replyToken, '日付の形式が正しくありません\n例：2025/1/5');
        return;
      }
      await setState(userId, { ...state, step: 'WAIT_HOURS', date: text });
      await replyText(replyToken, '作業時間を入力してください（数字のみ）\n例：3.5');
      break;

    case 'WAIT_HOURS':
      const hours = parseFloat(text);
      if (isNaN(hours) || hours <= 0) {
        await replyText(replyToken, '数字で入力してください\n例：3.5');
        return;
      }
      await setState(userId, { ...state, step: 'WAIT_MEMO', hours });
      await replyText(replyToken, '作業内容・備考を入力してください\n（なければ「なし」と送ってください）');
      break;

    case 'WAIT_MEMO':
      await saveRecord(state.client, state.date, state.hours, text);
      await clearState(userId);
      await replyText(replyToken,
        `✅ 記録しました！\n\nクライアント：${state.client}\n作業日：${state.date}\n作業時間：${state.hours}h\n備考：${text}\n\n続けて入力する場合は何か送ってください`
      );
      break;
  }
}

// ===== 状態管理（グローバル変数で簡易管理） =====
const stateStore = {};

async function getState(userId) {
  return stateStore[userId] || {};
}

async function setState(userId, state) {
  stateStore[userId] = state;
}

async function clearState(userId) {
  delete stateStore[userId];
}

// ===== スプレッドシート保存 =====
async function saveRecord(client, date, hours, memo) {
  // Phase 2でGoogle Sheets API連携を実装
  console.log(`保存: ${client}, ${date}, ${hours}h, ${memo}`);
}

// ===== LINE返信ヘルパー =====
async function replyText(replyToken, message) {
  await lineRequest({
    replyToken,
    messages: [{ type: 'text', text: message }]
  });
}

async function replyQuickReply(replyToken, message, items) {
  await lineRequest({
    replyToken,
    messages: [{
      type: 'text',
      text: message,
      quickReply: {
        items: items.map(label => ({
          type: 'action',
          action: { type: 'message', label, text: label }
        }))
      }
    }]
  });
}

async function lineRequest(body) {
  return new Promise((resolve, reject) => {
    const data    = JSON.stringify(body);
    const options = {
      hostname: 'api.line.me',
      path: '/v2/bot/reply',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
      }
    };

    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
