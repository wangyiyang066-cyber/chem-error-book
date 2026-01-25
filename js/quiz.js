// js/quiz.js (最终完全体)
// 获取 URL 参数，判断是否为复习模式
const urlParams = new URLSearchParams(window.location.search);
const isReviewMode = urlParams.get('mode') === 'review';
// === 🚀 第一部分：启动与鉴权 ===
async function initQuiz() {
    // 获取客户端 (兼容全局变量)
    const supabaseUrl = "https://ghuyiwhqdellucjxqiwj.supabase.co"; 
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodXlpd2hxZGVsbHVjanhxaXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzQwOTQsImV4cCI6MjA3MzAxMDA5NH0.toJ68-C9Kq_GmD_pGiXLH5_TK7MhawdBsdCv1FP-TVk";
    const _client = window.supabaseClient || supabase.createClient(supabaseUrl, supabaseKey);

    // 检查登录状态
    const { data: { session } } = await _client.auth.getSession();
    
    if (session) {
        console.log("✅ 用户已登录:", session.user.email);
        window.user = session.user;
        window.supabaseClient = _client; // 确保全局可用
        startQuizSession(); 
    } else {
        console.log("⏳ 等待登录...");
        // 监听 main.js 发出的登录事件
        document.addEventListener('userReady', () => {
            startQuizSession();
        });
        // 如果实在没等到（比如直接打开链接且没登录），提示跳转
        setTimeout(() => {
            if (!window.user) {
                alert("请先登录！");
                window.location.href = "index.html";
            }
        }, 2000);
    }
}

// 立即启动
initQuiz();


// === 🚀 第二部分：核心逻辑 ===

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

// 1. 加载题目
async function startQuizSession() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode'); 
    const chapterId = urlParams.get('id');
    const userId = window.user ? window.user.id : ''; // 获取当前用户ID

    try {
        questionTextEl.textContent = '正在从云端拉取题目...';
        let apiUrl = '';
        
        // --- 原有模式判断逻辑：保持不变 ---
        if (mode === 'review') {
            document.querySelector('h1').textContent = '错题巩固模式';
            const qId = urlParams.get('questionId');
            if(qId) apiUrl = `/.netlify/functions/get-question-by-id?id=${qId}`;
        } else if (mode === 'comprehensive') {
            document.querySelector('h1').textContent = '综合模拟考试';
            apiUrl = `/.netlify/functions/get-comprehensive-exam?userId=${userId}`;
        } else {
            if (!chapterId) { alert("未指定章节ID"); return; }
            // 🔥 这里把 userId 传给后端，让后端帮忙查 is_done
            apiUrl = `/.netlify/functions/get-questions-by-chapter?id=${chapterId}&userId=${userId}`;
        }

        const data = await fetchWithAuth(apiUrl);
        let rawQuestions = Array.isArray(data) ? data : [data];

        // --- 核心改动逻辑：智能过滤 ---
        // 逻辑：如果是复习模式或综合模拟模式，不过滤；如果是普通刷章节模式，只保留没做过的。
        if (mode === 'review' || mode === 'comprehensive') {
            questionSet = rawQuestions; 
            console.log("当前处于复习或模拟模式，已解除重复题限制。");
        } else {
            // 普通模式：只保留 shifouzuoguo 不为 true 的题目
            questionSet = rawQuestions.filter(q => q.shifouzuoguo === false || q.shifouzuoguo === null); 
        }

        if (questionSet.length === 0) {
            // 根据模式给出不同的提示
            if (mode !== 'review') {
                questionTextEl.textContent = '太棒了！这一章节的题目你已经全部斩获，请换个章节试试。';
            } else {
                questionTextEl.textContent = '该模式下暂无题目。';
            }
            submitBtn.style.display = 'none';
            return;
        }

        // 确保不会被 rawQuestions 覆盖
        currentQuestionIndex = 0;
        displayQuestion();

    } catch (error) {
        console.error(error);
        questionTextEl.textContent = `加载失败: ${error.message}`;
    }
}

