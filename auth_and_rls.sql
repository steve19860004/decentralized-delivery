-- 1. 確保 profiles 表有唯一識別與 auth.users 對接的 id 欄位
-- 如果 profiles 已存在，我們需要確保它是基於 uuid 且能與 auth.users 關聯
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. 建立一個觸發器，讓 auth.users 新增時自動同步到 profiles (可選，但建議人工管理)
-- 這裡我們採取「管理員手動建立」模式，所以我們先手動新增一個 admin 帳號的邏輯

-- 3. 啟用 RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger ENABLE ROW LEVEL SECURITY;

-- 4. 定義角色檢查函數 (Helper function)
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE;

-- 5. Profiles 權限
-- 管理員可以看所有人，一般人只能看自己
CREATE POLICY "Admin can do everything on profiles" ON profiles
FOR ALL TO authenticated USING (current_user_role() = 'admin');

CREATE POLICY "Users can view their own profile" ON profiles
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 6. Jobs 權限
-- 管理員：全能
CREATE POLICY "Admin can do everything on jobs" ON jobs
FOR ALL TO authenticated USING (current_user_role() = 'admin');

-- 店家：只能看/改自己店家的單
CREATE POLICY "Restaurants can view/update their own jobs" ON jobs
FOR ALL TO authenticated USING (
  current_user_role() = 'restaurant' AND restaurant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- 師傅：能看沒被領取的單，或是自己接下的單
CREATE POLICY "Drivers can view available or their own jobs" ON jobs
FOR ALL TO authenticated USING (
  current_user_role() = 'master' AND (master_id IS NULL OR master_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
);

-- 7. Ledger 權限
-- 管理員：全能
CREATE POLICY "Admin can do everything on ledger" ON ledger
FOR ALL TO authenticated USING (current_user_role() = 'admin');

-- 店家/師傅：只能看跟自己相關的帳
CREATE POLICY "Users can view relevant ledger entries" ON ledger
FOR SELECT TO authenticated USING (
  job_id IN (
    SELECT id FROM jobs 
    WHERE restaurant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR master_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);
