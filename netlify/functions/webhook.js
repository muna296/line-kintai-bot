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
  console.log('handleMessage:', { userId, text, replyToken });

  if (text === 'リセット') {
    await replyText(replyToken, 'リセットしました！\n「開始」と送ってください。');
    return;
  }

  if (text === '開始' || text === 'スタート') {
    await replyQuickReply(
      replyToken,
      'どのクライアントの勤怠を記録しますか？',
      CLIENTS.map(c => ({ label: c, text: `クライアント:${c}` }))
    );
    return;
  }

  if (text.startsWith('クライアント:')) {
    const client = text.replace('クライアント:', '');
    if (!CLIENTS.includes(client)) {
      await replyText(replyToken, 'クライアントが見つかりません。「開始」と送ってください。');
      return;
    }
    await replyText(replyToken, `【${clie
