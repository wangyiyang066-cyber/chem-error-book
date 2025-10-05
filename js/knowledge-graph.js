// js/knowledge-graph.js (最终完整版 - 包含可靠的自动保存)

// ... (全局的 allowDrop 和 drag 函数保持不变) ...
function allowDrop(ev) { ev.preventDefault(); }
function drag(ev) { ev.dataTransfer.setData("node-type", ev.target.getAttribute('node-type')); }

document.addEventListener('DOMContentLoaded', function() {
    // ... (获取 graphId 和 初始化 editor 的代码保持不变) ...
    const urlParams = new URLSearchParams(window.location.search);
    const graphId = urlParams.get('id');
    if (!graphId) { /* ... 错误处理 ... */ return; }
    const editor = new Drawflow(document.getElementById("drawflow"));
    editor.start();

    let lastFocusedTextarea = null;

    // ... (拖拽与工具箱逻辑保持不变) ...
    window.drop = function(ev) { /* ... */ };
    const toolbox = document.querySelector('.toolbox');
    if (toolbox) { /* ... */ }

    // --- ▼▼▼ 核心：保存、加载与实时同步的最终逻辑 ▼▼▼ ---

    // 创建一个带认证的 fetch 辅助函数 (这个很重要)
    async function fetchWithAuth(url, options = {}) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            alert('用户未登录或会话已过期，请重新登录。');
            window.location.href = 'index.html';
            throw new Error('User not authenticated');
        }
        const headers = { ...options.headers, 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` };
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(errorData.message);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    function debounce(func, delay) {
        let timeout;
        return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); };
    }

    // 自动保存函数，现在会调用我们新建的 save-graph 云函数
    const saveGraph = debounce(async () => {
        const graphData = editor.export();
        console.log("正在尝试自动保存...");
        try {
            await fetchWithAuth('/.netlify/functions/save-graph', {
                method: 'POST',
                body: JSON.stringify({
                    graphId: graphId,
                    graphData: graphData.drawflow // 发送 drawflow 的核心数据
                })
            });
            console.log(`图谱 (ID: ${graphId}) 已成功自动保存！`);
        } catch (error) { 
            console.error("自动保存失败:", error.message); 
        }
    }, 1500); // 停止操作后 1.5 秒触发保存

    async function loadGraph() {
        try {
            const graphData = await fetchWithAuth('/.netlify/functions/get-graph', {
                method: 'POST',
                body: JSON.stringify({ graphId: graphId })
            });
            if (graphData) {
                editor.import({ "drawflow": graphData });
            }
        } catch (error) { console.error("加载图谱失败:", error); }
    }

    // ... (实时同步的 channel 逻辑保持不变) ...
    const channel = supabaseClient.channel(`knowledge_graph_${graphId}`);
    channel.on('postgres_changes', { /* ... */ }).subscribe();

    // --- 监听所有会改变图谱的操作，并触发自动保存 ---
    editor.on('nodeCreated', saveGraph);
    editor.on('nodeRemoved', saveGraph);
    editor.on('nodeMoved', saveGraph);
    editor.on('connectionCreated', saveGraph);
    editor.on('connectionRemoved', saveGraph);
    // 使用 Drawflow 内部的 change 事件来监听文本框内容变化
    editor.on('change', (event) => {
        if (event.target && event.target.matches('textarea[df-text]')) {
            saveGraph();
        }
    });


    // ... (删除功能的代码保持不变) ...
    editor.on('keydown', function(e) { /* ... */ });
    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) { deleteBtn.addEventListener('click', () => { /* ... */ }); }
    
    // ... (辅助函数 insertTextAtCursor 保持不变) ...
    function insertTextAtCursor(textarea, text) { /* ... */ }

    // --- 初始加载 ---
    document.addEventListener('userReady', () => {
        loadGraph();
    });
    // 兼容 userReady 事件可能已错过的情况
    if (window.user) {
        loadGraph();
    }
});