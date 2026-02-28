-- =========================================
-- 品勝去中心化外送協議 - 圖文菜單系統擴充腳本
-- =========================================

-- 1. 建立 menus (菜單) 資料表
CREATE TABLE IF NOT EXISTS menus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    item_name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL CHECK (price >= 0),
    image_url TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 啟動 menus 表的行級安全 (RLS) 政策
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;

-- 政策 2.1：任何人都可以讀取所有菜單 (未來公開網址瀏覽使用)
CREATE POLICY "任何人都可以讀取菜單" ON menus
    FOR SELECT TO public USING (true);

-- 政策 2.2：只有店家本人可以新增菜單
CREATE POLICY "店家只能新增自己的菜單" ON menus
    FOR INSERT TO authenticated 
    WITH CHECK (
        restaurant_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'restaurant'
        )
    );

-- 政策 2.3：只有店家本人可以修改菜單
CREATE POLICY "店家只能修改自己的菜單" ON menus
    FOR UPDATE TO authenticated 
    USING (
        restaurant_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'restaurant'
        )
    );

-- 政策 2.4：只有店家本人可以刪除菜單
CREATE POLICY "店家只能刪除自己的菜單" ON menus
    FOR DELETE TO authenticated 
    USING (
        restaurant_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'restaurant'
        )
    );

-- =========================================
-- 3. 建立並設定圖片儲存池 (Supabase Storage)
-- =========================================

-- 建立一個名為 'menu-images' 的公開儲存池
INSERT INTO storage.buckets (id, name, public) 
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

-- 啟動 Storage 儲存物件的安全政策
-- 只有這一步設定了，前端才有權限上傳圖片

-- 政策 3.1：所有人都可以下載、觀看 menu-images 裡的圖片 (Public View)
CREATE POLICY "Public Access to Menu Images" ON storage.objects 
    FOR SELECT TO public USING (bucket_id = 'menu-images');

-- 政策 3.2：只有登入的使用者 (店家) 可以上傳圖片
CREATE POLICY "Authenticated Users can upload Menu Images" ON storage.objects 
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'menu-images');

-- 政策 3.3：只有登入的使用者 (店家) 可以更新圖片
CREATE POLICY "Authenticated Users can update Menu Images" ON storage.objects 
    FOR UPDATE TO authenticated USING (bucket_id = 'menu-images');

-- 政策 3.4：只有登入的使用者 (店家) 可以刪除圖片
CREATE POLICY "Authenticated Users can delete Menu Images" ON storage.objects 
    FOR DELETE TO authenticated USING (bucket_id = 'menu-images');
