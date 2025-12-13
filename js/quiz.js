// js/quiz.js

let currentQuestions = [];
let currentIndex = 0;

// 获取 URL 参数
const urlParams = new URLSearchParams(window.location.search);
const chapterId = urlParams.get('id');

document.addEventListener('DOMContentLoaded', async () => {
    // 1. 检查 ID
    if (!chapterId) {
        document.getElementById('question-text').innerText = "未指定章节，请从主页进入。";
        return;
    }

    // 2. 加载题目
    await loadQuestions();
});

async function loadQuestions() {
    try {
        const res = await fetch(`/.netlify/functions/get-questions-by-chapter?id=${chapterId}`);
        if (!res.ok) throw new Error("加载失败");
        
        currentQuestions = await res.json();
        
        if (!currentQuestions || currentQuestions.length === 0) {
            document.getElementById('question-text').innerText = "本单元暂无题目，AI 正在录入中...";
            return;
        }

        // 随机打乱题目顺序 (可选)
        // currentQuestions.sort(() => Math.random() - 0.5);

        renderQuestion(0);
    } catch (err) {
        console.error(err);
        document.getElementById('question-text').innerText = "网络开小差了，请刷新重试。";
    }
}

function renderQuestion(index) {
    currentIndex = index;
    const q = currentQuestions[index];
    
    // 1. 题号
    document.getElementById('question-number').innerText = `${index + 1} / ${currentQuestions.length}`;
    
    // 2. 难度星星渲染 (0.1 ~ 0.9)
    const diffVal = parseFloat(q.difficulty || 0.5);
    // 映射: 0-0.2=1星, 0.3-0.4=2星, 0.5-0.6=3星, 0.7-0.8=4星, 0.9=5星
    let starCount = 3;
    if (diffVal <= 0.2) starCount = 1;
    else if (diffVal <= 0.4) starCount = 2;
    else if (diffVal <= 0.6) starCount = 3;
    else if (diffVal <= 0.8) starCount = 4;
    else starCount = 5;
    
    const starsHtml = '<i class="fas fa-star"></i>'.repeat(starCount) + '<i class="far fa-star"></i>'.repeat(5 - starCount);
    document.getElementById('difficulty-stars').innerHTML = `难度: ${starsHtml}`;

    // 3. 题目文本
    // 去掉可能的 "[question]1.1" 这种前缀
    const cleanText = q.full_question.replace(/^\[question\].*?\s+/, '');
    document.getElementById('question-text').innerText = cleanText;

    // 4. 图片渲染 (关键！)
    const imgContainer = document.getElementById('question-images-container');
    imgContainer.innerHTML = ''; // 清空旧图
    
    if (q.image_urls && q.image_urls.length > 0) {
        q.image_urls.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.style.maxHeight = '150px';
            img.style.borderRadius = '8px';
            img.style.cursor = 'zoom-in';
            // 点击查看大图
            img.onclick = () => window.open(url, '_blank');
            imgContainer.appendChild(img);
        });
    }

    // 5. 重置 UI 状态
    document.getElementById('user-answer-input').value = '';
    document.getElementById('user-answer-input').disabled = false;
    document.getElementById('submit-answer-btn').style.display = 'block';
    document.getElementById('feedback-container').style.display = 'none';
    document.getElementById('feedback-wrong').style.display = 'none';
    document.getElementById('feedback-correct').style.display = 'none';
    document.getElementById('ai-chat-container').style.display = 'none';
    document.getElementById('ai-chat-log').innerHTML = ''; // 清空聊天记录
}

// 提交答案
document.getElementById('submit-answer-btn').addEventListener('click', () => {
    const userAnswer = document.getElementById('user-answer-input').value.trim();
    if (!userAnswer) {
        alert("写点什么吧，不要交白卷哦！");
        return;
    }

    const q = currentQuestions[currentIndex];
    
    // 显示反馈区
    document.getElementById('submit-answer-btn').style.display = 'none';
    document.getElementById('user-answer-input').disabled = true;
    document.getElementById('feedback-container').style.display = 'block';

    // 简单判分 (严格匹配)
    // 实际场景中，简答题很难完全匹配，这里默认当做“错误/待完善”处理，除非完全一致
    const isCorrect = (userAnswer === q.correct_answer.trim());

    if (isCorrect) {
        document.getElementById('feedback-correct').style.display = 'block';
    } else {
        // 显示错误面板
        document.getElementById('feedback-wrong').style.display = 'block';
        document.getElementById('correct-answer-text').innerText = q.correct_answer;
        
        // 显示知识点
        let kpName = "综合考点";
        if (q.question_knowledge_point_link && q.question_knowledge_point_link.length > 0) {
            // 取第一个知识点显示
            kpName = q.question_knowledge_point_link[0].knowledge_points.title; 
        }
        document.getElementById('related-keypoint').innerText = kpName;

        // 显示易错提示 (AI 在入库时生成的)
        if (q.error_analysis) {
            document.getElementById('recommendation-container').style.display = 'block';
            document.getElementById('recommendation-text').innerText = q.error_analysis;
        } else {
            document.getElementById('recommendation-container').style.display = 'none';
        }
    }
});

