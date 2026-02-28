/**
 * 品勝去中心化外送協議 - 客戶端大廳邏輯 (Storefront)
 */

const SUPABASE_URL = 'https://uaiqyaevuzescywylefo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhaXF5YWV2dXplc2N5d3lsZWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTI0MzYsImV4cCI6MjA4Nzc2ODQzNn0.DBzQDYg7Ff0oNeHEVgGwHDVUwBOn3E19P240lisQciI';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const storeListContainer = document.getElementById('store-list-container');

// 全域購物車狀態
window.cart = {
    restaurantId: null,
    restaurantName: null,
    address: null, // 店家實體地址
    items: []      // { name, price, qty }
};

async function initStore() {
    console.log("正在載入首頁餐廳總覽...");

    try {
        // 1. 撈出所有上架的菜單，並一併關聯出店家的 profile name、聯絡網址還有最重要的「真實外送起點地址」
        const { data: menuData, error: menuError } = await supabaseClient
            .from('menus')
            .select('*, profiles!menus_restaurant_id_fkey(name, contact_url, address)')
            .eq('is_available', true)
            .order('created_at', { ascending: false });

        if (menuError) throw menuError;

        // 2. 將菜單依照「店家」進行分組 (Group by Restaurant)
        const groupedMenus = {};
        menuData.forEach(item => {
            const restId = item.restaurant_id;
            const restName = item.profiles ? item.profiles.name : '神秘店家';
            const contactUrl = item.profiles ? item.profiles.contact_url : '';
            const address = (item.profiles && item.profiles.address) ? item.profiles.address : '台北市信義區市府路1號'; // 兼容防呆

            if (!groupedMenus[restId]) {
                groupedMenus[restId] = {
                    id: restId,
                    name: restName,
                    contact_url: contactUrl,
                    address: address, // 店家地址
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
                            <!-- 呼叫加入購物車邏輯，傳入店家ID與餐點資訊及真實地址 -->
                            <button onclick="addToCart('${store.id}', '${store.name}', '${item.item_name}', ${item.price}, '${store.address}')" class="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold px-3 py-1.5 rounded-full transition shadow-sm">加入購物車</button>
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
// 購物車與結帳系統邏輯
// ------------------------------------------

// 1. 加入購物車 (取代原本的 orderNow)
window.addToCart = function (restaurantId, restaurantName, itemName, price, restaurantAddress) {
    // 跨店防呆檢查：如果購物車內有東西，且跟正在點的不是同一家店
    if (window.cart.items.length > 0 && window.cart.restaurantId !== restaurantId) {
        alert(`無法加入購物車！\n\n您的購物車內已經有【${window.cart.restaurantName}】的餐點。\n同一次訂單只能向同一間餐廳訂購，請先結帳或清空購物車後再試。`);
        return;
    }

    // 如果是第一項商品，或同店家，就初始化/保留店家資訊
    window.cart.restaurantId = restaurantId;
    window.cart.restaurantName = restaurantName;
    window.cart.address = restaurantAddress || '台北市信義區市府路1號';
    window.currentRestaurantAddress = window.cart.address; // 兼容舊有地圖用的全域變數

    // 檢查購物車內是否已經有這個品項，有就加一，沒有就新增
    const existingItem = window.cart.items.find(i => i.name === itemName);
    if (existingItem) {
        existingItem.qty += 1;
    } else {
        window.cart.items.push({
            name: itemName,
            price: Number(price),
            qty: 1
        });
    }

    // 更新懸浮按鈕與購物車 UI
    renderCartUI();

    // 每次變動都退回首層狀態，隱藏運費預覽
    resetFeePreview();
};

// 統整散落的運費狀態重置功能
function resetFeePreview() {
    document.getElementById('checkout-fee-preview').classList.add('hidden');
    document.getElementById('checkout-submit-btn').classList.add('hidden');
    const calcBtn = document.getElementById('calc-fee-btn');
    if (calcBtn) {
        calcBtn.classList.remove('hidden');
        calcBtn.disabled = false;
        calcBtn.innerHTML = '🔍 預估運費';
    }
    window.currentDeliveryFee = 0;
}

// 2. 渲染 UI (懸浮按鈕 & 內部清單)
window.renderCartUI = function () {
    const btn = document.getElementById('floating-cart-btn');
    const badge = document.getElementById('floating-cart-badge');
    const totalLabel = document.getElementById('floating-cart-total');

    // 如果空車，隱藏懸浮按鈕並關閉結帳視窗如果有開
    if (window.cart.items.length === 0) {
        btn.classList.add('hidden');
        window.cart.restaurantId = null;
        window.cart.restaurantName = null;
        window.cart.address = null;
        closeCheckout();
        return;
    }

    // 算出總件數與總餐費
    let totalQty = 0;
    let totalPrice = 0;
    window.cart.items.forEach(item => {
        totalQty += item.qty;
        totalPrice += (item.price * item.qty);
    });

    btn.classList.remove('hidden');
    btn.classList.add('flex');
    badge.textContent = totalQty;
    totalLabel.textContent = '$' + totalPrice;

    // 渲染結帳視窗內的明細清單
    const listContainer = document.getElementById('checkout-cart-items');
    if (listContainer) {
        listContainer.innerHTML = window.cart.items.map((item, index) => `
            <div class="flex justify-between items-center bg-white p-2 border border-gray-100 rounded-lg shadow-sm">
                <div class="flex-1">
                    <div class="font-bold text-gray-800 text-sm">${item.name}</div>
                    <div class="text-xs text-gray-500">單價: $${item.price}</div>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" onclick="changeItemQty(${index}, -1)" class="w-6 h-6 rounded-full bg-gray-100 text-gray-600 font-bold hover:bg-gray-200">-</button>
                    <span class="w-4 text-center text-sm font-bold">${item.qty}</span>
                    <button type="button" onclick="changeItemQty(${index}, 1)" class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 font-bold hover:bg-indigo-200">+</button>
                    <button type="button" onclick="removeItem(${index})" class="ml-2 text-red-400 hover:text-red-600">🗑</button>
                </div>
            </div>
        `).join('');
    }

    const subtotalDisplay = document.getElementById('checkout-subtotal-display');
    const subtotalInput = document.getElementById('checkout-subtotal');
    if (subtotalDisplay && subtotalInput) {
        subtotalDisplay.textContent = '$' + totalPrice;
        subtotalInput.value = totalPrice;
    }

    // 如果當前運費欄位沒隱藏，跟著更新最新總價 (含運)
    if (window.currentDeliveryFee > 0 && !document.getElementById('checkout-fee-preview').classList.contains('hidden')) {
        document.getElementById('preview-total').textContent = '$' + (totalPrice + window.currentDeliveryFee);
    }
};

// 小購物車內的數量操作
window.changeItemQty = function (index, delta) {
    if (window.cart.items[index]) {
        window.cart.items[index].qty += delta;
        if (window.cart.items[index].qty <= 0) {
            window.cart.items.splice(index, 1);
        }
        renderCartUI();
        resetFeePreview(); // 數量異動時一定要重來
    }
};

window.removeItem = function (index) {
    window.cart.items.splice(index, 1);
    renderCartUI();
    resetFeePreview();
};

// 3. 開啟結帳小視窗
window.openCheckout = function () {
    if (window.cart.items.length === 0) return;
    document.getElementById('checkout-modal').classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('checkout-modal-content').classList.remove('translate-y-full');
    }, 10);
};

// 4. 關閉結帳小視窗
window.closeCheckout = function () {
    const content = document.getElementById('checkout-modal-content');
    if (content) content.classList.add('translate-y-full');

    setTimeout(() => {
        const modal = document.getElementById('checkout-modal');
        if (modal) modal.classList.add('hidden');
        // 這裡不要 reset()，保留地址和聯絡電話等。
    }, 300);
};

// 2.5 運費即時精算邏輯
const calcFeeBtn = document.getElementById('calc-fee-btn');
const addressInput = document.getElementById('checkout-address');

if (calcFeeBtn && addressInput) {
    // 點擊「預估運費」按鈕
    calcFeeBtn.addEventListener('click', () => {
        const dest = addressInput.value.trim();
        const errorMsg = document.getElementById('checkout-error');

        if (!dest) {
            errorMsg.classList.remove('hidden');
            errorMsg.textContent = "👆 請先輸入您的外送地址";
            return;
        }

        errorMsg.classList.add('hidden');
        calcFeeBtn.disabled = true;
        calcFeeBtn.innerHTML = `<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 inline-block align-middle mr-1"></div> 地圖路線規劃中...`;

        // 呼叫 Google 地圖路線規劃
        const service = new google.maps.DistanceMatrixService();
        service.getDistanceMatrix({
            origins: [window.currentRestaurantAddress], // 動態帶入店家註冊的真實地址
            destinations: [dest],
            travelMode: 'DRIVING'
        }, (response, status) => {
            if (status === 'OK') {
                const results = response.rows[0].elements;
                if (results[0].status === 'OK') {
                    const distanceText = results[0].distance.text;
                    const distanceKm = results[0].distance.value / 1000;

                    // 運用與 n8n 一模一樣的運費雙核重現
                    let fee = 50;
                    if (distanceKm > 2) {
                        const extraKm = distanceKm - 2;
                        fee += Math.ceil(extraKm / 0.5) * 10;
                    }

                    window.currentDeliveryFee = fee; // 暫存

                    // 渲染至 UI 上
                    document.getElementById('preview-distance').textContent = distanceText;
                    document.getElementById('preview-fee').textContent = '+$' + fee;

                    const foodTotal = Number(document.getElementById('checkout-subtotal').value);
                    document.getElementById('preview-total').textContent = '$' + (foodTotal + fee);

                    // 隱藏試算鈕，解鎖確認送出鈕
                    calcFeeBtn.classList.add('hidden');
                    document.getElementById('checkout-fee-preview').classList.remove('hidden');
                    document.getElementById('checkout-submit-btn').classList.remove('hidden');

                } else {
                    errorMsg.classList.remove('hidden');
                    errorMsg.textContent = "❌ 地圖無法辨識此地址，或找不到路線，請重新輸入。";
                    calcFeeBtn.disabled = false;
                    calcFeeBtn.innerHTML = '🔍 預估運費';
                }
            } else {
                errorMsg.classList.remove('hidden');
                errorMsg.textContent = "❌ 地圖服務暫時無回應，請稍後再試。 (" + status + ")";
                calcFeeBtn.disabled = false;
                calcFeeBtn.innerHTML = '🔍 預估運費';
            }
        });
    });

    // 如果輸入框被修改，立刻退回「未試算」的防呆狀態
    addressInput.addEventListener('input', () => {
        resetFeePreview();
    });
}

// 6. 綁定送出表單事件與 API 寫入
const checkoutForm = document.getElementById('checkout-form');
if (checkoutForm) {
    checkoutForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        // 購物車防呆
        if (window.cart.items.length === 0) return;

        const restaurantId = window.cart.restaurantId;
        const foodTotal = Number(document.getElementById('checkout-subtotal').value);

        const phone = document.getElementById('checkout-phone').value;
        const address = document.getElementById('checkout-address').value;
        const note = document.getElementById('checkout-note').value;

        const btn = document.getElementById('checkout-submit-btn');
        const originalText = btn.innerHTML;
        const errorMsg = document.getElementById('checkout-error');

        btn.disabled = true;
        btn.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white inline-block"></div> 訂單處理中...`;
        errorMsg.classList.add('hidden');

        // 組合詳細的訂單文字 (重要邏輯移轉)
        let itemsDesc = window.cart.items.map(i => `${i.name} x${i.qty}`).join(', ');
        const orderDescription = `[直客點餐] ${itemsDesc}
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
                    total_amount: foodTotal, // 只有餐費總和，運費將由 n8n 計算後 Update 回來
                    destination_address: address,
                    restaurant_address: window.currentRestaurantAddress // 發給後台大腦一樣的真實地址
                }
            ]);

            if (error) throw error;

            btn.innerHTML = '✅ 訂單已成功送出！';
            btn.classList.replace('from-indigo-600', 'from-green-500');
            btn.classList.replace('to-blue-600', 'to-green-600');

            setTimeout(() => {
                closeCheckout();
                // 恢復按鈕原狀與清空購物車
                setTimeout(() => {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    btn.classList.replace('from-green-500', 'from-indigo-600');
                    btn.classList.replace('to-green-600', 'to-blue-600');

                    // 清空實務上的購物車內容
                    window.cart.items = [];
                    renderCartUI();
                    document.getElementById('checkout-form').reset();

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
