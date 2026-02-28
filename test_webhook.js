const https = require('https');
const http = require('http');

console.log('🔍 正在去資料庫挖出一筆「真實剛按完工的訂單」...');

const options = {
    hostname: 'uaiqyaevuzescywylefo.supabase.co',
    path: '/rest/v1/jobs?select=id,description,total_amount,restaurant_id,master_id,status&order=created_at.desc&limit=1',
    method: 'GET',
    headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhaXF5YWV2dXplc2N5d3lsZWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTI0MzYsImV4cCI6MjA4Nzc2ODQzNn0.DBzQDYg7Ff0oNeHEVgGwHDVUwBOn3E19P240lisQciI',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhaXF5YWV2dXplc2N5d3lsZWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTI0MzYsImV4cCI6MjA4Nzc2ODQzNn0.DBzQDYg7Ff0oNeHEVgGwHDVUwBOn3E19P240lisQciI'
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (d) => body += d);
    res.on('end', () => {
        const jobs = JSON.parse(body);
        if (jobs.length > 0) {
            console.log(`✅ 找到了！訂單內容：[${jobs[0].description}]`);
            console.log('🚀 準備發射訊號給 n8n...');

            const payload = JSON.stringify({
                type: 'UPDATE',
                table: 'jobs',
                record: jobs[0]
            });

            const req2 = http.request({
                hostname: 'localhost',
                port: 5678,
                path: '/webhook-test/supabase-webhook-checkout',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            }, (res2) => {
                let body2 = '';
                res2.on('data', (d) => body2 += d);
                res2.on('end', () => {
                    console.log(`🔥 n8n 接收結果：${body2}`);
                    if (body2.includes('404')) {
                        console.log('❌ 失敗！請先去 n8n 畫面按下左下角的橘色按鈕 [Execute Workflow]，讓它進入 Waiting 狀態後再跑一次本程式！');
                    } else {
                        console.log('🎉 成功！快去看您的機器人有沒有傳訊息來！');
                    }
                });
            });

            req2.on('error', (e) => console.error('Error hitting n8n:', e.message));
            req2.write(payload);
            req2.end();
        } else {
            console.log('⚠️ 資料庫裡還沒有訂單！請在網頁上建立一筆。');
        }
    });
});
req.on('error', (e) => console.error(e));
req.end();
