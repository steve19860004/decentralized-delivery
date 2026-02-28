/**
 * 品勝去中心化外送協議 (TMA) - 前端核心邏輯
 */

// ==========================================
// 1. Supabase 初始化設定 (請替換為您的真實憑證)
// ==========================================
// 根據使用者提供的截圖與說明，您可以在 Project Settings -> API 中找到這兩個值：
// URL = Project URL
// KEY = Publishable key (sb_publishable_...) 
const SUPABASE_URL = 'https://uaiqyaevuzescywylefo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhaXF5YWV2dXplc2N5d3lsZWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTI0MzYsImV4cCI6MjA4Nzc2ODQzNn0.DBzQDYg7Ff0oNeHEVgGwHDVUwBOn3E19P240lisQciI';



// === 預設模式（為了讓您不填入也能看到純畫面，如果不填正確會切換為假資料預覽模式） ===
let supabaseClient = null;
let isDemoMode = false;

try {
    if (SUPABASE_URL.startsWith('http')) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        isDemoMode = true;
        console.warn("未偵測到真實 Supabase 憑證，進入 UI 預覽模式");
    }
} catch (e) {
    console.error(e);
    isDemoMode = true;
}


// ==========================================
// 2. 狀態管理 (State)
// ==========================================
let currentUserId = null;
let currentUserRole = null;
let currentUserName = null;

// ==========================================
// 3. UI 元素綁定
// ==========================================
const roleSelect = document.getElementById('role-select');
const restaurantView = document.getElementById('restaurant-view');
const masterView = document.getElementById('master-view');
const loadingOverlay = document.getElementById('loading-overlay');

// 餐廳端元素
const orderForm = document.getElementById('order-form');
const orderDesc = document.getElementById('order-desc');
const orderAmount = document.getElementById('order-amount');
const quickMenu = document.getElementById('quick-menu');
const menuItems = document.getElementById('menu-items');
const previewRes = document.getElementById('preview-res');
const previewDrv = document.getElementById('preview-drv');
const restaurantHistory = document.getElementById('restaurant-history');

// 師傅端元素
const masterScore = document.getElementById('master-score');
const masterSuccessRate = document.getElementById('master-success-rate');
const masterAvgRating = document.getElementById('master-avg-rating');
const jobPool = document.getElementById('job-pool');
const masterHistory = document.getElementById('master-history');


// ==========================================
// 4. 初始化與載入
// ==========================================
async function init() {
    showLoading();
    await loadProfiles();
    hideLoading();

    // 綁定事件
    roleSelect.addEventListener('change', handleRoleChange);
    orderForm.addEventListener('submit', handleNewOrder);
    orderAmount.addEventListener('input', calculatePreview);
}

// 讀取 Supabase 的 Profiles 以供切換身份
async function loadProfiles() {
    if (isDemoMode) {
        // 假資料預覽模式
        populateRoleSelect([
            { id: 'r1', name: '內湖老王牛肉麵', role: 'restaurant' },
            { id: 'm1', name: '阿慶 (資深冷氣師傅)', role: 'master' }
        ]);
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('id, name, role')
            .order('role', { ascending: false }); // 讓 restaurant 排前面

        if (error) throw error;
        populateRoleSelect(data);

    } catch (error) {
        console.error('Error loading profiles:', error);
        alert('無法載入使用者資料，請確認 Supabase 憑證是否正確！');
    }
}

function populateRoleSelect(profiles) {
    roleSelect.innerHTML = '';
    profiles.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.dataset.role = p.role;
        option.dataset.name = p.name;
        option.textContent = `${p.role === 'restaurant' ? '🏪' : '🛵'} ${p.name}`;
        roleSelect.appendChild(option);
    });

    // 觸發初次載入
    handleRoleChange();
}

// ==========================================
// 5. 視圖切換與資料載入
// ==========================================
async function handleRoleChange() {
    const selectedOption = roleSelect.options[roleSelect.selectedIndex];
    currentUserId = selectedOption.value;
    currentUserRole = selectedOption.dataset.role;
    currentUserName = selectedOption.dataset.name;

    showLoading();

    if (currentUserRole === 'restaurant') {
        masterView.classList.add('hidden');
        restaurantView.classList.remove('hidden');
        await loadRestaurantData();
    } else if (currentUserRole === 'master') {
        restaurantView.classList.add('hidden');
        masterView.classList.remove('hidden');
        await loadMasterData();
    }

    hideLoading();
}

