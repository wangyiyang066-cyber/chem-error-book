// js/quiz.js (最终完美版：兼容所有模式 + 智能数据解析)

document.addEventListener('userReady', () => {
    if (!user) {
        console.error("用户未登录，无法加载题目。");
        alert("请先登录！");
        window.location.href = 'index.html';
        return;
    }

    // --- 变量初始化 ---
    let questionSet = [];
    let currentQuestionIndex = 0;
    
    // --- DOM 元素获取 ---
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

    // --- 1. 启动答题会话 ---
    async function startQuizSession() {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode'); 
        const chapterId = urlParams.get('id');

        try {
            questionTextEl.textContent = '正在从云端拉取题目...';
            let apiUrl = '';
            
            // --- 路由分发 ---
            if (mode === 'review') {
                // 1. 复习模式：从错题本过来的
                document.querySelector('h1').textContent = '错题巩固模式';
                const qId = urlParams.get('questionId');
                // 这里我们复用 get-question-by-id (假设你有这个函数，或者用通用查询)
                // 如果没有这个函数，你需要确保后端能查单题
                if(qId) apiUrl = `/.netlify/functions/get-question-by-id?id=${qId}`;
            } else if (mode === 'comprehensive') {
                // 2. 综合模式
                document.querySelector('h1').textContent = '综合模拟考试';
                apiUrl = `/.netlify/functions/get-comprehensive-exam`;
            } else {
                // 3. 默认：章节练习
                if (!chapterId) { alert("未指定章节ID"); return; }
                apiUrl = `/.netlify/functions/get-questions-by-chapter?id=${chapterId}`;
            }

            const data = await fetchWithAuth(apiUrl);
            
            // 兼容性处理：有的API返回数组，有的返回单个对象
            let rawQuestions = Array.isArray(data) ? data : [data];
            
            if (!rawQuestions || rawQuestions.length === 0 || !rawQuestions[0]) {
                questionTextEl.textContent = '未找到相关题目，可能已删除或加载失败。';
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
        difficultyStarsEl.innerHTML = `难度: ${'<i class="fas fa-star"></i>'.repeat(starCount)}${'<i class="far fa-star"></i>'.repeat(5-starCount)}`;

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

        // A. 保存做题记录 (这是存到 answers 表，用于历史记录)
        try {
            await fetchWithAuth('/.netlify/functions/save-answer', {
                method: 'POST',
                body: JSON.stringify({ 
                    questionId: q.id, isCorrect, userAnswer, userId: user.id 
                })
            });
        } catch (e) { console.error("保存记录失败", e); }

        // B. 如果是复习模式，必须更新 review_queue (间隔算法)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'review') {
            const reviewId = urlParams.get('reviewId');
            if (reviewId) {
                try {
                    await fetchWithAuth('/.netlify/functions/update-review-status', {
                        method: 'POST',
                        body: JSON.stringify({ reviewId: reviewId, isCorrect: isCorrect })
                    });
                    console.log("复习计划已更新");
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
            
            // 🔥 核心修正：智能解析知识点名称
            // 兼容 knowledge_nodes.title 和 knowledge_points.name
            let kpText = "综合";
            if (q.question_knowledge_point_link && q.question_knowledge_point_link.length > 0) {
                kpText = q.question_knowledge_point_link.map(link => {
                    // 优先找 knowledge_nodes (新版)，如果没找到找 knowledge_points (旧版)
                    const node = link.knowledge_nodes || link.knowledge_points;
                    return node ? (node.title || node.name) : "未知考点";
                }).join(", ");
            }
            relatedKeypointEl.textContent = kpText;

            // 推荐逻辑
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
            // 复习模式做完一道题，直接回错题本
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
            if (!content) { // 备用非流式解析
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
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) throw new Error("未登录");
        const headers = { ...options.headers, 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };
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

    startQuizSession();
});