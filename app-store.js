/**
 * 品勝去中心化外送協議 - 客戶端大廳邏輯 (Storefront)
 */

const SUPABASE_URL = 'https://uaiqyaevuzescywylefo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhaXF5YWV2dXplc2N5d3lsZWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTI0MzYsImV4cCI6MjA4Nzc2ODQzNn0.DBzQDYg7Ff0oNeHEVgGwHDVUwBOn3E19P240lisQciI';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const storeListContainer = document.getElementById('store-list-container');

async function initStore() {
    console.log("正在載入首頁餐廳總覽...");

    try {
        // 1. 撈出所有上架的菜單，並一併關聯出店家的 profile name 和聯絡網址
        const { data: menuData, error: menuError } = await supabaseClient
            .from('menus')
            .select('*, profiles!menus_restaurant_id_fkey(name, contact_url)')
            .eq('is_available', true)
            .order('created_at', { ascending: false });

        if (menuError) throw menuError;

        // 2. 將菜單依照「店家」進行分組 (Group by Restaurant)
        const groupedMenus = {};
        menuData.forEach(item => {
            const restId = item.restaurant_id;
            const restName = item.profiles ? item.profiles.name : '神秘店家';
            const contactUrl = item.profiles ? item.profiles.contact_url : '';

            if (!groupedMenus[restId]) {
                groupedMenus[restId] = {
                    id: restId,
                    name: restName,
                    contact_url: contactUrl,
                    items: []
                };
            }
            groupedMenus[restId].items.push(item);
        });

        // 3. 渲染到畫面上
        renderStores(Object.values(groupedMenus));

    } catch (err) {
        console.error("載入菜單錯誤:", err);
        storeListContainer.innerHTML = `
            <div class="bg-red-50 text-red-500 p-4 rounded-xl text-center shadow">
                加載失敗，請稍後再試。 (${err.message})
            </div>
        `;
    }
}

function renderStores(stores) {
    if (stores.length === 0) {
        storeListContainer.innerHTML = `
            <div class="text-center py-10 bg-white rounded-xl shadow-sm border border-gray-100">
                <div class="text-4xl mb-3">🍽️</div>
                <h3 class="font-bold text-gray-700">目前還沒有店家開張</h3>
                <p class="text-sm text-gray-400 mt-2">晚點再來看看吧！</p>
            </div>
        `;
        return;
    }

    let html = '';

    // 遍歷所有店家
    stores.forEach(store => {
        html += `
        <div class="mb-8">
            <h3 class="font-black text-xl text-gray-800 mb-3 ml-1 flex items-center gap-2">
                <span class="text-indigo-600">📍</span> ${store.name}
            </h3>
            <div class="grid grid-cols-2 gap-3">
        `;

        // 該店家的所有菜色
        store.items.forEach(item => {
            html += `
                <div class="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 flex flex-col hover:shadow-md transition">
                    ${item.image_url
                    ? `<div class="aspect-square w-full bg-gray-50 overflow-hidden relative">
                             <img src="${item.image_url}" alt="${item.item_name}" loading="lazy" class="w-full h-full object-cover">
                           </div>`
                    : `<div class="aspect-square w-full bg-indigo-50 flex items-center justify-center text-indigo-300 text-3xl">🍽️</div>`
                }
                    <div class="p-3 flex-1 flex flex-col justify-between">
                        <div class="font-bold text-gray-800 leading-tight mb-1 text-sm">${item.item_name}</div>
                        <div class="flex justify-between items-end mt-2">
                            <div class="text-indigo-600 font-black">$${item.price}</div>
                            <!-- 將店家專屬的 LINE 網址帶入 orderNow 參數中 -->
                            <button onclick="orderNow('${store.name}', '${item.item_name}', ${item.price}, '${store.contact_url || ''}')" class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-3 py-1.5 rounded-full transition shadow-sm">想吃</button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `</div></div>`;
    });

    storeListContainer.innerHTML = html;
}

// 與店家直接聯繫點餐功能
window.orderNow = function (restaurantName, itemName, price, contactUrl) {
    const message = `老闆你好，我想向【${restaurantName}】點餐：\n👉 ${itemName} ($${price})\n請問目前可以接單與外送嗎？`;

    if (contactUrl && contactUrl.trim() !== '') {
        // 如果店家已經設定了聯絡網址 (如 line://ti/p/... 或 https://line.me/ti/p/...) 
        // 嘗試將點單文字帶入 LINE 的 URL Scheme 中
        alert("即將為您跳轉至商家的 LINE 進行點餐協調...");

        let finalUrl = contactUrl;

        // 特判 LINE 官方帳號的開窗傳訊
        if (contactUrl.includes('line.me') || contactUrl.includes('line://')) {
            // LINE Scheme 夾帶文字的標準做法: line://msg/text/?{encodedMessage}
            // 但如果店家給的是加好友網址，仍以加好友為主，客人手動貼上。這裡折衷，若是網址直接跳轉。
            finalUrl = contactUrl;
        }

        // 幫客人把要講的話複製到剪貼簿，以便跳轉後直接貼上給店家
        try {
            navigator.clipboard.writeText(message);
        } catch (e) {
            console.log("複製剪貼簿失敗", e);
        }

        window.location.href = finalUrl;
    } else {
        // 店家未填寫網址
        alert("⚠️ 該店家尚未設定快速聯絡的 LINE ID。\n\n請以截圖或自行聯絡店家：\n" + message);
    }
};

// 進入點
initStore();