// --- 餐廳邏輯 ---
// ==========================================
// 4.5 餐廳菜單資料
// ==========================================
const RESTAURANT_MENUS = {
    // 內湖老王牛肉麵
    '11111111-1111-1111-1111-111111111111': [
        { name: '招牌紅燒牛肉麵', price: 180 },
        { name: '清燉半筋半肉麵', price: 220 },
        { name: '燙青菜', price: 40 },
        { name: '綜合涼拌小菜', price: 60 }
    ],
    // 港墘路阿姨便當
    '22222222-2222-2222-2222-222222222222': [
        { name: '炸排骨飯', price: 110 },
        { name: '滷雞腿飯', price: 120 },
        { name: '雙主菜便當', price: 150 },
        { name: '煎虱目魚肚', price: 130 }
    ],
    // 瑞光路健康餐盒
    '33333333-3333-3333-3333-333333333333': [
        { name: '舒肥雞胸溫沙拉', price: 160 },
        { name: '鹽烤鮭魚花椰菜飯', price: 200 },
        { name: '低GI牛腱餐盒', price: 180 }
    ],
    // Demo mode default
    'r1': [
        { name: '招牌紅燒牛肉麵', price: 180 },
        { name: '燙青菜', price: 40 }
    ]
};

function loadMenu() {
    // 若找不到對應 UUID 的菜單，預設給老王牛肉麵的菜單
    const menu = RESTAURANT_MENUS[currentUserId] || RESTAURANT_MENUS['11111111-1111-1111-1111-111111111111'] || RESTAURANT_MENUS['r1'];

    orderDesc.value = '';
    orderAmount.value = '';
    calculatePreview();

    if (menu) {
        quickMenu.classList.remove('hidden');
        menuItems.innerHTML = menu.map(item => `
            <button type="button" onclick="addMenuItem('${item.name}', ${item.price})" class="text-left bg-white border border-gray-200 p-2 rounded-lg hover:bg-blue-50 hover:border-blue-400 focus:bg-blue-50 transition drop-shadow-sm active:scale-95">
                <div class="font-bold text-gray-800 text-sm truncate">${item.name}</div>
                <div class="text-blue-600 font-bold">$${item.price}</div>
            </button>
        `).join('');
    } else {
        quickMenu.classList.add('hidden');
    }
}

window.addMenuItem = function (name, price) {
    let currentDesc = orderDesc.value;
    let currentAmount = Number(orderAmount.value) || 0;

    if (currentDesc) {
        orderDesc.value = currentDesc + ' + ' + name;
    } else {
        orderDesc.value = name;
    }

    orderAmount.value = currentAmount + price;
    calculatePreview();
}

window.clearMenu = function () {
    orderDesc.value = '';
    orderAmount.value = '';
    calculatePreview();
}

function calculatePreview() {
    const amount = Number(orderAmount.value) || 0;
    // Pnet = amount * 0.97 (扣除 3% 金流)
    const pNet = amount * 0.97;
    previewRes.textContent = Math.floor(pNet * 0.75);
    previewDrv.textContent = Math.floor(pNet * 0.20);
}

async function handleNewOrder(e) {
    e.preventDefault();
    const desc = orderDesc.value;
    const amount = Number(orderAmount.value);

    if (isDemoMode) {
        alert("UI 預覽模式：發單成功！（重新整理將會消失）");
        orderForm.reset();
        calculatePreview();
        return;
    }

    showLoading();
    try {
        const { error } = await supabaseClient
            .from('jobs')
            .insert([
                { restaurant_id: currentUserId, description: desc, total_amount: amount }
            ]);

        if (error) throw error;

        alert('✅ 訂單已發送到去中心化網路！');
        orderForm.reset();
        calculatePreview();
        await loadRestaurantData(); // 重新載入歷史
    } catch (error) {
        console.error('Error creating order:', error);
        alert('發佈失敗: ' + error.message);
    }
    hideLoading();
}

async function loadRestaurantData() {
    loadMenu();

    if (isDemoMode) {
        restaurantHistory.innerHTML = `<div class="p-3 bg-white rounded-lg shadow-sm text-sm border-l-4 border-blue-500">
            <div class="font-bold flex justify-between"><span>招牌牛肉麵 x 2</span><span class="text-blue-600">$400</span></div>
            <div class="text-gray-500 mt-1 flex justify-between"><span>狀態: completed</span><span>阿慶 (資深冷氣師傅)</span></div>
        </div>`;
        return;
    }

    const { data, error } = await supabaseClient
        .from('jobs')
        .select(`
            id, description, total_amount, status, created_at,
            profiles!jobs_master_id_fkey(name)
        `)
        .eq('restaurant_id', currentUserId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading history:', error);
        return;
    }

    renderRestaurantHistory(data);
}