// 下一题
document.getElementById('next-question-btn').addEventListener('click', () => {
    if (currentIndex < currentQuestions.length - 1) {
        renderQuestion(currentIndex + 1);
    } else {
        document.getElementById('quiz-container').style.display = 'none';
        document.getElementById('quiz-complete-container').style.display = 'block';
    }
});

// === AI 老师逻辑 ===

document.getElementById('get-ai-analysis-btn').addEventListener('click', async () => {
    const btn = document.getElementById('get-ai-analysis-btn');
    const chatContainer = document.getElementById('ai-chat-container');
    const log = document.getElementById('ai-chat-log');

    // UI 变化
    btn.style.display = 'none'; // 点击后隐藏按钮
    chatContainer.style.display = 'block';

    // 添加 "正在思考" 消息
    const loadingId = 'loading-' + Date.now();
    addMessageToLog('ai', '老师正在分析你的答案，请稍等...', loadingId);

    const q = currentQuestions[currentIndex];
    const userAnswer = document.getElementById('user-answer-input').value;

    try {
        // 1. 组装 Prompt (苏格拉底教学法)
        const prompt = `
你是一位亲切的初中化学老师。学生做错了这道题，请你进行辅导。

【题目】${q.full_question}
【正确答案】${q.correct_answer}
【解析】${q.analysis}

【学生的回答】
${userAnswer}

【要求】
1. 先肯定学生（如果沾边的话），指出他哪里想对了。
2. 指出核心错误点。
3. 也就是“苏格拉底式提问”，引导他自己想出正确逻辑，不要直接灌输。
4. 语气要轻松幽默。
`;

        // 2. 调用 DeepSeek 后端
        const res = await fetch('/.netlify/functions/get-ai-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: "user", content: prompt }]
            })
        });

        if (!res.ok) throw new Error("AI 响应异常");

        // 3. 处理特殊的拼接响应 (关键！)
        const rawText = await res.text();
        let finalContent = "";

        // 你的后端返回的是一堆 "data: {...}" 拼在一起的字符串
        // 我们用正则把 content 抠出来
        const regex = /"content":"(.*?)"/g;
        let match;
        while ((match = regex.exec(rawText)) !== null) {
            // 修复转义字符: \\n -> \n, \\" -> "
            let chunk = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            finalContent += chunk;
        }

        // 如果正则没匹配到，尝试直接 parse（防止非流式返回）
        if (!finalContent) {
             try {
                 const json = JSON.parse(rawText);
                 if(json.choices) finalContent = json.choices[0].message.content;
             } catch(e) {}
        }
        
        if (!finalContent) finalContent = "解析生成完毕，但格式似乎有点问题。请参考标准答案。";

        // 4. 更新 UI
        const loadingDiv = document.getElementById(loadingId);
        if (loadingDiv) log.removeChild(loadingDiv);
        
        // 模拟打字机效果显示
        typeWriterEffect('ai', finalContent);

    } catch (err) {
        console.error(err);
        const loadingDiv = document.getElementById(loadingId);
        if (loadingDiv) log.removeChild(loadingDiv);
        addMessageToLog('ai', '哎呀，老师掉线了，请稍后再试。');
    }
});

// 辅助函数：添加消息框
function addMessageToLog(role, text, id = null) {
    const log = document.getElementById('ai-chat-log');
    const div = document.createElement('div');
    div.className = `chat-message ${role === 'user' ? 'user-message' : 'ai-message'}`;
    if (id) div.id = id;
    
    const avatarIcon = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
    
    div.innerHTML = `
        <div class="avatar">${avatarIcon}</div>
        <div class="message-content">${text}</div>
    `;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
}

// 辅助函数：打字机效果
function typeWriterEffect(role, fullText) {
    const log = document.getElementById('ai-chat-log');
    // 创建一个空消息框
    const div = document.createElement('div');
    div.className = `chat-message ai-message`;
    div.innerHTML = `
        <div class="avatar"><i class="fas fa-robot"></i></div>
        <div class="message-content"></div>
    `;
    log.appendChild(div);
    
    const contentBox = div.querySelector('.message-content');
    let i = 0;
    const speed = 20; // 打字速度

    function type() {
        if (i < fullText.length) {
            contentBox.textContent += fullText.charAt(i);
            i++;
            log.scrollTop = log.scrollHeight;
            setTimeout(type, speed);
        }
    }
    type();
}