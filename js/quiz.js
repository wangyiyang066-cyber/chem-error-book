// js/quiz.js (全量整合版本 - 保留所有 Prompt 与 IRT 逻辑)
const urlParams = new URLSearchParams(window.location.search);
const isReviewMode = urlParams.get('mode') === 'review';

// === 🚀 第一部分：启动与鉴权 ===
async function initQuiz() {
    const supabaseUrl = "https://ghuyiwhqdellucjxqiwj.supabase.co"; 
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodXlpd2hxZGVsbHVjanhxaXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzQwOTQsImV4cCI6MjA3MzAxMDA5NH0.toJ68-C9Kq_GmD_pGiXLH5_TK7MhawdBsdCv1FP-TVk";
    const _client = window.supabaseClient || supabase.createClient(supabaseUrl, supabaseKey);

    const { data: { session } } = await _client.auth.getSession();
    
    if (session) {
        window.user = session.user;
        window.supabaseClient = _client;
        startQuizSession(); 
    } else {
        document.addEventListener('userReady', () => { startQuizSession(); });
        setTimeout(() => { if (!window.user) { alert("请先登录！"); window.location.href = "index.html"; } }, 2000);
    }
}
initQuiz();

// === 🚀 第二部分：核心变量与 DOM ===
let questionSet = [];
let currentQuestionIndex = 0;

const questionNumberEl = document.getElementById('question-number');
const questionTextEl = document.getElementById('question-text');
const difficultyStarsEl = document.getElementById('difficulty-stars'); 
const questionImagesContainer = document.getElementById('question-images-container'); 
const userAnswerInput = document.getElementById('user-answer-input');
const submitBtn = document.getElementById('submit-answer-btn');
const feedbackContainer = document.getElementById('feedback-container');
const feedbackWrongEl = document.getElementById('feedback-wrong');
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

// 1. 加载题目逻辑 (区分章节/综合/复习)
async function startQuizSession() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode'); 
    const chapterId = urlParams.get('id');
    const userId = window.user ? window.user.id : '';

    try {
        questionTextEl.textContent = '正在拉取题目...';
        let apiUrl = '';
        if (mode === 'review') {
            const qId = urlParams.get('questionId');
            apiUrl = `/.netlify/functions/get-question-by-id?id=${qId}`;
        } else if (mode === 'comprehensive') {
            apiUrl = `/.netlify/functions/get-comprehensive-exam?userId=${userId}`;
        } else {
            apiUrl = `/.netlify/functions/get-questions-by-chapter?id=${chapterId}&userId=${userId}`;
        }

        const data = await fetchWithAuth(apiUrl);
        let rawQuestions = Array.isArray(data) ? data : [data];

        if (mode === 'review' || mode === 'comprehensive') {
            questionSet = rawQuestions;
        } else {
            questionSet = rawQuestions.filter(q => q.shifouzuoguo === false || q.shifouzuoguo === null); 
        }

        if (questionSet.length === 0) {
            questionTextEl.textContent = '当前章节已全部完成！';
            submitBtn.style.display = 'none';
            return;
        }
        currentQuestionIndex = 0;
        displayQuestion();
    } catch (error) { questionTextEl.textContent = `加载失败: ${error.message}`; }
}

// 2. 渲染题目
function displayQuestion() {
    const q = questionSet[currentQuestionIndex];
    feedbackContainer.style.display = 'none';
    aiChatContainer.style.display = 'none';
    recommendationContainer.style.display = 'none';
    userAnswerInput.value = '';
    userAnswerInput.disabled = false;
    submitBtn.style.display = 'block';
    
    // 显示题号与状态
    const statusTag = q.shifouzuoguo ? `<span style="background:#dcf8c6; color:#2e7d32; padding:2px 8px; border-radius:12px; font-size:0.8em; margin-left:10px;">已做过</span>` : '';
    questionNumberEl.innerHTML = `${currentQuestionIndex + 1} / ${questionSet.length} ${statusTag}`;

    const cleanText = q.full_question.replace(/^\[question\]\d+(\.\d+)*\s*/, '');
    questionTextEl.textContent = cleanText;

    const diffVal = parseFloat(q.difficulty || 0.5);
    let starCount = Math.round(diffVal * 5) || 3;
    difficultyStarsEl.innerHTML = `难度: ${'<i class="fas fa-star"></i>'.repeat(starCount)}${'<i class="far fa-star"></i>'.repeat(5-starCount)}`;

    questionImagesContainer.innerHTML = '';
    (q.image_urls || []).forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.style.cssText = "max-height: 150px; border-radius: 8px; cursor: pointer; margin-right: 10px;";
        img.onclick = () => window.open(url, '_blank');
        questionImagesContainer.appendChild(img);
    });
}