function renderRestaurantHistory(jobs) {
    if (!jobs || jobs.length === 0) {
        restaurantHistory.innerHTML = '<div class="text-center text-gray-500 text-sm py-4">尚無訂單紀錄</div>';
        return;
    }

    const html = jobs.map(j => {
        const masterName = j.profiles ? j.profiles.name : '等待接單中...';
        const statusMap = {
            'pending': '<span class="text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded text-xs ml-2">等待中</span>',
            'accepted': '<span class="text-blue-600 bg-blue-100 px-2 py-0.5 rounded text-xs ml-2">運送中</span>',
            'completed': '<span class="text-green-600 bg-green-100 px-2 py-0.5 rounded text-xs ml-2">已完工</span>'
        };
        const statusHtml = statusMap[j.status] || `<span class="text-gray-600 bg-gray-100 px-2 py-0.5 rounded text-xs ml-2">${j.status}</span>`;

        return `
        <div class="p-3 bg-white rounded-lg shadow-sm text-sm border-l-4 border-blue-500">
            <div class="font-bold flex justify-between items-center">
                <span>${j.description} ${statusHtml}</span>
                <span class="text-blue-600 font-black">$${j.total_amount}</span>
            </div>
            <div class="text-gray-500 mt-1 flex justify-between">
                <span>${new Date(j.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</span>
                <span>🛵 ${masterName}</span>
            </div>
        </div>
        `;
    }).join('');

    restaurantHistory.innerHTML = html;
}

