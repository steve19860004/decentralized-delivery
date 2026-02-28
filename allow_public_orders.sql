-- =========================================
-- 第五階段：開放顧客直購寫入權限
-- =========================================

-- 1. 確保 jobs 表的 RLS 啟用的情況下，允許任何人 (包含未登入的訪客 anon) 寫入新訂單
-- 這是因為我們的首頁 (Storefront) 是完全免登入開放的。客人下單必須能把資料送到 jobs。

DROP POLICY IF EXISTS "允許所有人新增訂單" ON jobs;
CREATE POLICY "允許所有人新增訂單" ON jobs
    FOR INSERT 
    WITH CHECK (true);

-- 為了確保外送員能看到新產生的 'pending' 訂單，確認原有的檢視 policy 有覆蓋。
-- (先前已有設定 Drivers can view available or their own jobs)

-- 如果先前有關閉 RLS (DISABLE ROW LEVEL SECURITY)，請重新啟動它以保證安全，但上面的 INSERT policy 會開出一道「只能投遞不能偷看」的安全信箱縫隙。
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
