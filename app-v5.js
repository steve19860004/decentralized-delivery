/**
 * 品勝去中心化外送協議 (TMA) - 前端核心邏輯 (Auth 加強版)
 */

const SUPABASE_URL = 'https://uaiqyaevuzescywylefo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhaXF5YWV2dXplc2N5d3lsZWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTI0MzYsImV4cCI6MjA4Nzc2ODQzNn0.DBzQDYg7Ff0oNeHEVgGwHDVUwBOn3E19P240lisQciI';

let supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 1. 狀態管理 (State)
// ==========================================
let currentUser = null; // Supabase Auth User
let profile = null;      // 來自 profiles 表的詳細資料

// ==========================================
// 2. UI 元素綁定
// ==========================================
const loginView = document.getElementById('login-view');
const restaurantView = document.getElementById('restaurant-view');
const masterView = document.getElementById('master-view');
const adminView = document.getElementById('admin-view');
const loadingOverlay = document.getElementById('loading-overlay');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const roleDisplay = document.getElementById('role-display');
const roleSelect = document.getElementById('role-select');

// 餐廳端、師傅端與管理員端元素
const orderForm = document.getElementById('order-form');
const orderDesc = document.getElementById('order-desc');
const orderAmount = document.getElementById('order-amount');
const restaurantHistory = document.getElementById('restaurant-history');
const jobPool = document.getElementById('job-pool');
const masterHistory = document.getElementById('master-history');
const adminAddUserForm = document.getElementById('admin-add-user');
const adminUserList = document.getElementById('admin-user-list');

console.log("App Version: 2.1.0 - Menu Gallery Edition");

// ==========================================
// 0. 故障保險 (Failsafe Watchdog)
// ==========================================
document.addEventListener("DOMContentLoaded", function () {
    console.log("DOM 載入完成，啟動 Watchdog...");
    setInterval(function () {
        var loadingObj = document.getElementById('loading-overlay');
        if (loadingObj && !loadingObj.classList.contains('hidden')) {
            var now = Date.now();
            if (!window._loadingStartTime) window._loadingStartTime = now;
            if (now - window._loadingStartTime > 7000) { // 放寬到 7 秒
                console.warn("Watchdog 觸發：強制關閉加載遮罩！");
                loadingObj.classList.add('hidden');
                window._loadingStartTime = null;

                var loginObj = document.getElementById('login-view');
                if (loginObj && loginObj.classList.contains('hidden')) {
                    loginObj.classList.remove('hidden');
                }
            }
        } else {
            window._loadingStartTime = null;
        }
    }, 500);
});

// ==========================================
// 3. 初始化 (主動獲取版，放棄被動監聽)
// ==========================================
async function init() {
    console.log("系統初始化 (主動狀態檢查)...");
    showLoading();

    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();

        if (error) {
            console.error("獲取初始 Session 失敗:", error);
            showLoginUI();
        } else if (session && session.user) {
            console.log("發現既有登入 Session:", session.user.email);
            await _performLoginFlow(session.user);
        } else {
            console.log("未登入狀態");
            showLoginUI();
        }
    } catch (err) {
        console.error("初始化嚴重錯誤:", err);
        showLoginUI();
    } finally {
        hideLoading();
    }

    // 綁定基礎事件
    try {
        if (loginForm) loginForm.addEventListener('submit', handleLogin);
        if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
        if (roleSelect) roleSelect.addEventListener('change', handleRoleSwitch);
        if (orderForm) orderForm.addEventListener('submit', handleNewOrder);
        if (orderAmount) orderAmount.addEventListener('input', calculatePreview);
        if (adminAddUserForm) adminAddUserForm.addEventListener('submit', handleAdminAddUser);

        // 綁定菜單上傳表單
        const menuForm = document.getElementById('menu-form');
        if (menuForm) menuForm.addEventListener('submit', handleMenuSubmit);

        calculatePreview();
    } catch (eventErr) {
        console.error("事件綁定失敗:", eventErr);
    }
}