// --- 師傅邏輯 ---
async function loadMasterData() {
    if (isDemoMode) {
        masterScore.textContent = '200';
        masterSuccessRate.textContent = '100%';
        masterAvgRating.innerHTML = '5.0 <span class="text-yellow-400">★</span>';
        jobPool.innerHTML = `<div class="bg-white p-4 rounded-xl shadow-md border-2 border-indigo-100 job-card">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded mb-1 inline-block">新任務</span>
                    <h4 class="font-bold text-lg">內湖老王牛肉麵</h4>
                </div>
                <div class="text-right">
                    <div class="text-gray-500 text-xs">客戶實付</div>
                    <div class="font-black text-xl text-gray-800">$400</div>
                </div>
            </div>
            <div class="text-sm text-gray-700 mb-4 bg-gray-50 p-2 rounded">備註: 鍋燒麵 x1, 滷肉飯 x2</div>
            <div class="flex items-center justify-between">
                <div class="text-sm">跑此單淨賺: <span class="font-bold text-green-600 text-lg">$77</span></div>
                <button onclick="alert('UI預覽模式')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-bold shadow-sm transition active:scale-95">馬上搶單</button>
            </div>
        </div>`;
        return;
    }

    try {
        // 1. 取得信用排名資料 (從 view 取得)
        const { data: rankData, error: rankError } = await supabaseClient
            .from('driver_reputation_ranking')
            .select('*')
            .eq('id', currentUserId)
            .single();

        if (rankError && rankError.code !== 'PGRST116') { // 無資料時不是錯誤，可能是真的完全沒單的新人
            console.error('Error loading rank:', rankError);
        } else if (rankData) {
            masterScore.textContent = Number(rankData.reputation_score).toFixed(1);
            masterSuccessRate.textContent = Number(rankData.success_rate).toFixed(0) + '%';
            masterAvgRating.innerHTML = `${Number(rankData.avg_rating).toFixed(1)} <span class="text-yellow-400">★</span>`;
        } else {
            // 完全新人的預設顯示
            masterScore.textContent = '150.0';
            masterSuccessRate.textContent = '0%';
            masterAvgRating.innerHTML = `5.0 <span class="text-yellow-400">★</span>`;
        }

        // 2. 獲取可接單任務 (狀態為 pending)
        const { data: poolData, error: poolError } = await supabaseClient
            .from('jobs')
            .select(`
                id, description, total_amount, created_at,
                profiles!jobs_restaurant_id_fkey(name)
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (poolError) throw poolError;
        renderJobPool(poolData);

        // 3. 獲取歷史任務
        const { data: historyData, error: historyError } = await supabaseClient
            .from('jobs')
            .select(`id, description, total_amount, status, created_at, profiles!jobs_restaurant_id_fkey(name)`)
            .eq('master_id', currentUserId)
            .order('created_at', { ascending: false });

        if (historyError) throw historyError;
        renderMasterHistory(historyData);

    } catch (e) {
        console.error("載入師傅資料失敗", e);
    }
}

function renderJobPool(jobs) {
    if (!jobs || jobs.length === 0) {
        jobPool.innerHTML = `
        <div class="text-center text-gray-500 py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <div class="text-4xl mb-2">☕</div>
            <p>目前內科無人發單</p>
            <p class="text-xs mt-1">稍微休息一下，喝口水吧！</p>
        </div>`;
        return;
    }

    const html = jobs.map(j => {
        const resName = j.profiles ? j.profiles.name : '未知餐廳';
        // 計算這筆單師傅能賺多少 (20%)
        const drvPayout = Math.floor(j.total_amount * 0.97 * 0.20);

        return `
        <div class="bg-white p-4 rounded-xl shadow border-2 border-indigo-100 job-card">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded mb-1 inline-block">新任務</span>
                    <h4 class="font-bold text-lg">${resName}</h4>
                </div>
                <div class="text-right">
                    <div class="text-gray-500 text-xs">客戶實付</div>
                    <div class="font-black text-xl text-gray-800">$${j.total_amount}</div>
                </div>
            </div>
            
            <div class="text-sm text-gray-700 mb-4 bg-gray-50 p-2 rounded">
                內容: ${j.description}
            </div>
            
            <div class="flex items-center justify-between">
                <div class="text-sm">跑此單淨賺: <span class="font-bold text-green-600 text-lg">$${drvPayout}</span></div>
                <button onclick="acceptJob('${j.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-bold shadow-sm transition active:scale-95">
                    马上搶單
                </button>
            </div>
        </div>`;
    }).join('');

    jobPool.innerHTML = html;
}

function renderMasterHistory(jobs) {
    if (!jobs || jobs.length === 0) {
        masterHistory.innerHTML = '<div class="text-center text-gray-500 text-sm py-4">無歷史紀錄</div>';
        return;
    }

    const html = jobs.map(j => {
        const resName = j.profiles ? j.profiles.name : '餐廳';
        return `
        <div class="p-3 bg-white rounded-lg shadow-sm text-sm border-l-4 ${j.status === 'completed' ? 'border-green-500' : 'border-gray-400'}">
            <div class="font-bold flex justify-between">
                <span>${resName}</span>
                <span class="text-green-600">$${Math.floor(j.total_amount * 0.97 * 0.2)} (報酬)</span>
            </div>
            <div class="text-gray-500 mt-1 flex justify-between items-center">
                <span>${j.description}</span>
                ${j.status === 'completed'
                ? '<span class="text-green-600 bg-green-100 px-2 rounded text-xs">已結算</span>'
                : '<button onclick="completeJob(\'' + j.id + '\')" class="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600 shadow">標示為完工</button>'}
            </div>
        </div>
        `;
    }).join('');

    masterHistory.innerHTML = html;
}


// --- API Actions ---
window.acceptJob = async function (jobId) {
    if (!confirm("確定要接這單嗎？")) return;

    showLoading();
    try {
        const { error } = await supabaseClient
            .from('jobs')
            .update({ status: 'accepted', master_id: currentUserId })
            .eq('id', jobId)
            .eq('status', 'pending'); // 併發控制：確保只有它是 pending 才能搶到

        if (error) throw error;
        alert("🎉 搶單成功！請盡速前往餐廳。");
        await loadMasterData();
    } catch (e) {
        alert("搶單失敗，可能已經被其他師傅搶走了！");
    }
    hideLoading();
}

window.completeJob = async function (jobId) {
    if (!confirm("確定餐點已送達並完工嗎？（這將觸發後台分潤金流）")) return;

    showLoading();
    try {
        const { error } = await supabaseClient
            .from('jobs')
            .update({ status: 'completed' })
            .eq('id', jobId);

        if (error) throw error;
        alert("✅ 完工！這筆單的分潤已紀錄至去中心化帳本。");
        await loadMasterData(); // 會觸發包含重新計算分數
    } catch (e) {
        alert("更新狀態失敗！");
    }
    hideLoading();
}

// Helpers
function showLoading() { loadingOverlay.classList.remove('hidden'); }
function hideLoading() { loadingOverlay.classList.add('hidden'); }

// 啟動
init();
