// js/my-errors.js - 独立重构版

// 使用立即执行函数，避免污染全局作用域
(async function() {
    console.log("🚀 错题本模块正在初始化...");

    // 1. 定义 Supabase 配置 (局部变量，安全！)
    const SUPABASE_URL = "https://ghuyiwhqdellucjxqiwj.supabase.co"; 
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodXlpd2hxZGVsbHVjanhxaXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzQwOTQsImV4cCI6MjA3MzAxMDA5NH0.toJ68-C9Kq_GmD_pGiXLH5_TK7MhawdBsdCv1FP-TVk';

    // 2. 初始化局部 Supabase 客户端 (确保可用)
    let client;
    try {
        if (typeof supabase !== 'undefined') {
            client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        } else {
            throw new Error("Supabase SDK 未加载");
        }
    } catch (e) {
        console.error("❌ 严重错误: 无法加载 Supabase，请检查网络。", e);
        document.body.innerHTML = "<h2 style='text-align:center; margin-top:50px'>网络连接失败，无法加载数据库 SDK。</h2>";
        return;
    }

    // 3. 获取当前用户 (双重保险机制)
    let currentUser = window.user;
    if (!currentUser) {
        console.log("⚠️ 全局用户未就绪，正在主动查询...");
        const { data, error } = await client.auth.getUser();
        if (error || !data.user) {
            console.warn("❌ 未登录，跳转回登录页");
            // window.location.href = 'login.html'; // 如果需要强制跳转取消注释
            document.querySelector('.container').innerHTML = "<h2>请先登录</h2><a href='login.html'>去登录</a>";
            return;
        }
        currentUser = data.user;
        console.log("✅ 用户身份已确认:", currentUser.email);
    }

    // 4. 获取页面元素
    const reviewListEl = document.getElementById('review-queue-list');
    const allListEl = document.getElementById('all-errors-list');
    const reviewCountEl = document.getElementById('review-count');
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    let isAllErrorsLoaded = false;

    // --- 辅助函数：渲染图片 ---
    function renderImages(urls) {
        if (!urls || !Array.isArray(urls) || urls.length === 0) return '';
        return `<div style="margin-top:8px;">${urls.map(url => 
            `<img src="${url}" onclick="window.open(this.src)" style="height:60px; margin-right:5px; border-radius:4px; border:1px solid #ddd; cursor:zoom-in;">`
        ).join('')}</div>`;
    }

    // --- 核心功能 A: 加载复习队列 ---
    async function loadReview() {
        console.log("📥 正在加载复习队列...");
        try {
            const res = await fetch('/.netlify/functions/get-review-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id })
            });
            
            if (!res.ok) throw new Error("API 请求失败");
            const data = await res.json();
            
            reviewListEl.innerHTML = '';
            if (reviewCountEl) reviewCountEl.innerText = data ? data.length : 0;

            if (!data || data.length === 0) {
                reviewListEl.innerHTML = '<div style="text-align:center; padding:30px; color:#aaa;"><i class="fas fa-check-circle" style="font-size:3em; color:#2ecc71; margin-bottom:10px;"></i><p>恭喜！当前没有需要复习的题目。</p></div>';
                return;
            }

            data.forEach(item => {
                const q = item.questions;
                if (!q) return; // 跳过已删除的题目

                const div = document.createElement('a');
                div.className = 'error-item';
                div.href = `quiz.html?mode=review&questionId=${q.id}&reviewId=${item.id}`;
                div.dataset.repetitions = item.repetitions || 0;

                const cleanQuestion = (q.full_question || "题目内容缺失").replace(/\[question\]\d+(\.\d+)*\s*/, '');
                
                div.innerHTML = `
                    <div style="font-weight:600; font-size:1.05em; margin-bottom:5px;">${cleanQuestion}</div>
                    ${renderImages(q.image_urls)}
                    <div style="font-size:0.85em; color:#999; margin-top:8px; display:flex; justify-content:space-between;">
                        <span><i class="fas fa-redo"></i> 已复习 ${item.repetitions} 次</span>
                        <span><i class="fas fa-calendar-alt"></i> ${new Date(item.due_date).toLocaleDateString()}</span>
                    </div>
                `;
                reviewListEl.appendChild(div);
            });

        } catch (err) {
            console.error(err);
            reviewListEl.innerHTML = `<p style="color:red; text-align:center;">加载失败: ${err.message}</p>`;
        }
    }

    // --- 核心功能 B: 加载所有历史 ---
    async function loadAllHistory() {
        console.log("📥 正在加载所有历史...");
        allListEl.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> 数据拉取中...</div>';
        
        try {
            const res = await fetch('/.netlify/functions/get-user-errors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id })
            });

            if (!res.ok) throw new Error("API 请求失败");
            const data = await res.json();
            
            allListEl.innerHTML = '';
            isAllErrorsLoaded = true;

            if (!data || data.length === 0) {
                allListEl.innerHTML = '<div style="text-align:center; padding:30px; color:#aaa;"><p>你还没有做错过任何题目，太强了！</p></div>';
                return;
            }

            data.forEach(item => {
                const q = item.questions;
                if (!q) return;

                const div = document.createElement('div');
                div.className = 'error-item';
                // 历史记录不需要点击跳转复习，只是展示
                div.dataset.repetitions = 99; // 默认灰色条

                const cleanQuestion = (q.full_question || "").replace(/\[question\]\d+(\.\d+)*\s*/, '');

                div.innerHTML = `
                    <div style="font-weight:600; margin-bottom:5px;">${cleanQuestion}</div>
                    ${renderImages(q.image_urls)}
                    <div class="answer-box">
                        <span style="color:#e74c3c">❌ 你的: ${item.user_answer}</span>
                        <span style="color:#2ecc71">✅ 正确: ${q.correct_answer}</span>
                    </div>
                    <div style="text-align:right; font-size:0.8em; color:#ccc; margin-top:5px;">
                        ${new Date(item.answered_at).toLocaleString()}
                    </div>
                `;
                allListEl.appendChild(div);
            });

        } catch (err) {
            console.error(err);
            allListEl.innerHTML = `<p style="color:red; text-align:center;">加载失败: ${err.message}</p>`;
        }
    }

    // --- 5. 事件绑定 (点击切换) ---
    document.querySelector('.tab-controls').addEventListener('click', (e) => {
        if (!e.target.classList.contains('tab-btn')) return;

        // 切换样式
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        
        const targetId = e.target.dataset.tab;
        document.getElementById(targetId).classList.add('active');

        // 如果点击的是"所有错题"且还没加载过，则触发加载
        if (targetId === 'all-errors' && !isAllErrorsLoaded) {
            loadAllHistory();
        }
    });

    // --- 6. 立即启动默认视图 ---
    loadReview();

})();