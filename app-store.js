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
                            <!-- 呼叫下單彈窗模組，傳入店家ID與餐點資訊 -->
                            <button onclick="orderNow('${store.id}', '${store.name}', '${item.item_name}', ${item.price})" class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-3 py-1.5 rounded-full transition shadow-sm">想吃</button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `</div></div>`;
    });

    storeListContainer.innerHTML = html;
}

// ------------------------------------------
// 顧客直購與自動派單系統核心邏輯
// ------------------------------------------

// 1. 開啟結帳小視窗
window.orderNow = function (restaurantId, restaurantName, itemName, price) {
    document.getElementById('checkout-restaurant-id').value = restaurantId;
    document.getElementById('checkout-item-name').value = itemName;
    document.getElementById('checkout-price').value = price;

    // 初始化數量為 1
    document.getElementById('checkout-quantity').value = 1;
    document.getElementById('checkout-quantity-display').textContent = 1;

    document.getElementById('checkout-restaurant-name').textContent = restaurantName;
    document.getElementById('checkout-item-display').textContent = itemName;
    document.getElementById('checkout-unit-price').textContent = '$' + price;
    document.getElementById('checkout-price-display').textContent = '$' + price;

    document.getElementById('checkout-error').classList.add('hidden');
    document.getElementById('checkout-modal').classList.remove('hidden');

    // 小動畫延遲
    setTimeout(() => {
        document.getElementById('checkout-modal-content').classList.remove('translate-y-full');
    }, 10);
};

// 1.5 更新數量與計算總價
window.updateQuantity = function (change) {
    const qtyInput = document.getElementById('checkout-quantity');
    const qtyDisplay = document.getElementById('checkout-quantity-display');
    const totalPriceDisplay = document.getElementById('checkout-price-display');

    // (已移除與運費相關的固定金額加總，交由後台計算)
    const unitPrice = parseFloat(document.getElementById('checkout-price').value);

    let currentQty = parseInt(qtyInput.value) || 1;
    let newQty = currentQty + change;

    // 數量下限為 1
    if (newQty < 1) newQty = 1;

    qtyInput.value = newQty;
    qtyDisplay.textContent = newQty;
    totalPriceDisplay.textContent = '$' + (unitPrice * newQty);
};

// 2. 關閉結帳小視窗
window.closeCheckout = function () {
    document.getElementById('checkout-modal-content').classList.add('translate-y-full');
    setTimeout(() => {
        document.getElementById('checkout-modal').classList.add('hidden');
        document.getElementById('checkout-form').reset();
    }, 300);
};

// 3. 綁定送出表單事件與 API 寫入
const checkoutForm = document.getElementById('checkout-form');
if (checkoutForm) {
    checkoutForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const restaurantId = document.getElementById('checkout-restaurant-id').value;
        const itemName = document.getElementById('checkout-item-name').value;
        const unitPrice = Number(document.getElementById('checkout-price').value);
        const quantity = parseInt(document.getElementById('checkout-quantity').value) || 1;
        const finalPrice = unitPrice * quantity;

        const phone = document.getElementById('checkout-phone').value;
        const address = document.getElementById('checkout-address').value;
        const note = document.getElementById('checkout-note').value;
        const restaurantName = document.getElementById('checkout-restaurant-name').textContent;

        const btn = document.getElementById('checkout-submit-btn');
        const errorMsg = document.getElementById('checkout-error');

        btn.disabled = true;
        btn.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white inline-block"></div> 訂單處理中...`;
        errorMsg.classList.add('hidden');

        // 組合詳細的訂單文字
        const orderDescription = `[直客點餐] ${itemName} x${quantity} 
📞 ${phone} 
📍 ${address} 
💬 ${note ? note : '無'}`;

        try {
            // 寫入 jobs 資料表 (觸發 Webhook 用)
            // 包含給 Google Maps 估算距離的專用欄位 destination_address
            // 餐廳出發地暫定使用餐廳名稱加上台北市（建議未來擴充 profiles 地址欄位）
            const { error } = await supabaseClient.from('jobs').insert([
                {
                    restaurant_id: restaurantId,
                    description: orderDescription,
                    total_amount: finalPrice, // 只有餐費，運費將由 n8n 計算後 Update 回來
                    destination_address: address,
                    restaurant_address: '台北市信義區市府路1號' // 先用固定真實地址測試
                }
            ]);

            if (error) throw error;

            btn.innerHTML = '✅ 訂單已成功送出！';
            btn.classList.replace('from-indigo-600', 'from-green-500');
            btn.classList.replace('to-blue-600', 'to-green-600');

            setTimeout(() => {
                closeCheckout();
                // 恢復按鈕原狀
                setTimeout(() => {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    btn.classList.replace('from-green-500', 'from-indigo-600');
                    btn.classList.replace('to-green-600', 'to-blue-600');
                    alert(`✅ 您的訂單已經自動傳送給餐廳與附近的跑腿師傅！\n\n感謝您的訂購！師傅接單後會用電話與您聯絡。`);
                }, 400);
            }, 1000);

        } catch (err) {
            console.error("下單錯誤:", err);
            errorMsg.classList.remove('hidden');
            errorMsg.textContent = "下單失敗，可能有權限阻擋: " + err.message;
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });
}

// 進入點
initStore();
