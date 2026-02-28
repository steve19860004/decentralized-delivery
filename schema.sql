-- 啟用 UUID 延伸模組 (Supabase 預設通常已啟用)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. profiles 表：儲存餐廳老闆與外送員（師傅）的基本資料
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    telegram_id TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('master', 'restaurant', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. jobs 表：儲存外送訂單資訊
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES profiles(id) NOT NULL,
    master_id UUID REFERENCES profiles(id), -- 接收訂單的外送員（師傅）
    description TEXT NOT NULL, -- 訂單內容或餐點資訊
    total_amount INTEGER NOT NULL, -- 客戶支付總金額 (台幣)
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. reviews 表：儲存評分資訊
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) NOT NULL UNIQUE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ledger 表：儲存帳本與分潤結算資訊
CREATE TABLE ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) NOT NULL UNIQUE,
    total_amount INTEGER NOT NULL,
    restaurant_payout NUMERIC NOT NULL,
    driver_payout NUMERIC NOT NULL,
    platform_profit NUMERIC NOT NULL,
    is_settled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 建立外送員信譽排行榜 View (動態產出，供 n8n 查詢)
CREATE OR REPLACE VIEW driver_reputation_ranking AS
SELECT 
    p.id,
    p.name,
    p.telegram_id,
    -- 計算完單率 (成功完單數 / 總接單數，若無則為 0)
    COALESCE(
        COUNT(CASE WHEN j.status = 'completed' THEN 1 END)::FLOAT / 
        NULLIF(COUNT(j.id), 0) * 100, 
    0) AS success_rate,
    -- 平均評分 (若無評分預設給 5 顆星)
    COALESCE(AVG(r.rating), 5.0) AS avg_rating,
    -- 綜合權重分數：基於完單率 (佔 50) + 平均評分 (佔 30 * 5 = 150)
    -- 新手預設分數計算：(0) + (5.0 * 30) = 150 分
    COALESCE(
        (COUNT(CASE WHEN j.status = 'completed' THEN 1 END)::FLOAT / NULLIF(COUNT(j.id), 0) * 50) + 
        (COALESCE(AVG(r.rating), 5.0) * 30), 
    150) AS reputation_score
FROM profiles p
LEFT JOIN jobs j ON p.id = j.master_id
LEFT JOIN reviews r ON j.id = r.job_id
WHERE p.role = 'master'
GROUP BY p.id, p.name, p.telegram_id
ORDER BY reputation_score DESC;

-- 可選：設定 Row Level Security (RLS) 安全策略（此為基礎環境建置，如需可以後續再針對不同角色限制讀寫權限）
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ledger ENABLE ROW LEVEL SECURITY;
