const https = require('https');

const token = '8737755137:AAEOzFmi5AgjUnphg4lkfA2q7b9Lgx3RzvU';
const url = `https://api.telegram.org/bot${token}/getUpdates`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.ok && json.result.length > 0) {
                const lastMessage = json.result[json.result.length - 1];
                if (lastMessage.message && lastMessage.message.chat) {
                    const chatId = lastMessage.message.chat.id;
                    const text = lastMessage.message.text || "(無文字)";
                    console.log(`\n🎉 成功抓取到對話紀錄！`);
                    console.log(`訊息: ${text}`);
                    console.log(`👉 CHAT_ID: ${chatId}\n`);
                } else {
                    console.log(`\n⚠️ 機器人有收到狀態更新，但不是一般文字訊息。\n`);
                }
            } else {
                console.log(`\n⚠️ 機器人還沒收到任何訊息。\n`);
            }
        } catch (e) {
            console.log('解析錯誤:', e.message);
        }
    });
}).on('error', (e) => {
    console.error(`連線錯誤: ${e.message}`);
});
