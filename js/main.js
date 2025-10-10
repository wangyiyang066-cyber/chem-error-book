// js/main.js (全局“保安”脚本)

// --- 配置：请仔细替换成你自己的 Supabase 信息 ---
const SUPABASE_URL = 'https://ghuyiwhqdellucjxqiwj.supabase.co'; // <<< 把你自己的 Supabase URL 粘贴在这里
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodXlpd2hxZGVsbHVjanhxaXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzQwOTQsImV4cCI6MjA3MzAxMDA5NH0.toJ68-C9Kq_GmD_pGiXLH5_TK7MhawdBsdCv1FP-TVk';
// ----------------------------------------------------

// 初始化 Supabase 客户端，并让它在全局可用
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let user = null; // 在全局范围定义 user 变量

// 自定义一个事件，用来通知其他脚本“用户信息已准备好”
const userReadyEvent = new Event('userReady');

// 监听用户认证状态的变化
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
        // 如果用户已登录
        user = session.user; // 将获取到的用户信息赋值给全局 user 变量
        console.log("用户已登录:", user.email);
        
        // 派发事件，通知其他脚本可以开始工作了
        document.dispatchEvent(userReadyEvent);
        
        // (可选) 在页面顶部显示用户信息和退出按钮
        displayUserStatus();

    } else {
        // 如果用户未登录
        user = null;
        console.log("用户未登录，正在跳转到登录页...");
        // 如果当前页面不是登录页，则强制跳转回登录页
        if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
             window.location.href = 'index.html';
        }
    }
});

// (可选) 显示用户状态的函数
function displayUserStatus() {
    // 检查页面上是否已存在 user-status 容器，如果没有就创建一个
    let userStatusContainer = document.getElementById('user-status');
    if (!userStatusContainer) {
        userStatusContainer = document.createElement('div');
        userStatusContainer.id = 'user-status';
        userStatusContainer.classList.add('user-status');
        document.body.prepend(userStatusContainer);
        
        const style = document.createElement('style');
        style.textContent = `
            .user-status { background-color: #2c3e50; color: white; padding: 10px; text-align: center; font-size: 0.9em; }
            .user-status a { color: #3498db; text-decoration: none; }
            .user-status a:hover { text-decoration: underline; }
        `;
        document.head.append(style);
    }

    if (user) {
        userStatusContainer.innerHTML = `
            <p>
                欢迎回来, ${user.email} | 
                <a href="#" id="logout-button">退出登录</a>
            </p>
        `;
        document.getElementById('logout-button').addEventListener('click', async (e) => {
            e.preventDefault();
            await supabaseClient.auth.signOut();
            window.location.href = 'index.html';
        });
    }
}