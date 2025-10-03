// js/auth.js (最终检查版)

// --- 配置：请仔细替换成你自己的 Supabase 信息 ---
const SUPABASE_URL = 'https://ghuyiwhqdellucjxqiwj.supabase.co'; // <<< 把你自己的 Supabase URL 粘贴在这里
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodXlpd2hxZGVsbHVjanhxaXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQzNDA5NCwiZXhwIjoyMDczMDEwMDk0fQ.op6RPiEDsjSnwy5yMRq3Got0dfLzPxGKWc0PFa8D5Go'; // <<< 把你自己的 Supabase anon public 密钥粘贴在这里
// ----------------------------------------------------

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');
const messageDisplay = document.getElementById('message-display');
const showLoginLink = document.getElementById('show-login-link');
const showSignupLink = document.getElementById('show-signup-link');
const signupContainer = document.getElementById('signup-form-container');
const loginContainer = document.getElementById('login-form-container');

function showMessage(message, isError = false) {
    messageDisplay.textContent = message;
    messageDisplay.style.display = 'block';
    messageDisplay.style.borderLeftColor = isError ? '#e74c3c' : '#2ecc71';
}

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

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        showMessage(`登录失败: ${error.message}`, true);
    } else {
        showMessage('登录成功！正在跳转到主页...');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
    }
});

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