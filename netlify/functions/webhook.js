const https = require('https');

const LINE_ACCESS_TOKEN = 'RtSpVC9Yh9h4WHdEmWxZX9tZxO2h0xiJWzDKMrUWS3ERNSuD171hDF/mw42yRAJChJ90L6nBnuDfbr+CVtNHWmgnWrJOFQ49b7SiZt3yqmASJ72I2eg5ik13F9vaEp5tIXRnuogU2EO9WQyZf/4q+QdB04t89/1O/w1cDnyilFU=';
const SHEET_ID          = '1ASDXEKBNJP7o--a4dixs6TcTJNZ7qa6sfT0d-N_YFGM';
const CLIENTS           = ['Amazon', 'リコー', 'ウエルシア'];

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
  console.log('handleMessage:', { userId, text });

  // コマンド処理
  if (text === 'リセット') {
    await replyText(replyToken, 'リセットしました！\nもう一度「開始」と送ってください。');
    return;
  }

  if (text === '開始' || text === 'スタート' || text === 'start') {
    await replyQuickReply(replyToken, 'どのクライアントの勤怠を記録しますか？', 
      CLIENTS.map(c => ({ label: c, text: `クライアント:${c}` }))
    );
    return;
  }

  // クライアント選択
  if (text.startsWith('クライアント:')) {
    const client = text.replace('クライアント:', '');
    if (!CLIENTS.includes(client)) {
      await replyText(replyToken, 'クライアントが見つかりません。「開始」と送ってください。');
      return;
    }
    await replyText(replyToken, `【${client}】\n作業日を入力してください\n例：2026/4/29\n\n※最初に「${client}」と入力してください\n\n形式：${client}/2026/4/29`);
    return;
  }

  // 日付入力（クライアント名/日付 形式）
  const dateMatch = text.match(/^(.+)\/(\d{4}\/\d{1,2}\/\d{1,2})$/);
  if (dateMatch) {
    const client = dateMatch[1];
    const date   = dateMatch[2];
    if (!CLIENTS.includes(client)) {
      await replyText(replyToken, 'クライアントが見つかりません。「開始」と送ってください。');
      return;
    }
    await replyText(replyToken, `【${client} / ${date}】\n作業時間を入力してください\n\n形式：${client}/${date}/時間数\n例：${client}/${date}/3.5`);
    return;
  }

  // 時間入力（クライアント名/日付/時間 形式）
  const hoursMatch = text.match(/^(.+)\/(\d{4}\/\d{1,2}\/\d{1,2})\/(\d+\.?\d*)$/);
  if (hoursMatch) {
    const client = hoursMatch[1];
    const date   = hoursMatch[2];
    const hours  = parseFloat(hoursMatch[3]);
    if (!CLIENTS.includes(client)) {
      await replyText(replyToken, 'クライアントが見つかりません。「開始」と送ってください。');
      return;
    }
    await replyText(replyToken, `【${client} / ${date} / ${hours}h】\n作業内容を入力してください\n\n形式：${client}/${date}/${hours}/作業内容\n例：${client}/${date}/${hours}/資料作成`);
    return;
  }

  // 作業内容入力（クライアント名/日付/時間/内容 形式）
  const memoMatch = text.match(/^(.+)\/(\d{4}\/\d{1,2}\/\d{1,2})\/(\d+\.?\d*)\/(.+)$/);
  if (memoMatch) {
    const client = memoMatch[1];
    const date   = memoMatch[2];
    const hours  = parseFloat(memoMatch[3]);
    const memo   = memoMatch[4];
    if (!CLIENTS.includes(client)) {
      await replyText(replyToken, 'クライアントが見つかりません。「開始」と送ってください。');
      return;
    }
    await saveRecord(client, date, hours, memo);
    await replyText(replyToken,
      `✅ 記録しました！\n\nクライアント：${client}\n作業日：${date}\n作業時間：${hours}h\n備考：${memo}\n\n続けて記録する場合は「開始」と送ってください`
    );
    return;
  }

  // デフォルト
  await replyText(replyToken, '「開始」と送ると勤怠記録を始められます！\n「リセット」で最初からやり直せます。');
}

async function saveRecord(client, date, hours, memo) {
  console.log(`保存: ${client}, ${date}, ${hours}h, ${memo}`);
  // Phase 2でGoogle Sheets API連携を実装
}

async function replyText(replyToken, message) {
  console.log('replyText:', message.substring(0, 50));
  await lineRequest({
    replyToken,
    messages: [{ type: 'text', text: message }]
  });
}

async function replyQuickReply(replyToken, message, items) {
  console.log('replyQuickReply:', message);
  await lineRequest({
    replyToken,
    messages: [{
      type: 'text',
      text: message,
      quickReply: {
        items: items.map(item => ({
          type: 'action',
          action: { type: 'message', label: item.label, text: item.text }
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
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('LINE API response:', res.statusCode, body);
        resolve();
      });
    });

    req.on('error', (err) => {
      console.error('LINE API error:', err);
      reject(err);
    });
    req.write(data);
    req.end();
  });
}