// 獨立的登入後連動流程 (供 init 與 handleLogin 共用)
async function _performLoginFlow(user) {
    const errorMsg = document.getElementById('login-error');
    currentUser = user;

    if (errorMsg) {
        errorMsg.classList.remove('hidden');
        errorMsg.className = "text-center text-sm mt-4 text-green-700 font-bold bg-green-100 p-2 rounded";
        errorMsg.textContent = "3. [主動連動] 正在加載資料庫權限...";
    }

    try {
        const res = await supabaseClient.from('profiles').select('*').eq('user_id', currentUser.id).single();
        if (res.error) {
            if (errorMsg) errorMsg.innerHTML += "<br>⚠️ Profile讀取失敗: " + res.error.message;
            throw res.error;
        } else if (res.data) {
            profile = res.data;
            if (errorMsg) errorMsg.innerHTML += "<br>✅ 資料加載完成！即將進入主控台...";
        } else {
            throw new Error("無資料回傳");
        }
    } catch (e) {
        console.error("查無 Profile 或發生錯誤:", e);
        // 緊急模式 (修正 invalid syntax for uuid 錯誤)
        // 為了讓 Admin 可以正常執行 PostgreSQL (需要真實 UUID 格式寫入 restaurant_id)
        if (currentUser.email === 'steve19860004@gmail.com') {
            profile = {
                name: 'Steve (緊急管理模式)',
                role: 'admin',
                // 給一個全域 0 的合法 UUID，避免寫入 DB 崩潰
                id: '00000000-0000-0000-0000-000000000000'
            };
        } else {
            profile = { name: currentUser.email, role: 'none', id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' };
        }
    }

    updateRoleSelect();

    // 確保留一點時間讓使用者看到成功訊息
    return new Promise(resolve => {
        setTimeout(() => {
            if (errorMsg) errorMsg.classList.add('hidden');
            showMainUI();
            resolve();
        }, 1000);
    });
}

function updateRoleSelect() {
    if (!roleSelect) return;
    roleSelect.innerHTML = '';
    const roles = [];

    if (!profile) profile = { role: 'none', name: '未知' };

    if (profile.role === 'admin') {
        roles.push({ val: 'admin', text: '🛡️ 平台管理主控台' });
        roles.push({ val: 'restaurant', text: '🏪 模擬餐廳操作' });
        roles.push({ val: 'master', text: '🛵 模擬師傅操作' });
    } else if (profile.role === 'restaurant') {
        roles.push({ val: 'restaurant', text: `🏪 ${profile.name}` });
    } else if (profile.role === 'master') {
        roles.push({ val: 'master', text: `🛵 ${profile.name}` });
    } else {
        roles.push({ val: 'none', text: `🔒 等待審核: ${profile.name}` });
    }

    roles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.val;
        opt.textContent = r.text;
        roleSelect.appendChild(opt);
    });
}

// ==========================================
// 4. 視圖切換 (增加安全鎖)
// ==========================================
function showLoginUI() {
    console.log("切換至登入模式");
    loginView.classList.remove('hidden');
    restaurantView.classList.add('hidden');
    masterView.classList.add('hidden');
    adminView.classList.add('hidden');
    roleDisplay.classList.add('hidden');
    logoutBtn.classList.add('hidden');
}

function showMainUI() {
    console.log("切換至主導向介面");
    loginView.classList.add('hidden');
    roleDisplay.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    handleRoleSwitch();
}

async function handleRoleSwitch() {
    const activeRole = roleSelect.value;
    console.log(`正在切換角色視圖: ${activeRole}`);
    showLoading();

    try {
        restaurantView.classList.add('hidden');
        masterView.classList.add('hidden');
        adminView.classList.add('hidden');

        if (activeRole === 'admin') {
            adminView.classList.remove('hidden');
            await loadAdminData();
        } else if (activeRole === 'restaurant') {
            restaurantView.classList.remove('hidden');
            await loadRestaurantData();
        } else if (activeRole === 'master') {
            masterView.classList.remove('hidden');
            await loadMasterData();
        }
    } catch (err) {
        console.error("切換視圖發生錯誤:", err);
    } finally {
        hideLoading();
    }
}