// 2. 渲染当前题目
function displayQuestion() {
    const q = questionSet[currentQuestionIndex];

    // 重置界面
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

    // --- A. 显示题号 & 状态标记 ---
    let titleHtml = `${currentQuestionIndex + 1} / ${questionSet.length}`;
    if (q.is_done) {
        // 🔥 如果做过，加个绿色小标签
        titleHtml += ' <span style="font-size:0.6em; background:#dcf8c6; color:#2e7d32; padding:2px 6px; border-radius:4px; vertical-align: middle;">已做过</span>';
    }
    questionNumberEl.innerHTML = titleHtml;

    // --- B. 显示题目文本 ---
    const cleanText = q.full_question.replace(/^\[question\]\d+(\.\d+)*\s*/, '');
    questionTextEl.textContent = cleanText;

    // --- C. 显示难度星星 ---
    const diffVal = parseFloat(q.difficulty || 0.5);
    let starCount = Math.round(diffVal * 5) || 3;
    if(starCount < 1) starCount = 1; if(starCount > 5) starCount = 5;
    const starsHtml = '<i class="fas fa-star"></i>'.repeat(starCount) + '<i class="far fa-star"></i>'.repeat(5 - starCount);
    difficultyStarsEl.innerHTML = `难度: ${starsHtml}`;

    // --- D. 显示图片 ---
    questionImagesContainer.innerHTML = '';
    if (q.image_urls && q.image_urls.length > 0) {
        q.image_urls.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.style.cssText = "max-height: 150px; border: 1px solid #ddd; border-radius: 8px; cursor: zoom-in; margin-right: 10px;";
            img.onclick = () => window.open(url, '_blank');
            questionImagesContainer.appendChild(img);
        });
    }
    let statusTag = '';
    if (q.shifouzuoguo === true) {
        statusTag = `<span style="background:#dcf8c6; color:#2e7d32; padding:2px 8px; border-radius:12px; font-size:0.8em; margin-left:10px; border:1px solid #2e7d32;">
                        <i class="fas fa-check-circle"></i> 已做过
                     </span>`;
    } else {
        statusTag = `<span style="background:#fff3cd; color:#856404; padding:2px 8px; border-radius:12px; font-size:0.8em; margin-left:10px; border:1px solid #856404;">
                        <i class="far fa-circle"></i> 未做过
                     </span>`;
    }

    // 组合显示：题号 + 状态标签
    questionNumberEl.innerHTML = `${currentQuestionIndex + 1} / ${questionSet.length} ${statusTag}`;
}

