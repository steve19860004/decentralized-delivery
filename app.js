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

console.log("App Version: 2.0.1 - Security Update");

// ==========================================
// 3. 初始化與身份監聽 (加強穩定性)
// ==========================================
async function init() {
    console.log("初始化開始...");
    showLoading();

    // Fail-safe: 如果 5 秒後還在轉圈圈，強行關閉它
    setTimeout(() => {
        if (!loadingOverlay.classList.contains('hidden')) {
            console.warn("載入超時，強制關閉 Overlay");
            hideLoading();
        }
    }, 5000);

    try {
        // 1. 先確認目前是否有 Session
        console.log("正在檢查 Session...");
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

        if (sessionError) throw sessionError;

        if (session) {
            console.log("偵測到已登入帳號:", session.user.email);
            currentUser = session.user;
            await loadUserProfile();
            showMainUI();
        } else {
            console.log("未登入，切換至登入模式");
            showLoginUI();
        }
    } catch (e) {
        console.error("初始化發生致命錯誤:", e);
        showLoginUI(); // 報錯也強行跳到登入，讓使用者至少能看到介面
    } finally {
        hideLoading();
    }

    // 2. 監聽後續的 Auth 狀態變化
    supabaseClient.auth.onAuthStateChanged(async (event, session) => {
        console.log("Auth 狀態變更:", event);
        if (event === 'SIGNED_IN' && session) {
            showLoading();
            currentUser = session.user;
            await loadUserProfile();
            showMainUI();
            hideLoading();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            profile = null;
            showLoginUI();
        }
    });

    // 綁定基礎事件
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    roleSelect.addEventListener('change', handleRoleSwitch);
    orderForm.addEventListener('submit', handleNewOrder);
    orderAmount.addEventListener('input', calculatePreview);
    if (adminAddUserForm) adminAddUserForm.addEventListener('submit', handleAdminAddUser);

    calculatePreview();
}

async function loadUserProfile() {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

    if (!error && data) {
        profile = data;
        updateRoleSelect();
    } else {
        console.error("查無 Profile:", error);
        profile = { name: currentUser.email, role: 'none' };
        updateRoleSelect();
    }
}

function updateRoleSelect() {
    roleSelect.innerHTML = '';
    const roles = [];

    if (profile.role === 'admin') {
        roles.push({ id: 'admin', name: '平台管理主控台', role: 'admin' });
        roles.push({ id: 'restaurant_mode', name: '模擬餐廳操作', role: 'restaurant' });
        roles.push({ id: 'master_mode', name: '模擬師傅操作', role: 'master' });
    } else {
        roles.push({ id: profile.id, name: profile.name, role: profile.role });
    }

    roles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.role;
        opt.textContent = `${r.role === 'admin' ? '🛡️' : (r.role === 'restaurant' ? '🏪' : '🛵')} ${r.name}`;
        roleSelect.appendChild(opt);
    });
}

// ==========================================
// 4. 視圖切換
// ==========================================
function showLoginUI() {
    loginView.classList.remove('hidden');
    restaurantView.classList.add('hidden');
    masterView.classList.add('hidden');
    adminView.classList.add('hidden');
    roleDisplay.classList.add('hidden');
    logoutBtn.classList.add('hidden');
}

function showMainUI() {
    loginView.classList.add('hidden');
    roleDisplay.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    handleRoleSwitch();
}

async function handleRoleSwitch() {
    const activeRole = roleSelect.value;
    showLoading();

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

    hideLoading();
}

// ==========================================
// 5. Auth Action
// ==========================================
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error');

    showLoading();
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        errorMsg.textContent = "登入失敗：" + error.message;
        errorMsg.classList.remove('hidden');
        hideLoading();
    }
}

async function handleLogout() {
    showLoading();
    await supabaseClient.auth.signOut();
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
// 7. 業務邏輯
// ==========================================
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
    const { data, error } = await supabaseClient
        .from('jobs')
        .select(`id, description, total_amount, status, created_at, profiles!jobs_master_id_fkey(name)`)
        .eq('restaurant_id', profile.id)
        .order('created_at', { ascending: false });

    if (!error) renderRestaurantHistory(data);
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
    if (!jobs || jobs.length === 0) { container.innerHTML = '<div class="text-center text-gray-500 text-sm py-4">尚無訂單</div>'; return; }
    container.innerHTML = jobs.map(j => `
        <div class="p-3 bg-white rounded-lg shadow-sm text-sm border-l-4 border-blue-500 mb-2">
            <div class="font-bold flex justify-between"><span>${j.description}</span><span class="text-blue-600">$${j.total_amount}</span></div>
            <div class="text-xs text-gray-400 mt-1">${j.status} | 🛵 ${j.profiles ? j.profiles.name : '等待中'}</div>
        </div>
    `).join('');
}

function renderJobPool(jobs) {
    const container = document.getElementById('job-pool');
    if (!jobs || jobs.length === 0) { container.innerHTML = '<div class="text-center text-gray-500 py-4">無新任務</div>'; return; }
    container.innerHTML = jobs.map(j => `
        <div class="bg-white p-4 rounded-xl shadow border border-indigo-100 mb-3">
            <div class="font-bold">${j.profiles ? j.profiles.name : '未知餐廳'} <span class="float-right text-indigo-600">$${j.total_amount}</span></div>
            <div class="text-sm text-gray-600 my-2">${j.description}</div>
            <button onclick="acceptJob('${j.id}')" class="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold">馬上搶單</button>
        </div>
    `).join('');
}

function renderMasterHistory(jobs) {
    const container = document.getElementById('master-history');
    if (!jobs || jobs.length === 0) { container.innerHTML = '<div class="text-center text-gray-500 py-4">無接單紀錄</div>'; return; }
    container.innerHTML = jobs.map(j => `
        <div class="p-3 bg-white rounded-lg shadow-sm mb-2 border-l-4 ${j.status === 'completed' ? 'border-green-500' : 'border-orange-400'}">
            <div class="font-bold flex justify-between"><span>${j.profiles ? j.profiles.name : '餐廳'}</span><span>$${Math.floor(j.total_amount * 0.19)}</span></div>
            <div class="flex justify-between items-center mt-2">
                <span class="text-xs text-gray-400">${j.description}</span>
                ${j.status === 'accepted' ? `<button onclick="completeJob('${j.id}')" class="bg-green-500 text-white px-3 py-1 rounded text-xs">完工</button>` : `<span class="text-green-600 text-xs">已結算</span>`}
            </div>
        </div>
    `).join('');
}

window.acceptJob = async function (id) {
    const { error } = await supabaseClient.from('jobs').update({ status: 'accepted', master_id: profile.id }).eq('id', id).eq('status', 'pending');
    if (error) alert("搶單失敗！可能是已被搶走或權限不足"); else loadMasterData();
};

window.completeJob = async function (id) {
    const { error } = await supabaseClient.from('jobs').update({ status: 'completed' }).eq('id', id);
    if (error) alert("更新失敗！"); else loadMasterData();
};

function showLoading() { loadingOverlay.classList.remove('hidden'); }
function hideLoading() { loadingOverlay.classList.add('hidden'); }

init();
