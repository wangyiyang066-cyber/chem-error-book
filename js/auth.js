// js/auth.js (最终调试版)

const SUPABASE_URL = 'https://ghuyiwhqdellucjxqiwj.supabase.co'; 
const SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_KEY;

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
    showMessage('正在注册...');
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
    console.log('Login form submitted. Attempting to sign in...'); // 日志1：确认事件已触发
    showMessage('正在登录，请稍候...');

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    console.log('Supabase signIn response:', { data, error }); // 日志2：查看 Supabase 的返回结果

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