// --- 3. 提交答案 (最终究极版：含交互式推荐题 + 双重 AI) ---
submitBtn.addEventListener('click', async () => {
    // 1. 获取主题用户输入
    const userAnswer = userAnswerInput.value.trim();
    if (!userAnswer) { alert("请填写答案！"); return; }

    // 2. 锁定主题界面
    submitBtn.disabled = true;
    const q = questionSet[currentQuestionIndex];
    // --- 替换原有的 isCorrect 判定逻辑 ---
    let isCorrect = false;

    // 检查是否为大题 (datiorxiaoti 字段)
    if (q.datiorxiaoti === true) {
        // 进入自评与 AI 评分流程
        showSelfAssessmentUI(q);
        return; // 拦截，不执行下面的客观题自动判定和存档逻辑
    }

    // 如果是小题，继续原来的逻辑
    isCorrect = (userAnswer === q.correct_answer.trim());
    // --- 后续原有的存档和反馈逻辑保持不变 ---

    // 3. 保存主题记录
    try {
        await fetchWithAuth('/.netlify/functions/save-answer', {
            method: 'POST',
            body: JSON.stringify({ 
                questionId: q.id, isCorrect, userAnswer, userId: window.user.id 
            })
        });
        q.is_done = true;
        q.shifouzuoguo = true;
    } catch (error) { console.error("保存记录失败:", error); }

    // 4. 复习模式更新
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'review') {
        const reviewId = urlParams.get('reviewId');
        if (reviewId) {
            try {
                await fetchWithAuth('/.netlify/functions/update-review-status', {
                    method: 'POST',
                    body: JSON.stringify({ reviewId: reviewId, isCorrect: isCorrect })
                });
            } catch (e) {}
        }
    }

    // 5. UI 反馈：显示解析区域
    userAnswerInput.disabled = true;
    submitBtn.style.display = 'none';
    feedbackContainer.style.display = 'block';

    if (isCorrect) {
        // === 主题答对了 ===
        feedbackCorrectEl.style.display = 'block';
        feedbackWrongEl.style.display = 'none';
    } else {
        // === 主题答错了 ===
        feedbackWrongEl.style.display = 'block';
        feedbackCorrectEl.style.display = 'none';
        
        correctAnswerTextEl.textContent = q.correct_answer;
        
        // 解析知识点
        let kpText = "综合考点";
        if (q.question_knowledge_point_link && q.question_knowledge_point_link.length > 0) {
            kpText = q.question_knowledge_point_link.map(link => {
                const node = link.knowledge_nodes || link.knowledge_points;
                return node ? (node.title || node.name) : "未知";
            }).join(", ");
        }
        relatedKeypointEl.textContent = kpText;

        // 显示原题易错点
        recommendationContainer.style.display = 'block';
        recommendationText.innerHTML = q.error_analysis ? 
            `<p><strong>💡 原题易错点拨：</strong>${q.error_analysis}</p>` : '';

        // 🔥🔥🔥 核心升级：请求推荐题并生成【迷你答题区】 🔥🔥🔥
        recommendationText.innerHTML += `<div id="rec-loading" style="color:#888; margin-top:10px;"><i class="fas fa-spinner fa-spin"></i> 正在根据你的能力值(IRT)匹配强化题...</div>`;
        
        try {
            const recRes = await fetchWithAuth('/.netlify/functions/recommend-question', {
                method: 'POST',
                body: JSON.stringify({ 
                    wrongQuestionId: q.id,
                    userId: window.user.id 
                })
            });

            const loadingDiv = document.getElementById('rec-loading');
            if(loadingDiv) loadingDiv.remove();

            if (recRes) {
                // 🛠️ 动态生成推荐题的交互界面
                const recHtml = `
                    <div style="background: #f0faff; border: 1px solid #b3e5fc; padding: 15px; border-radius: 8px; margin-top: 15px;">
                        <div style="color: #0277bd; font-weight: bold; margin-bottom: 8px;">
                            <i class="fas fa-bullseye"></i> 强化训练 (难度适配: ${recRes.difficulty})
                        </div>
                        <div style="font-size: 1.05em; color: #333; margin-bottom: 12px;">
                            ${recRes.full_question}
                        </div>
                        
                        <div id="rec-interaction-area">
                            <input type="text" id="rec-user-answer" placeholder="试试回答这道题..." 
                                style="width: 70%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                            <button id="rec-submit-btn" 
                                style="padding: 8px 15px; background: #0277bd; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                提交
                            </button>
                        </div>

                        <div id="rec-feedback-area" style="display:none; margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 10px;">
                            <div id="rec-status" style="font-weight:bold; margin-bottom:5px;"></div>
                            <p><strong>正确答案：</strong><span id="rec-correct-val"></span></p>
                            <p><strong>解析：</strong><span id="rec-analysis-val"></span></p>
                            <button id="rec-ai-btn" style="display:none; background:#00b894; color:white; border:none; padding:5px 10px; border-radius:15px; cursor:pointer; font-size:0.9em;">
                                <i class="fas fa-robot"></i> 让 AI 讲讲这道新题
                            </button>
                        </div>
                    </div>
                `;
                recommendationText.innerHTML += recHtml;

                // 🛠️ 绑定推荐题的提交逻辑
                // 注意：因为是动态生成的 HTML，必须在这里绑定事件
                setTimeout(() => { // 稍微延时确保 DOM 渲染
                    const recSubmitBtn = document.getElementById('rec-submit-btn');
                    const recInput = document.getElementById('rec-user-answer');
                    
                    if(recSubmitBtn) {
                        recSubmitBtn.onclick = async () => {
                            const recAns = recInput.value.trim();
                            if(!recAns) return;

                            // 锁定
                            recInput.disabled = true;
                            recSubmitBtn.disabled = true;
                            recSubmitBtn.innerText = "已提交";

                            const isRecCorrect = (recAns === recRes.correct_answer.trim());

                            // A. 存入数据库 (关键！推荐题做错了也要进错题本)
                            try {
                                await fetchWithAuth('/.netlify/functions/save-answer', {
                                    method: 'POST',
                                    body: JSON.stringify({ 
                                        questionId: recRes.id, // 这里存的是推荐题的ID
                                        isCorrect: isRecCorrect, 
                                        userAnswer: recAns,
                                        userId: window.user.id 
                                    })
                                });
                            } catch(e) { console.error("推荐题存档失败", e); }

                            // B. 显示反馈
                            const feedArea = document.getElementById('rec-feedback-area');
                            const statusDiv = document.getElementById('rec-status');
                            const recAiBtn = document.getElementById('rec-ai-btn');
                            
                            feedArea.style.display = 'block';
                            document.getElementById('rec-correct-val').textContent = recRes.correct_answer;
                            document.getElementById('rec-analysis-val').textContent = recRes.analysis || "暂无详细解析";

                            if (isRecCorrect) {
                                statusDiv.innerHTML = '<span style="color:#2ecc71"><i class="fas fa-check"></i> 太棒了！这道题你掌握了！</span>';
                            } else {
                                statusDiv.innerHTML = '<span style="color:#e74c3c"><i class="fas fa-times"></i> 还是有点小问题，已加入错题本。</span>';
                                // 只有做错才显示 AI 按钮
                                recAiBtn.style.display = 'inline-block';
                                
                                // C. 绑定 AI 按钮 (针对这道推荐题)
                                recAiBtn.onclick = () => {
                                    recAiBtn.style.display = 'none';
                                    aiChatContainer.style.display = 'block';
                                    const loadId = 'rec-loading-' + Date.now();
                                    addMessageToLog('ai', '正在分析刚才这道强化题...', loadId);
                                    
                                    // 构造针对推荐题的 Prompt
                                    const recPrompt = `
你是一位初中化学老师。
学生在做错一道题后，尝试了一道【强化训练题】，结果又做错了。
【强化题题目】${recRes.full_question}
【标准答案】${recRes.correct_answer}
【解析】${recRes.analysis}
【学生回答】${recAns}

请针对这道【强化题】进行讲解。
1. 语气要鼓励，告诉他这道题比刚才那道稍微难一点（或类似）。
2. 用苏格拉底提问法引导他发现错误。
3. 200字以内。
                                    `;
                                    
                                    // 发送请求 (复用原来的 callAI 逻辑或者 fetch)
                                    fetch('/.netlify/functions/get-ai-analysis', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ messages: [{ role: "user", content: recPrompt }] })
                                    }).then(async (res) => {
                                        const raw = await res.text();
                                        let content = "";
                                        const regex = /"content":"(.*?)"/g;
                                        let match;
                                        while ((match = regex.exec(raw)) !== null) {
                                            content += match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                                        }
                                        if(!content) { try{content=JSON.parse(raw).choices[0].message.content}catch(e){} }
                                        
                                        const lDiv = document.getElementById(loadId);
                                        if(lDiv) lDiv.remove();
                                        typeWriterEffect(content || "解析生成完毕。");
                                    });
                                };
                            }
                        };
                    }
                }, 100);

            } else {
                recommendationText.innerHTML += `<p>暂无合适的推荐题目。</p>`;
            }
        } catch (error) {
            console.error("推荐系统异常:", error);
            const loadingDiv = document.getElementById('rec-loading');
            if(loadingDiv) loadingDiv.remove();
        }
    }
});