// 3. 提交逻辑 -> 唤起自评面板
submitBtn.addEventListener('click', async () => {
    const userAnswer = userAnswerInput.value.trim();
    if (!userAnswer) { alert("请填写答案！"); return; }

    const q = questionSet[currentQuestionIndex];
    submitBtn.style.display = 'none';
    userAnswerInput.disabled = true;

    // 展示参考答案与考点
    feedbackContainer.style.display = 'block';
    feedbackWrongEl.style.display = 'block';
    correctAnswerTextEl.innerHTML = marked.parse(q.correct_answer);
    
    let kpText = "综合考点";
    if (q.question_knowledge_point_link && q.question_knowledge_point_link.length > 0) {
        kpText = q.question_knowledge_point_link.map(link => (link.knowledge_nodes || link.knowledge_points || {title:"未知"}).title).join(", ");
    }
    relatedKeypointEl.textContent = kpText;

    // 渲染你要求的交互操作面板
    renderActionPanel(q, userAnswer);
});

function renderActionPanel(q, userAnswer) {
    recommendationContainer.style.display = 'block';
    recommendationText.innerHTML = `
        <div class="assessment-card" style="border: 2px solid #4a90e2; padding: 20px; border-radius: 12px; background: #fff; margin-top: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <p style="text-align: center; font-weight: bold; color: #2c3e50; font-size: 1.1em;">对比答案，你觉得自己掌握了吗？</p>
            <div style="display: flex; gap: 15px; justify-content: center; margin-bottom: 20px;">
                <button onclick="saveAndProcess(true, ${q.id})" class="btn-primary" style="background: #27ae60; flex: 1; padding: 12px;">
                    <i class="fas fa-check"></i> 我做对了
                </button>
                <button onclick="saveAndProcess(false, ${q.id})" class="btn-primary" style="background: #e74c3c; flex: 1; padding: 12px;">
                    <i class="fas fa-times"></i> 我做错了
                </button>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #eee; padding-top: 15px;">
                <button onclick="triggerAiTeacher()" class="btn-ai" style="display: block; width: 100%; border-radius: 8px;">
                    <i class="fas fa-robot"></i> 还是不懂？听听苏格拉底 AI 老师讲解
                </button>
                <button id="manual-rec-btn" onclick="triggerManualPush(${q.id})" class="btn-secondary" style="background: #f39c12; color: white; border-radius: 8px;">
                    <i class="fas fa-plus-circle"></i> 没练透？点击推送同类强化题
                </button>
            </div>
        </div>
        <div id="push-loading-area" style="margin-top: 15px; display: none;"></div>
    `;
    
    if (q.error_analysis) {
        const errDiv = document.createElement('div');
        errDiv.innerHTML = `<p style="margin-top:15px; padding:12px; background:#fff9c4; border-radius:8px; border-left: 5px solid #f1c40f;"><strong>💡 原题易错点拨：</strong>${q.error_analysis}</p>`;
        recommendationText.prepend(errDiv);
    }
}

// 4. 处理存档
async function saveAndProcess(isCorrect, qId) {
    try {
        await fetchWithAuth('/.netlify/functions/save-answer', {
            method: 'POST',
            body: JSON.stringify({ questionId: qId, isCorrect, userAnswer: userAnswerInput.value, userId: window.user.id })
        });
        questionSet[currentQuestionIndex].shifouzuoguo = true;
        alert(isCorrect ? "太棒了！请继续挑战。" : "已记录至错题本，建议点击下方按钮进行强化。");
    } catch (e) { console.error("存档失败", e); }
}

// 5. 手动推送逻辑
async function triggerManualPush(qId) {
    const area = document.getElementById('push-loading-area');
    area.style.display = 'block';
    area.innerHTML = '<p style="text-align: center;"><i class="fas fa-spinner fa-spin"></i> 正在匹配同类考点题目...</p>';
    try {
        const res = await fetch('/.netlify/functions/recommend-question', {
            method: 'POST',
            body: JSON.stringify({ questionId: qId, userId: window.user.id })
        });
        const rec = await res.json();
        if (rec && rec.id) {
            area.innerHTML = `
                <div style="background: #fff3e0; padding: 15px; border: 1px solid #ff9800; border-radius: 8px; margin-top: 10px;">
                    <p style="font-weight: bold; color: #e67e22;">✨ 推荐题目：</p>
                    <p>${rec.full_question || rec.content}</p>
                    <button class="btn-primary" style="width:100%; margin-top: 10px;" onclick="window.location.href='quiz.html?mode=review&questionId=${rec.id}'">
                        立即开始这道强化题
                    </button>
                </div>`;
        } else { area.innerHTML = '<p style="text-align: center; color: #999;">暂时没有更多推荐题了。</p>'; }
    } catch (e) { area.innerHTML = '<p style="color:red;">推送失败，请稍后重试。</p>'; }
}

