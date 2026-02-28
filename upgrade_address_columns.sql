-- 替 jobs 表格新增負責記錄起點跟終點的欄位，給 n8n 抓取計算運費使用
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS restaurant_address TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS destination_address TEXT;