// 4. 下一题
// --- 4. 切换下一题 (完整逻辑) ---
    nextQuestionBtn.addEventListener('click', () => {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');

        // === 场景 A: 错题复习模式 (Review) ===
        // 逻辑：复习通常是针对“单题”或“特定队列”的。
        // 在目前的单题复习逻辑下，点击“下一题”意味着“我复习完了，带我回列表”。
        if (mode === 'review') {
            window.location.href = 'my-errors.html';
            return;
        }

        // === 场景 B: 章节练习 / 综合模拟 (Normal) ===
        // 逻辑：数组里有一堆题目 (比如20道)，需要一道道往后翻。
        currentQuestionIndex++;

        // 检查数组越界：是否还有下一题？
        if (currentQuestionIndex < questionSet.length) {
            // 还有题目 -> 渲染下一道
            displayQuestion();
        } else {
            // 没有题目了 -> 结算
            // 1. 隐藏答题区域
            quizContainer.style.display = 'none';
            // 2. 显示完成奖杯页
            quizCompleteContainer.style.display = 'block';
            
            // (可选优化) 如果是综合模拟，可以在这里把页面标题改成“模拟结束”
            if (mode === 'comprehensive') {
                document.querySelector('h1').textContent = '模拟考试结束';
            }
        }
    });


