// js/auth.js (最终正确版)

// --- 配置：请再次确认这里的 Supabase 信息是正确的 ---
const SUPABASE_URL = '你从Supabase复制的项目网址'; // <<< 把你自己的 Supabase URL 粘贴在这里
const SUPABASE_ANON_KEY = '你从Supabase复制的anon public密钥'; // <<< 把你自己的 Supabase anon public 密钥粘贴在这里
// ----------------------------------------------------

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 获取页面上的所有元素
const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');
const messageDisplay = document.getElementById('message-display');
const showLoginLink = document.getElementById('show-login-link');
const showSignupLink = document.getElementById('show-signup-link');
const signupContainer = document.getElementById('signup-form-container');
const loginContainer = document.getElementById('login-form-container');

// 显示提示信息
function showMessage(message, isError = false) {
    messageDisplay.textContent = message;
    messageDisplay.style.display = 'block';
    messageDisplay.style.borderLeftColor = isError ? '#e74c3c' : '#2ecc71';
}

// 注册新用户
signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    const { data, error } = await supabaseClient.auth.signUp({ email, password });

    if (error) {
        showMessage(`注册失败: ${error.message}`, true);
    } else {
        showMessage('注册成功！请检查你的邮箱，点击确认链接来激活账户。');
    }
});

// 用户登录
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        showMessage(`登录失败: ${error.message}`, true);
    } else {
        showMessage('登录成功！正在跳转到主页...');
        // 登录成功后，跳转到 dashboard.html
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
    }
});

// 切换显示逻辑
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