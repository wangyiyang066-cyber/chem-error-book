// js/quiz.js

// === 🚀 启动逻辑：防止错过登录信号 ===
async function initQuiz() {
    // 1. 获取 Supabase 客户端 (假设 main.js 已经加载了 SDK)
    const supabaseUrl = "https://ghuyiwhqdellucjxqiwj.supabase.co"; 
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodXlpd2hxZGVsbHVjanhxaXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzQwOTQsImV4cCI6MjA3MzAxMDA5NH0.toJ68-C9Kq_GmD_pGiXLH5_TK7MhawdBsdCv1FP-TVk";
    const _client = window.supabase || supabase.createClient(supabaseUrl, supabaseKey);

    // 2. 主动检查：现在登录了吗？
    const { data: { session } } = await _client.auth.getSession();
    
    if (session) {
        console.log("✅ Quiz 检测到用户已登录，立即启动！");
        window.user = session.user; // 确保全局 user 变量存在
        // 这里的 window.supabaseClient 是 main.js 里定义的，如果没有就用 _client
        window.supabaseClient = window.supabaseClient || _client; 
        startQuizSession(); 
    } else {
        console.log("⏳ Quiz 等待用户登录事件...");
        // 如果没登录，再乖乖排队等事件
        document.addEventListener('userReady', () => {
            console.log("✅ Quiz 收到登录事件，启动！");
            startQuizSession();
        });
    }
}

// 立即执行初始化
initQuiz();

// ================= 以下是核心业务逻辑 =================

let questionSet = [];
let currentQuestionIndex = 0;

// 获取 DOM 元素
const questionNumberEl = document.getElementById('question-number');
const questionTextEl = document.getElementById('question-text');
const difficultyStarsEl = document.getElementById('difficulty-stars'); 
const questionImagesContainer = document.getElementById('question-images-container'); 
const userAnswerInput = document.getElementById('user-answer-input');
const submitBtn = document.getElementById('submit-answer-btn');

const feedbackContainer = document.getElementById('feedback-container');
const feedbackWrongEl = document.getElementById('feedback-wrong');
const feedbackCorrectEl = document.getElementById('feedback-correct');
const correctAnswerTextEl = document.getElementById('correct-answer-text');
const relatedKeypointEl = document.getElementById('related-keypoint');
const recommendationContainer = document.getElementById('recommendation-container');
const recommendationText = document.getElementById('recommendation-text');

const nextQuestionBtn = document.getElementById('next-question-btn');
const getAiAnalysisBtn = document.getElementById('get-ai-analysis-btn');
const aiChatContainer = document.getElementById('ai-chat-container');
const aiChatLog = document.getElementById('ai-chat-log');
const quizContainer = document.getElementById('quiz-container');
const quizCompleteContainer = document.getElementById('quiz-complete-container');

// --- 1. 开始加载题目 ---
async function startQuizSession() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode'); 
    const chapterId = urlParams.get('id');

    try {
        questionTextEl.textContent = '正在从云端拉取题目...';
        let apiUrl = '';
        
        // --- 路由分发 ---
        if (mode === 'review') {
            document.querySelector('h1').textContent = '错题巩固模式';
            const qId = urlParams.get('questionId');
            if(qId) apiUrl = `/.netlify/functions/get-question-by-id?id=${qId}`;
        } else if (mode === 'comprehensive') {
            document.querySelector('h1').textContent = '综合模拟考试';
            apiUrl = `/.netlify/functions/get-comprehensive-exam`;
        } else {
            if (!chapterId) { alert("未指定章节ID"); return; }
            apiUrl = `/.netlify/functions/get-questions-by-chapter?id=${chapterId}`;
        }

        const data = await fetchWithAuth(apiUrl);
        
        let rawQuestions = Array.isArray(data) ? data : [data];
        
        if (!rawQuestions || rawQuestions.length === 0 || !rawQuestions[0]) {
            questionTextEl.textContent = '本单元暂无题目，可能AI正在努力录入中...';
            submitBtn.style.display = 'none';
            return;
        }

        questionSet = rawQuestions;
        currentQuestionIndex = 0;
        displayQuestion();

    } catch (error) {
        console.error(error);
        questionTextEl.textContent = `加载失败: ${error.message}`;
    }
}

// --- 2. 渲染题目 ---
function displayQuestion() {
    const q = questionSet[currentQuestionIndex];

    // 重置 UI
    feedbackContainer.style.display = 'none';
    feedbackWrongEl.style.display = 'none';
    feedbackCorrectEl.style.display = 'none';
    aiChatContainer.style.display = 'none';
    aiChatLog.innerHTML = '';
    getAiAnalysisBtn.style.display = 'inline-block';
    
    userAnswerInput.value = '';
    userAnswerInput.disabled = false;
    submitBtn.style.display = 'block';
    submitBtn.disabled = false;

    // 设置文本
    questionNumberEl.textContent = `${currentQuestionIndex + 1} / ${questionSet.length}`;
    questionTextEl.textContent = q.full_question.replace(/^\[question\]\d+(\.\d+)*\s*/, '');

    // 渲染星星
    const diffVal = parseFloat(q.difficulty || 0.5);
    let starCount = Math.round(diffVal * 5) || 3; 
    if(starCount < 1) starCount = 1;
    if(starCount > 5) starCount = 5;
    
    // 使用 FontAwesome 星星
    let starsHtml = '';
    for(let i=0; i<5; i++) {
        if(i < starCount) starsHtml += '<i class="fas fa-star"></i>';
        else starsHtml += '<i class="far fa-star"></i>';
    }
    difficultyStarsEl.innerHTML = `难度: ${starsHtml}`;

    // 渲染图片
    questionImagesContainer.innerHTML = '';
    if (q.image_urls && q.image_urls.length > 0) {
        q.image_urls.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.style.cssText = "max-height: 150px; border: 1px solid #ddd; border-radius: 8px; cursor: zoom-in;";
            img.onclick = () => window.open(url, '_blank');
            questionImagesContainer.appendChild(img);
        });
    }
}