// ==========================================
// 5. AI 老师 (交互式对话升级版)
// ==========================================

// 定义一个全局变量存储对话上下文
let chatHistory = []; 

// 获取新加的DOM元素
const chatInputArea = document.getElementById('chat-input-area');
const chatUserInput = document.getElementById('chat-user-input');
const chatSendBtn = document.getElementById('chat-send-btn');

// --- A. 点击“让 AI 老师讲讲” (开启第一轮对话) ---
getAiAnalysisBtn.addEventListener('click', async () => {
    // UI 切换
    getAiAnalysisBtn.style.display = 'none';
    aiChatContainer.style.display = 'block';
    
    // 清空旧记录，准备新对话
    aiChatLog.innerHTML = ''; 
    chatHistory = []; 

    const q = questionSet[currentQuestionIndex];
    const userAnswer = userAnswerInput.value;

    // 1. 构造初始的苏格拉底 System Prompt
    const systemPrompt = `
你是一位拥有20年经验的资深初中化学教师，擅长使用“元认知策略”和“苏格拉底提问法”引导学生。
学生做错了一道题，你的任务不是直接告诉他答案，而是按照以下【严格的教学四部曲】一步步引导他自己发现真理。

【题目信息】
- 题目内容：${q.full_question}
- 标准答案：${q.correct_answer}
- 题目解析：${q.analysis}

【学生的错误回答】
${userAnswer}

【你的教学指令 - 请严格按逻辑执行】

你需要模拟一位在身边的老师，不要一次性把下面所有步骤说完，而是根据当前的语境，选择最适合的一步进行引导：

**第一阶段：审题回顾 (读题)**
*判断学生是否因为粗心没看清题？*
- 请先不要评判对错，而是温和地询问：“先别急，我们重新读一遍题目。你觉得这道题里的【关键词】或者【限制条件】是什么？”
- 或者：“题目问的是A还是B？你注意到了...这个条件了吗？”

**第二阶段：考点定位 (元认知唤醒)**
*如果审题没问题，考察他对知识体系的定位。*
- 询问：“你觉得这就好比我们在课本里学过的哪一章内容？是关于...的，还是关于...的？”
- “这道题想要考察的核心知识点（Key Point）你认为是哪个？”
- **分支逻辑**：
    - 如果学生答对了考点：给予肯定，进入第三阶段。
    - 如果学生答错了考点：请用类比或提示，引导他回到正确的知识点上。

**第三阶段：逻辑构建 (应用)**
*知识点对了，但用错了。*
- “既然是考察这个知识点，那么题目中的这个现象/数据，应该对应什么化学原理？”
- “试着把这个原理套用到这道题里，你会怎么列式/分析？”

**第四阶段：最终求解**
- 在学生思路理顺后，让他自己得出正确答案。
- 最后给出一句简短的鼓励。

【回复要求】
1. **语气**：亲切、耐心、循循善诱，像面对面聊天。
2. **禁止**：严禁直接给出正确答案！严禁直接把解析复制给学生！
3. **格式**：分段清晰，重点词汇可以加粗。
4. **字数**：保持在 200 字以内，多提问，少说教。

请开始你的引导：
    `;

    // 2. 存入历史记录 (System Role)
    chatHistory.push({ role: "system", content: systemPrompt });
    
    // 3. 模拟用户发起请求（虽然用户没打字，但这是触发语）
    const startMsg = "老师，这道题我做错了，能不能帮我分析一下？";
    chatHistory.push({ role: "user", content: startMsg });
    
    // 4. 请求 AI
    await callAiAPI();
});