function triggerAiTeacher() { getAiAnalysisBtn.click(); }

// 6. 下一题
nextQuestionBtn.addEventListener('click', () => {
    if (urlParams.get('mode') === 'review') { window.location.href = 'my-errors.html'; return; }
    currentQuestionIndex++;
    if (currentQuestionIndex < questionSet.length) { displayQuestion(); } 
    else {
        quizContainer.style.display = 'none';
        quizCompleteContainer.style.display = 'block';
    }
});

// 7. AI 老师 (保留你打磨的 20 年资深教师 Prompt)
let chatHistory = []; 
const chatUserInput = document.getElementById('chat-user-input');
const chatSendBtn = document.getElementById('chat-send-btn');

getAiAnalysisBtn.addEventListener('click', async () => {
    getAiAnalysisBtn.style.display = 'none';
    aiChatContainer.style.display = 'block';
    aiChatLog.innerHTML = ''; 
    const q = questionSet[currentQuestionIndex];
    
    const systemPrompt = `
你是一位拥有20年经验的资深初中化学教师，擅长使用“元认知策略”和“苏格拉底提问法”引导学生。
学生做错了一道题，你的任务不是直接告诉他答案，而是按照以下【严格的教学四部曲】一步步引导他自己发现真理。

【题目信息】
- 题目内容：${q.full_question}
- 标准答案：${q.correct_answer}
- 题目解析：${q.analysis}

【学生的错误回答】
${userAnswerInput.value}

【你的教学指令 - 请严格按逻辑执行】
你需要模拟一位在身边的老师，不要一次性把下面所有步骤说完，而是根据当前的语境，选择最适合的一步进行引导：
**第一阶段：审题回顾 (读题)**
- 请温和地询问：“先别急，我们重新读一遍题目。你觉得这道题里的【关键词】或者【限制条件】是什么？”
**第二阶段：考点定位 (元认知唤醒)**
- 询问：“你觉得这就好比我们在课本里学过的哪一章内容？”
**第三阶段：逻辑构建 (应用)**
- “既然是考察这个知识点，那么题目中的这个现象应该对应什么化学原理？”
**第四阶段：最终求解**
- 在学生思路理顺后，让他自己得出正确答案。

【回复要求】语气亲切，禁给答案，分段清晰，200字以内。`;

    chatHistory = [{ role: "system", content: systemPrompt }, { role: "user", content: "老师，这题我不太懂。" }];
    await callAiAPI();
});

chatSendBtn.addEventListener('click', async () => {
    const text = chatUserInput.value.trim();
    if (!text) return;
    addMessageToLog('user', text);
    chatUserInput.value = ''; 
    chatHistory.push({ role: "user", content: text });
    await callAiAPI();
});

async function callAiAPI() {
    const loadingId = 'loading-' + Date.now();
    addMessageToLog('ai', '正在思考中...', loadingId);
    try {
        const res = await fetch('/.netlify/functions/get-ai-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: chatHistory })
        });
        const raw = await res.text();
        let content = "";
        try { content = JSON.parse(raw).choices[0].message.content; }
        catch (e) {
            const regex = /"content":"(.*?)"/g;
            let m; while ((m = regex.exec(raw)) !== null) content += m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
        const lDiv = document.getElementById(loadingId); if(lDiv) aiChatLog.removeChild(lDiv);
        typeWriterEffect(content || "老师走神了，请重试。");
        chatHistory.push({ role: "assistant", content: content });
    } catch (e) { addMessageToLog('ai', 'AI 老师掉线了。'); }
}

// 8. 辅助函数
async function fetchWithAuth(url, options = {}) {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const headers = { ...options.headers, 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };
    const res = await fetch(url, { ...options, headers });
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
    const box = div.querySelector('.message-content');
    let i = 0;
    function type() {
        if (i < text.length) { box.textContent += text.charAt(i++); aiChatLog.scrollTop = aiChatLog.scrollHeight; setTimeout(type, 15); }
        else {
            box.innerHTML = marked.parse(box.textContent);
            renderMathInElement(box, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}], throwOnError: false });
        }
    }
    type();
}