-- ======================================================================================
-- 模擬內湖「品勝」去中心化外送平台的測試資料
-- ======================================================================================

-- 清空既有資料 (確保測試環境乾淨)
TRUNCATE TABLE ledger, reviews, jobs, profiles CASCADE;

-- --------------------------------------------------------------------------------------
-- 1. 建立測試節點 (3 家餐廳 & 5 位外送師傅)
-- --------------------------------------------------------------------------------------

-- 餐廳節點
INSERT INTO profiles (id, name, telegram_id, role) VALUES
('11111111-1111-1111-1111-111111111111', '內湖老王牛肉麵', '@laowang_beef', 'restaurant'),
('22222222-2222-2222-2222-222222222222', '港墘路阿姨便當', '@bento_auntie', 'restaurant'),
('33333333-3333-3333-3333-333333333333', '瑞光路健康餐盒', '@healthy_box_tpe', 'restaurant');

-- 師傅節點 (外送員)
INSERT INTO profiles (id, name, telegram_id, role) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '阿慶 (資深冷氣師傅)', '@ching_ac', 'master'),          -- 預設表現完美
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '小周 (大學生兼職)', '@chou_student', 'master'),    -- 預設表現普通
('cccccccc-cccc-cccc-cccc-cccccccccccc', '陳大哥 (早餐店老闆)', '@chen_breakfast', 'master'), -- 預設常棄單
('dddddddd-dddd-dddd-dddd-dddddddddddd', '林太太 (家庭主婦)', '@mrs_lin', 'master'),          -- 預設少量單但評價好
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '新兵小李', '@lee_newbie', 'master');             -- 預設完全沒接過單 (測試新手權重)

-- --------------------------------------------------------------------------------------
-- 2. 建立測試訂單與歷史表現 (jobs & reviews)
-- --------------------------------------------------------------------------------------

-- 👨‍🔧 阿慶 (資深師傅)：5 單全完工，皆為 5 星
-- 完單率 100%, 平均評分 5.0
INSERT INTO jobs (id, restaurant_id, master_id, description, total_amount, status) VALUES
('f1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '牛肉麵 x 2', 400, 'completed'),
('f1111111-1111-1111-1111-111111111112', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '排骨便當 x 3', 360, 'completed'),
('f1111111-1111-1111-1111-111111111113', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '低脂雞胸餐 x 5', 750, 'completed');

INSERT INTO reviews (job_id, rating, comment) VALUES
('f1111111-1111-1111-1111-111111111111', 5, '湯很燙，送很快！'),
('f1111111-1111-1111-1111-111111111112', 5, '準時抵達'),
('f1111111-1111-1111-1111-111111111113', 5, '超讚的師傅');

-- 👦 小周 (兼職學生)：接 4 單，完成 3 單，取消 1 單。評價有高有低。
-- 完單率 75%, 平均評分 3.5
INSERT INTO jobs (id, restaurant_id, master_id, description, total_amount, status) VALUES
('f2222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '牛肉湯餃 x 1', 150, 'completed'),
('f2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '雞腿便當 x 2', 260, 'completed'),
('f2222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '小菜拼盤', 100, 'completed'),
('f2222222-2222-2222-2222-222222222224', '33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '沙拉餐盒', 180, 'cancelled'); -- 取消單

INSERT INTO reviews (job_id, rating, comment) VALUES
('f2222222-2222-2222-2222-222222222221', 4, '還不錯'),
('f2222222-2222-2222-2222-222222222222', 2, '湯灑出來了'),
('f2222222-2222-2222-2222-222222222223', 5, NULL);

-- 👨 老陳 (早餐店老闆)：接 3 單，完成 1 單，取消 2 單。評價只有 1 顆星。
-- 完單率 33.3%, 平均評分 1.0
INSERT INTO jobs (id, restaurant_id, master_id, description, total_amount, status) VALUES
('f3333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '焢肉飯 x 1', 120, 'completed'),
('f3333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '牛肚涼拌', 150, 'cancelled'),
('f3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '牛肉沙拉', 200, 'cancelled');

INSERT INTO reviews (job_id, rating, comment) VALUES
('f3333333-3333-3333-3333-333333333331', 1, '等了一個半小時，餐都冷了！');

-- 👩 林太太：接 1 單，完成 1 單，沒有給評價。
-- 完單率 100%, 平均評分預設應該要是 5.0
INSERT INTO jobs (id, restaurant_id, master_id, description, total_amount, status) VALUES
('f4444444-4444-4444-4444-444444444441', '33333333-3333-3333-3333-333333333333', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '蔬菜湯', 80, 'completed');
-- 無 review 紀錄

-- 👦 小李：0 單 (新手狀態)。
-- 無 jobs 與 reviews 紀錄。

-- --------------------------------------------------------------------------------------
-- 3. 檢查排行結果
-- --------------------------------------------------------------------------------------
-- 執行此行以瀏覽排行榜：
-- SELECT * FROM driver_reputation_ranking;