// --- B. 点击“发送”按钮 (后续追问) ---
chatSendBtn.addEventListener('click', async () => {
    const text = chatUserInput.value.trim();
    if (!text) return;

    // 1. 上屏用户的提问
    addMessageToLog('user', text);
    chatUserInput.value = ''; // 清空输入框
    
    // 2. 存入历史记录
    chatHistory.push({ role: "user", content: text });

    // 3. 请求 AI
    await callAiAPI();
});

// --- C. 支持回车发送 ---
chatUserInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') chatSendBtn.click();
});

// --- D. 核心请求函数 (带上下文) ---
async function callAiAPI() {
    const loadingId = 'loading-' + Date.now();
    addMessageToLog('ai', '思考中...', loadingId);
    
    // 禁用发送按钮防止重复点击
    chatSendBtn.disabled = true;

    try {
        const res = await fetch('/.netlify/functions/get-ai-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // 🔥 关键点：发送完整的 chatHistory 数组，而不仅仅是 content
            body: JSON.stringify({ messages: chatHistory })
        });

        if (!res.ok) throw new Error("AI Error");

        const rawText = await res.text();
        let content = "";
        
        // 解析流式或普通JSON返回
        try {
            // 尝试直接解析 JSON (非流式)
            const json = JSON.parse(rawText);
            content = json.choices[0].message.content;
        } catch (e) {
            // 尝试解析流式数据 (如果是流式接口)
            const regex = /"content":"(.*?)"/g;
            let match;
            while ((match = regex.exec(rawText)) !== null) {
                content += match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            }
        }

        // 移除 Loading 动画
        const loadingDiv = document.getElementById(loadingId);
        if(loadingDiv) aiChatLog.removeChild(loadingDiv);

        if (!content) content = "（老师似乎思考卡住了，请重试）";

        // AI 回复上屏
        // ... 约第 604 行 ...
        typeWriterEffect(content);

        // 🟢 这里是新增的“评分雷达”逻辑
        try {
            // 寻找 AI 回复中的 JSON 结构 { "score": ... }
            const jsonMatch = content.match(/\{[\s\S]*\}/); 
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                const score = parseInt(result.score);
                
                // 如果分数低于 100，触发推送
                if (!isNaN(score) && score < 100) {
                    console.log("检测到 AI 评分不足 100，正在推送强化题...");
                    const q = questionSet[currentQuestionIndex];
                    triggerRecommendationLogic(q.id); // 调用你已经在 771 行写好的函数
                }
            }
        } catch (e) {
            console.log("当前 AI 回复不是评分格式，不触发推送。");
        }

        // 下面是原有的代码（约第 607 行）
        chatHistory.push({ role: "assistant", content: content });

    } catch (err) {
        console.error(err);
        const loadingDiv = document.getElementById(loadingId);
        if(loadingDiv) aiChatLog.removeChild(loadingDiv);
        addMessageToLog('ai', 'AI 老师掉线了，请稍后再试。');
    } finally {
        chatSendBtn.disabled = false; // 恢复按钮
        // 聚焦回输入框，方便连续输入
        setTimeout(() => chatUserInput.focus(), 100);
    }
}



// --- 辅助函数 ---
// js/quiz.js 底部

    async function fetchWithAuth(url, options = {}) {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) throw new Error("未登录");
        
        // 🔥 关键：确保这里使用的是相对路径，或者让它能接受相对路径
        // 如果传入的是 '/.netlify/functions/xxx'，直接用即可
        
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
    // 这里的逻辑是：先打字（纯文本），打完之后瞬间转换成漂亮的 Markdown
    function type() {
        if (i < text.length) {
            contentBox.textContent += text.charAt(i);
            i++;
            aiChatLog.scrollTop = aiChatLog.scrollHeight;
            setTimeout(type, 15); // 打字速度调快了一点
        } else {
            // --- 打字结束，执行 Markdown 转换 ---
            const rawValue = contentBox.textContent;
            // 1. 使用 marked 转换 Markdown 为 HTML
            contentBox.innerHTML = marked.parse(rawValue);
            // 2. 使用 KaTeX 渲染其中的化学公式/数学符号
            renderMathInElement(contentBox, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ],
                throwOnError: false
            });
            // 3. 语法高亮
            contentBox.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }
    }
    type();
}