// ==========================================
// 5. Auth Action (暴力主動版)
// ==========================================
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error');

    showLoading();
    errorMsg.classList.remove('hidden');
    errorMsg.className = "text-center text-sm mt-4 text-blue-600";
    errorMsg.textContent = "1. [API 要求中] 正在驗證登入憑證...";

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            console.error("Supabase 原始登入錯誤:", error);
            errorMsg.className = "text-center text-sm mt-4 text-red-500 bg-red-50 p-2 rounded";
            errorMsg.innerHTML = `
                <b>[API 拒絕]</b><br>
                錯誤類型: ${error.name}<br>
                詳細原因: ${error.message}<br>
                狀態碼: ${error.status || '無'}
            `;
            hideLoading();
            return;
        }

        // 登入 API 呼叫本身成功了！
        errorMsg.className = "text-center text-sm mt-4 text-green-600 font-bold bg-green-50 p-2 rounded";
        errorMsg.textContent = "2. [API 同意] 憑證正確！正在主動切換中...";

        // 【核心修改】不等待 onAuthStateChanged，直接主動呼叫進入主畫面
        await _performLoginFlow(data.user);
        hideLoading();
    } catch (err) {
        console.error("登入函式發生意外錯誤:", err);
        errorMsg.className = "text-center text-sm mt-4 text-red-500";
        errorMsg.textContent = "意外的客戶端錯誤: " + err.message;
        hideLoading();
    }
}

async function handleLogout() {
    showLoading();
    await supabaseClient.auth.signOut();
    currentUser = null;
    profile = null;
    showLoginUI();
    hideLoading();
}

// ==========================================
// 6. 管理員功能 (Admin Logic)
// ==========================================
async function loadAdminData() {
    const { data, error } = await supabaseClient.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) return;

    adminUserList.innerHTML = data.map(u => `
        <div class="bg-gray-50 p-3 rounded-lg flex justify-between items-center text-sm border border-gray-100 mb-2">
            <div>
                <div class="font-bold">${u.name}</div>
                <div class="text-xs text-gray-500">${u.role}</div>
            </div>
            <div class="text-gray-400 text-xs">${new Date(u.created_at).toLocaleDateString()}</div>
        </div>
    `).join('');
}

async function handleAdminAddUser(e) {
    e.preventDefault();
    const email = document.getElementById('new-user-email').value;
    const name = document.getElementById('new-user-name').value;
    const role = document.getElementById('new-user-role').value;
    const msg = document.getElementById('admin-msg');

    msg.textContent = "正在發送邀請...";

    // 註：這需要管理員權限
    const { data, error } = await supabaseClient.auth.admin.createUser({
        email: email,
        password: 'pingsheng1234',
        email_confirm: true,
        user_metadata: { full_name: name, role: role }
    });

    if (error) {
        msg.textContent = "失敗：" + error.message;
        msg.className = "text-xs text-center mt-2 text-red-500";
    } else {
        await supabaseClient.from('profiles').insert([{ user_id: data.user.id, name, role }]);
        msg.textContent = "成功建立！預設密碼為 pingsheng1234";
        msg.className = "text-xs text-center mt-2 text-green-500";
        loadAdminData();
    }
}

