// ==========================================
// 1. 全局变量与配置
// ==========================================
console.log("🌐 [前端 STEP 0] 页面加载，正在初始化系统...");

// ⚠️ 这里换成你自己的 Supabase URL 和 KEY
const SUPABASE_URL = "https://ghuyiwhqdellucjxqiwj.supabase.co"; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodXlpd2hxZGVsbHVjanhxaXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzQwOTQsImV4cCI6MjA3MzAxMDA5NH0.toJ68-C9Kq_GmD_pGiXLH5_TK7MhawdBsdCv1FP-TVk';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let chatHistory = [];
const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// ==========================================
// 2. 页面启动逻辑
// ==========================================
window.onload = async () => {
    console.log("🚀 [前端 STEP 1] UI 渲染完毕，准备唤醒导师...");
    appendMessage('mentor', '👋 你好！我是你的专属错题管理导师。正在为你同步数据库里的错题记录，请稍等...', true);
    
    // 首次调用 AI，静默传入身份
    await getAIResponse(true);
};

// ==========================================
// 3. 核心通讯逻辑：向后端要回复
// ==========================================
async function getAIResponse(isInitial = false) {
    console.log(`\n▶️ [前端 STEP 2] 准备发送请求 (是否首次加载: ${isInitial})`);

    // 🌟 获取真实合法的身份 Token
    console.log("🔑 [前端 STEP 3] 正在向 Supabase 索要真实 Token...");
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
        console.error("❌ [前端报错] 没拿到 Token，用户可能没登录！");
        appendMessage('mentor', '⚠️ 哎呀，你好像还没有登录，或者登录已过期，请先返回主页登录哦！');
        return;
    }
    console.log("✅ [前端 STEP 4] Token 获取成功！准备就绪。");

    const currentInput = userInput.value;
    if (!isInitial && !currentInput) {
        console.log("⚠️ [前端提示] 用户输入为空，拒绝发送。");
        return;
    }
    
    // 如果是用户自己说的话，先上屏展示
    if (!isInitial) {
        appendMessage('user', currentInput);
        userInput.value = ''; // 清空输入框
    }

    try {
        console.log("📡 [前端 STEP 5] 正在通过 Netlify 向 DeepSeek 发送数据...");
        const response = await fetch('/.netlify/functions/gatekeeper-session', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // 带着身份牌去敲门
            },
            body: JSON.stringify({
                is_initial: isInitial,
                chat_history: chatHistory,
                user_input: currentInput
            })
        });

        console.log("📥 [前端 STEP 6] 收到后端响应！正在拆快递...");
        const data = await response.json();
        
        if (!response.ok) {
            console.error("❌ [前端报错] 后端返回了错误状态码:", response.status, data);
            appendMessage('mentor', `系统开小差了：${data.error || '未知错误'}。请按 F12 查看控制台。`);
            return;
        }

        const fullReply = data.reply;
        console.log("✅ [前端 STEP 7] 成功拿到 AI 回复内容！");

        // 处理右侧进度条
        processStage(fullReply);

        // 剔除暗号 [STAGE_X] 后，把干净的文字打字机输出
        const cleanReply = fullReply.replace(/\[STAGE_\d\]/gi, '').trim();
        appendMessage('mentor', cleanReply);

        // 存入记忆体，下次一起发给 AI
        chatHistory.push({ role: "assistant", content: fullReply });
        if (!isInitial) chatHistory.push({ role: "user", content: currentInput });
        
        console.log("🏁 [前端 STEP 8] 本轮对话渲染完毕，等待用户下一步操作。\n");

    } catch (err) {
        console.error("❌ [前端报错] 网络请求彻底失败:", err);
        appendMessage('mentor', '抱歉，网络好像断了，数据没发出去。');
    }
}

// ==========================================
// 4. UI 联动：处理右侧进度条
// ==========================================
function processStage(text) {
    const stages = [
        { key: '[STAGE_1]', id: 'step-1' },
        { key: '[STAGE_2]', id: 'step-2' },
        { key: '[STAGE_3]', id: 'step-3' },
        { key: '[STAGE_4]', id: 'step-4' }
    ];

    stages.forEach((s, index) => {
        if (text.includes(s.key)) {
            console.log(`🎯 [UI 触发] 检测到暗号 ${s.key}，正在点亮对应步骤。`);
            const el = document.getElementById(s.id);
            if(el) el.classList.add('active');
            
            // 把前面的步骤打上绿色对勾
            for(let i = 1; i <= index; i++) {
                const prevEl = document.getElementById('step-'+i);
                if(prevEl && !prevEl.classList.contains('done')) {
                    prevEl.classList.add('done');
                    prevEl.innerHTML = '<i class="fas fa-check-circle"></i> ' + prevEl.innerText;
                }
            }
            
            // 终极解锁逻辑
            if (s.key === '[STAGE_4]') {
                console.log("🔓 [UI 触发] 第四阶段完成，复习大门已解锁！");
                const launchBtn = document.getElementById('launch-btn');
                if(launchBtn) launchBtn.style.display = 'block';
            }
        }
    });
}

// ==========================================
// 5. UI 动效：打字机与气泡渲染
// ==========================================
function appendMessage(sender, text, isFast = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${sender}-msg`;
    chatWindow.appendChild(msgDiv);
    
    if (sender === 'mentor') {
        let i = 0;
        // isFast 用于第一句系统提示，可以稍微打字快一点
        const speed = isFast ? 10 : 30; 
        
        function typing() {
            if (i < text.length) {
                msgDiv.innerHTML += text.charAt(i);
                i++;
                chatWindow.scrollTop = chatWindow.scrollHeight;
                setTimeout(typing, speed);
            }
        }
        typing();
    } else {
        msgDiv.innerText = text;
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
}

// ==========================================
// 6. 绑定点击与回车事件
// ==========================================
if(sendBtn) sendBtn.onclick = () => getAIResponse(false);
if(userInput) {
    userInput.onkeypress = (e) => { 
        if (e.key === 'Enter') getAIResponse(false); 
    };
}