// --- 3. 提交答案 ---
submitBtn.addEventListener('click', async () => {
    const userAnswer = userAnswerInput.value.trim();
    if (!userAnswer) { alert("请填写答案！"); return; }

    submitBtn.disabled = true;
    const q = questionSet[currentQuestionIndex];
    const isCorrect = (userAnswer === q.correct_answer.trim()); 

    // A. 保存做题记录
    try {
        await fetchWithAuth('/.netlify/functions/save-answer', {
            method: 'POST',
            body: JSON.stringify({ 
                questionId: q.id, isCorrect, userAnswer, userId: window.user.id 
            })
        });
    } catch (e) { console.error("保存记录失败", e); }

    // B. 复习模式更新
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'review') {
        const reviewId = urlParams.get('reviewId');
        if (reviewId) {
            try {
                await fetchWithAuth('/.netlify/functions/update-review-status', {
                    method: 'POST',
                    body: JSON.stringify({ reviewId: reviewId, isCorrect: isCorrect })
                });
            } catch (e) { console.error("更新复习计划失败", e); }
        }
    }

    // C. UI 反馈
    userAnswerInput.disabled = true;
    submitBtn.style.display = 'none';
    feedbackContainer.style.display = 'block';

    if (isCorrect) {
        feedbackCorrectEl.style.display = 'block';
    } else {
        feedbackWrongEl.style.display = 'block';
        correctAnswerTextEl.textContent = q.correct_answer;
        
        // 智能解析知识点名称
        let kpText = "综合";
        if (q.question_knowledge_point_link && q.question_knowledge_point_link.length > 0) {
            kpText = q.question_knowledge_point_link.map(link => {
                const node = link.knowledge_nodes || link.knowledge_points;
                return node ? (node.title || node.name) : "未知考点";
            }).join(", ");
        }
        relatedKeypointEl.textContent = kpText;

        if (q.error_analysis) {
            recommendationContainer.style.display = 'block';
            recommendationText.textContent = q.error_analysis;
        } else {
            recommendationContainer.style.display = 'none';
        }
    }
});

// --- 4. 切换下一题 ---
nextQuestionBtn.addEventListener('click', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'review') {
        window.location.href = 'my-errors.html';
        return;
    }
    currentQuestionIndex++;
    if (currentQuestionIndex < questionSet.length) {
        displayQuestion();
    } else {
        quizContainer.style.display = 'none';
        quizCompleteContainer.style.display = 'block';
    }
});

// --- 5. AI 老师 (DeepSeek) ---
getAiAnalysisBtn.addEventListener('click', async () => {
    getAiAnalysisBtn.style.display = 'none';
    aiChatContainer.style.display = 'block';
    const loadingId = 'loading-' + Date.now();
    addMessageToLog('ai', '正在分析你的思路...', loadingId);

    const q = questionSet[currentQuestionIndex];
    const userAnswer = userAnswerInput.value;

    try {
        const prompt = `
你是一位初中化学老师。学生做错了这道题。
【题目】${q.full_question}
【标准答案】${q.correct_answer}
【解析】${q.analysis}
【学生回答】${userAnswer}
请用苏格拉底教学法引导学生发现错误，不要直接给答案。语气要鼓励。
        `;

        const res = await fetch('/.netlify/functions/get-ai-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: "user", content: prompt }] })
        });

        if (!res.ok) throw new Error("AI Error");

        const rawText = await res.text();
        let content = "";
        const regex = /"content":"(.*?)"/g;
        let match;
        while ((match = regex.exec(rawText)) !== null) {
            content += match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
        if (!content) { 
             try { content = JSON.parse(rawText).choices[0].message.content; } catch(e){}
        }

        const loadingDiv = document.getElementById(loadingId);
        if(loadingDiv) aiChatLog.removeChild(loadingDiv);
        typeWriterEffect(content || "解析生成完毕。");

    } catch (err) {
        console.error(err);
        const loadingDiv = document.getElementById(loadingId);
        if(loadingDiv) aiChatLog.removeChild(loadingDiv);
        addMessageToLog('ai', 'AI 老师暂时离线。');
    }
});

// --- 辅助函数 ---
async function fetchWithAuth(url, options = {}) {
    // 再次确认 session，防止 token 过期
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) throw new Error("未登录");
    
    const headers = { 
        ...options.headers, 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${session.access_token}` 
    };
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) throw new Error(`请求失败: ${res.statusText}`);
    return await res.json();
}

function addMessageToLog(role, text, id) {
    const div = document.createElement('div');
    div.className = `chat-message ${role === 'user' ? 'user-message' : 'ai-message'}`;
    if(id) div.id = id;
    div.innerHTML = `<div class="avatar">${role==='user'?'🧑':'🤖'}</div><div class="message-content">${text}</div>`;
    aiChatLog.appendChild(div);
    aiChatLog.scrollTop = aiChatLog.scrollHeight;
}

function typeWriterEffect(text) {
    const div = document.createElement('div');
    div.className = 'chat-message ai-message';
    div.innerHTML = `<div class="avatar">🤖</div><div class="message-content"></div>`;
    aiChatLog.appendChild(div);
    const contentBox = div.querySelector('.message-content');
    let i = 0;
    function type() {
        if (i < text.length) {
            contentBox.textContent += text.charAt(i);
            i++;
            aiChatLog.scrollTop = aiChatLog.scrollHeight;
            setTimeout(type, 20);
        }
    }
    type();
}