function showSelfAssessmentUI(q) {
    userAnswerInput.disabled = true;
    submitBtn.style.display = 'none';
    feedbackContainer.style.display = 'block';
    
    // 强制显示反馈区域，并注入自评交互
    feedbackWrongEl.style.display = 'block';
    feedbackWrongEl.innerHTML = `
        <div style="background:#fef9e7; padding:15px; border:1px solid #f39c12; border-radius:8px;">
            <p style="color:#e67e22; font-weight:bold;"><i class="fas fa-edit"></i> 请进行自评</p>
            <p><strong>【标准答案】：</strong><br>${marked.parse(q.correct_answer)}</p>
            <p><strong>【题目解析】：</strong><br>${marked.parse(q.analysis || '暂无解析')}</p>
            <hr style="border:0.5px dashed #f39c12;">
            <p>对比你的回答，你觉得自己掌握了吗？</p>
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button onclick="handleSelfAssessment(true, ${q.id})" class="btn-primary" style="background:#27ae60;">做对了</button>
                <button onclick="handleSelfAssessment(false, ${q.id})" class="btn-primary" style="background:#e74c3c;">做错了</button>
                <button onclick="startAiGrading(${JSON.stringify(q).replace(/"/g, '&quot;')})" class="btn-ai" style="display:inline-block; background:#9b59b6;">让 AI 老师评分</button>
            </div>
        </div>
    `;
}
// --- 修复后的自评逻辑 ---
async function handleSelfAssessment(isCorrect, questionId) {
    // 保存记录
    fetchWithAuth('/.netlify/functions/save-answer', {
        method: 'POST',
        body: JSON.stringify({ questionId, isCorrect, userAnswer: userAnswerInput.value, userId: window.user.id })
    });

    if (!isCorrect) {
        // 🟢 触发推送
        triggerRecommendationLogic(questionId); 
        alert("已记录到错题本，下方已为你匹配强化题。正在开启 AI 解析...");
        getAiAnalysisBtn.click(); 
    } else {
        alert("太棒了！继续保持。");
        nextQuestionBtn.click();
    }
} // 闭合 handleSelfAssessment

// --- 修复后的评分逻辑 ---
async function startAiGrading(q) {
    const studentAnswer = userAnswerInput.value;
    aiChatContainer.style.display = 'block';
    getAiAnalysisBtn.style.display = 'none';
    addMessageToLog('ai', '老师正在仔细阅读你的步骤，请稍候...');

    const gradingPrompt = `你是一名化学老师。请评阅以下大题并给出 0-100 的评分。
    请严格按以下 JSON 格式回复，严禁包含任何多余文字：
    { "score": 纯数字分数, "analysis": "简要分析", "socratic_question": "启发式提问" }
    【题目】：${q.full_question}
    【学生回答】：${studentAnswer}`;

    chatHistory = [{ role: "system", content: gradingPrompt }];
    await callAiAPI(); 
} // 闭合 startAiGrading

// --- 修复后的通用推送函数 ---
async function triggerRecommendationLogic(qId) {
    const recommendationContainer = document.getElementById('recommendation-container');
    const recommendationText = document.getElementById('recommendation-text');
    
    recommendationContainer.style.display = 'block';
    recommendationText.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> 正在为你匹配同类强化练习题...</p>';

    try {
        const response = await fetch('/.netlify/functions/recommend-question', {
            method: 'POST',
            body: JSON.stringify({ questionId: qId })
        });
        const recData = await response.json();

        if (recData && recData.id) {
            recommendationText.innerHTML = `
                <div style="background: #fff3e0; padding: 15px; border-left: 5px solid #ff9800; border-radius: 8px; margin-top: 15px;">
                    <strong style="color: #e67e22;"><i class="fas fa-lightbulb"></i> 针对性强化练习：</strong>
                    <p style="margin: 10px 0;">${recData.content}</p>
                    <button class="btn-primary" style="width:100%" 
                            onclick="window.location.href='quiz.html?id=${recData.id}'">
                        立即开始练习
                    </button>
                </div>`;
        }
    } catch (err) {
        console.error("推送加载失败:", err);
    }
} // 闭合 triggerRecommendationLogic