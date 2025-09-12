// js/auth.js

// --- 配置：请替换成你自己的 Supabase 信息 ---
const SUPABASE_URL = 'https://ghuyiwhqdellucjxqiwj.supabase.co'; // 替换这里
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodXlpd2hxZGVsbHVjanhxaXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzQwOTQsImV4cCI6MjA3MzAxMDA5NH0.toJ68-C9Kq_GmD_pGiXLH5_TK7MhawdBsdCv1FP-TVk'; // 替换这里
// -----------------------------------------

// 初始化 Supabase 客户端
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 获取页面上的所有元素
const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');
const messageDisplay = document.getElementById('message-display');
const showLoginLink = document.getElementById('show-login-link');
const showSignupLink = document.getElementById('show-signup-link');
const signupContainer = document.getElementById('signup-form-container');
const loginContainer = document.getElementById('login-form-container');

// --- 功能函数 ---

// 显示提示信息
function showMessage(message, isError = false) {
    messageDisplay.textContent = message;
    messageDisplay.style.display = 'block';
    messageDisplay.style.borderLeftColor = isError ? '#e74c3c' : '#2ecc71';
}

// 注册新用户
signupForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // 阻止表单默认的提交行为
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
        showMessage(`注册失败: ${error.message}`, true);
    } else {
        showMessage('注册成功！请检查你的邮箱，点击确认链接来激活账户。');
        // Supabase 默认会发送一封确认邮件
    }
});

// 用户登录
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        showMessage(`登录失败: ${error.message}`, true);
    } else {
        showMessage('登录成功！正在跳转到主页...');
        // 登录成功后，跳转到主页
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
    }
});


// --- 切换显示逻辑 ---
showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginContainer.style.display = 'block';
    signupContainer.style.display = 'none';
    messageDisplay.style.display = 'none';
});

showSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    signupContainer.style.display = 'block';
    loginContainer.style.display = 'none';
    messageDisplay.style.display = 'none';
});