// ==========================================
// 7. 業務邏輯與菜單管理
// ==========================================
async function handleMenuSubmit(e) {
    e.preventDefault();
    if (!profile) return;

    const nameInput = document.getElementById('menu-name');
    const priceInput = document.getElementById('menu-price');
    const imageInput = document.getElementById('menu-image');
    const btn = document.getElementById('menu-submit-btn');
    const spinner = document.getElementById('menu-spinner');
    const msg = document.getElementById('menu-upload-msg');

    const name = nameInput.value;
    const price = Number(priceInput.value);
    const file = imageInput.files[0];

    // UI 切換至上傳中
    btn.disabled = true;
    spinner.classList.remove('hidden');
    msg.classList.remove('hidden');
    msg.className = "text-xs text-center mt-2 text-blue-600";
    msg.textContent = "上傳中，請稍候...";

    try {
        let imageUrl = null;

        // 如果有選圖片，先將圖片送上 Supabase Storage
        if (file) {
            // 檔名加上時間戳以確保唯一性
            const fileExt = file.name.split('.').pop();
            const fileName = `${profile.id}-${Date.now()}.${fileExt}`;

            msg.textContent = "正在將圖片送至雲端...";
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('menu-images')
                .upload(fileName, file, { upsert: false });

            if (uploadError) throw new Error("圖片上傳失敗: " + uploadError.message);

            // 取得公開下載網址
            const { data: publicUrlData } = supabaseClient.storage.from('menu-images').getPublicUrl(fileName);
            imageUrl = publicUrlData.publicUrl;
        }

        // 把菜單文字與圖片網址寫進資料庫
        msg.textContent = "正在寫入菜單資料庫...";
        const { error: dbError } = await supabaseClient.from('menus').insert([{
            restaurant_id: profile.id,
            item_name: name,
            price: price,
            image_url: imageUrl
        }]);

        if (dbError) throw new Error("資料庫寫入失敗: " + dbError.message);

        // 成功收尾
        msg.className = "text-xs text-center mt-2 text-green-600 font-bold";
        msg.textContent = "✅ 菜品上架成功！";
        document.getElementById('menu-form').reset();
        await loadRestaurantData(); // 重新整理畫面

    } catch (err) {
        console.error("菜單上傳流程發生錯誤:", err);
        msg.className = "text-xs text-center mt-2 text-red-500 font-bold";
        msg.textContent = "❌ " + err.message;
    } finally {
        // UI 復原
        btn.disabled = false;
        spinner.classList.add('hidden');
    }
}

async function handleNewOrder(e) {
    e.preventDefault();
    if (!profile) return;
    const desc = orderDesc.value;
    const amount = Number(orderAmount.value);

    showLoading();
    const { error } = await supabaseClient.from('jobs').insert([
        { restaurant_id: profile.id, description: desc, total_amount: amount }
    ]);

    if (error) alert('發佈失敗: ' + error.message);
    else {
        alert('✅ 訂單已發佈！');
        orderForm.reset();
        await loadRestaurantData();
    }
    hideLoading();
}

async function loadRestaurantData() {
    // 1. 讀取並渲染訂單歷史
    const { data: jobsData, error: jobsError } = await supabaseClient
        .from('jobs')
        .select(`id, description, total_amount, status, created_at, profiles!jobs_master_id_fkey(name)`)
        .eq('restaurant_id', profile.id)
        .order('created_at', { ascending: false });

    if (!jobsError) renderRestaurantHistory(jobsData);

    // 2. 讀取並渲染菜單小卡
    const { data: menuData, error: menuError } = await supabaseClient
        .from('menus')
        .select('*')
        .eq('restaurant_id', profile.id)
        .eq('is_available', true)
        .order('created_at', { ascending: false });

    if (!menuError) renderMenuGallery(menuData);
}

function renderMenuGallery(menus) {
    const gallery = document.getElementById('restaurant-menu-gallery');
    if (!gallery) return;

    if (!menus || menus.length === 0) {
        gallery.innerHTML = '<div class="col-span-2 text-center text-xs text-gray-500 py-6 bg-white rounded-lg shadow-sm border border-gray-100">現在還沒有任何菜色，請於上方新增 👇</div>';
        return;
    }

    gallery.innerHTML = menus.map(m => `
        <div class="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 flex flex-col">
            ${m.image_url
            ? `<div class="aspect-video w-full bg-gray-100 overflow-hidden relative">
                     <img src="${m.image_url}" alt="${m.item_name}" class="w-full h-full object-cover">
                   </div>`
            : `<div class="aspect-video w-full bg-indigo-50 flex items-center justify-center text-indigo-300 text-2xl">🍽️</div>`
        }
            <div class="p-3 flex-1 flex flex-col justify-between">
                <div class="font-bold text-gray-800 leading-tight mb-1 text-sm">${m.item_name}</div>
                <div class="text-indigo-600 font-black">$${m.price}</div>
            </div>
        </div>
    `).join('');
}

async function loadMasterData() {
    const { data: poolData } = await supabaseClient.from('jobs').select('*, profiles!jobs_restaurant_id_fkey(name)').eq('status', 'pending');
    renderJobPool(poolData);

    const { data: historyData } = await supabaseClient.from('jobs').select('*, profiles!jobs_restaurant_id_fkey(name)').eq('master_id', profile.id);
    renderMasterHistory(historyData);
}

function calculatePreview() {
    const amount = Number(document.getElementById('order-amount').value) || 0;
    const pNet = amount * 0.97;
    document.getElementById('preview-res').textContent = Math.floor(pNet * 0.75);
    document.getElementById('preview-drv').textContent = Math.floor(pNet * 0.20);
}

function renderRestaurantHistory(jobs) {
    const container = document.getElementById('restaurant-history');
    if (!jobs || jobs.length === 0) { container.innerHTML = '<div class="text-center text-gray-500 text-sm py-4 bg-white rounded-lg shadow-sm">尚無歷史訂單紀錄</div>'; return; }
    container.innerHTML = jobs.map(j => `
        <div class="p-3 bg-white rounded-lg shadow-sm text-sm border-l-4 border-blue-500 mb-2">
            <div class="font-bold flex justify-between"><span>${j.description}</span><span class="text-blue-600">$${j.total_amount}</span></div>
            <div class="text-xs text-gray-400 mt-1">${j.status} | 🛵 ${j.profiles ? j.profiles.name : '等待中'}</div>
        </div>
    `).join('');
}

function renderJobPool(jobs) {
    const container = document.getElementById('job-pool');
    if (!jobs || jobs.length === 0) { container.innerHTML = '<div class="text-center text-gray-500 py-4">目前全區無新任務可以接取</div>'; return; }
    container.innerHTML = jobs.map(j => `
        <div class="bg-white p-4 rounded-xl shadow border border-indigo-100 mb-3 hover:shadow-md transition">
            <div class="font-bold">${j.profiles ? j.profiles.name : '未知餐廳'} <span class="float-right text-indigo-600 font-extrabold">$${j.total_amount}</span></div>
            <div class="text-sm text-gray-600 my-2">${j.description}</div>
            <button onclick="acceptJob('${j.id}')" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-bold transition">🚀 馬上搶單</button>
        </div>
    `).join('');
}

function renderMasterHistory(jobs) {
    const container = document.getElementById('master-history');
    if (!jobs || jobs.length === 0) { container.innerHTML = '<div class="text-center text-gray-500 py-4">無接單紀錄，快去任務池看看吧！</div>'; return; }
    container.innerHTML = jobs.map(j => `
        <div class="p-3 bg-white rounded-lg shadow-sm mb-2 border-l-4 flex flex-col justify-between ${j.status === 'completed' ? 'border-green-500' : 'border-orange-400'}">
            <div class="font-bold flex justify-between"><span>${j.profiles ? j.profiles.name : '餐廳'}</span><span>$${Math.floor(j.total_amount * 0.19)}</span></div>
            <div class="text-xs text-gray-500 my-2">${j.description}</div>
            <div class="flex justify-between items-end mt-auto">
                <span class="text-xs text-gray-400">系統單號：${j.id.substring(0, 8)}</span>
                ${j.status === 'accepted' ? `<button onclick="completeJob('${j.id}')" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs transition font-bold shadow">✔ 標示完工</button>` : `<span class="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full text-xs font-bold border border-indigo-100">已結帳打單</span>`}
            </div>
        </div>
    `).join('');
}

window.acceptJob = async function (id) {
    const { error } = await supabaseClient.from('jobs').update({ status: 'accepted', master_id: profile.id }).eq('id', id).eq('status', 'pending');
    if (error) alert("搶單失敗！此單可能已被別的師傅搶走！"); else loadMasterData();
};

window.completeJob = async function (id) {
    const { error } = await supabaseClient.from('jobs').update({ status: 'completed' }).eq('id', id);
    if (error) alert("更新失敗！可能權限不足或連線異常。"); else loadMasterData();
};

function showLoading() { loadingOverlay.classList.remove('hidden'); }
function hideLoading() { loadingOverlay.classList.add('hidden'); }

// 啟動點
init();
