// js/knowledge-graph.js (最终完整版)

// -----------------------------------------------------------------------------
// 全局函数 (必须放在顶层，以便 HTML 的 ondrag/ondrop 属性可以调用)
// -----------------------------------------------------------------------------
function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev) {
    ev.dataTransfer.setData("node-type", ev.target.getAttribute('node-type'));
}

// -----------------------------------------------------------------------------
// 主逻辑 (在页面加载完成后执行)
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function() {

    // --- 0. 初始检查 ---
    if (typeof supabaseClient === 'undefined') {
        console.error("Supabase client not found. Make sure main.js is loaded before knowledge-graph.js.");
        alert("初始化失败，请刷新页面重试。");
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const graphId = urlParams.get('id');

    if (!graphId) {
        document.getElementById('drawflow').innerHTML = '<div class="detail-card"><h1>错误：未指定图谱ID。</h1><p>请从“我的知识图谱”页面进入。</p></div>';
        return;
    }

    // --- 1. 初始化画板和状态变量 ---
    const editor = new Drawflow(document.getElementById("drawflow"));
    editor.start();

    let lastFocusedTextarea = null;
    let isInitialized = false; // 防止重复初始化的旗帜

    // --- 2. 拖拽与工具箱逻辑 ---
    window.drop = function(ev) {
        ev.preventDefault();
        const nodeType = ev.dataTransfer.getData("node-type");
        let nodeName = '';
        if (nodeType === 'concept') nodeName = '核心概念';
        else if (nodeType === 'example') nodeName = '具体实例';
        
        if (nodeName) {
            editor.addNode(nodeName, 1, 1, ev.clientX, ev.clientY, nodeName, { text: '' }, `<div><textarea df-text placeholder="输入内容..."></textarea></div>`);
        }
    }
    
    const toolbox = document.querySelector('.toolbox');
    if (toolbox) {
        document.getElementById('drawflow').addEventListener('focusin', (e) => {
            if(e.target.tagName === 'TEXTAREA') { lastFocusedTextarea = e.target; }
        });

        toolbox.addEventListener('click', (e) => {
            const target = e.target.closest('[data-element]') || e.target.closest('[data-symbol]');
            if (!target || !lastFocusedTextarea) return;
            
            const textToInsert = target.dataset.element || target.dataset.symbol;
            insertTextAtCursor(lastFocusedTextarea, textToInsert);
            saveGraph();
        });
    }

    // --- 3. 核心功能函数 ---

    // 带用户认证的 fetch 辅助函数
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

    const saveGraph = debounce(async () => {
        const graphData = editor.export();
        console.log("正在尝试自动保存...");
        try {
            await fetchWithAuth('/.netlify/functions/save-graph', {
                method: 'POST',
                body: JSON.stringify({ graphId: graphId, graphData: graphData.drawflow })
            });
            console.log(`图谱 (ID: ${graphId}) 已成功自动保存！`);
        } catch (error) { 
            console.error("自动保存失败:", error.message); 
        }
    }, 1500);

    async function loadGraph() {
        console.log("正在加载图谱数据...");
        try {
            const graphData = await fetchWithAuth('/.netlify/functions/get-graph', {
                method: 'POST',
                body: JSON.stringify({ graphId: graphId })
            });
            if (graphData) {
                editor.import({ "drawflow": graphData });
            }
        } catch (error) { 
            console.error("加载图谱失败:", error.message); 
            document.getElementById('drawflow').innerHTML = `<div class="detail-card"><h1>加载图谱失败</h1><p>${error.message}</p></div>`;
        }
    }
    
    function insertTextAtCursor(textarea, text) {
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
        textarea.focus();
        textarea.selectionEnd = start + text.length;
        textarea.dispatchEvent(new Event('input', { bubbles: true })); // 确保 Drawflow 能检测到变化
    }

    // --- 4. 绑定所有事件监听器 ---

    // 监听实时同步
    const channel = supabaseClient.channel(`knowledge_graph_${graphId}`);
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'knowledge_graphs', filter: `id=eq.${graphId}` }, (payload) => {
        console.log('收到远程更新...');
        const currentUserEditing = document.activeElement.tagName === 'TEXTAREA';
        if (!currentUserEditing) {
             editor.import({ "drawflow": payload.new.graph_data });
        }
    }).subscribe();

    // 监听所有编辑操作，触发自动保存
    editor.on('nodeCreated', saveGraph);
    editor.on('nodeRemoved', saveGraph);
    editor.on('nodeMoved', saveGraph);
    editor.on('connectionCreated', saveGraph);
    editor.on('connectionRemoved', saveGraph);
    editor.on('change', (event) => {
        if (event.target && event.target.matches('textarea[df-text]')) {
            saveGraph();
        }
    });

    // 监听删除操作 (键盘 + 按钮)
    editor.on('keydown', function(e) {
        if ((e.keyCode === 46 || e.keyCode === 8) && editor.precanvas.selected_node && document.activeElement.tagName !== 'TEXTAREA') {
            editor.removeNodeId('node-' + editor.precanvas.selected_node.id);
        }
    });

    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (editor.precanvas.selected_node) {
                editor.removeNodeId('node-' + editor.precanvas.selected_node.id);
            } else {
                alert('请先单击选中一个卡片，然后再删除。');
            }
        });
    }

    // --- 5. 初始加载逻辑 ---
    
    // 定义一个只运行一次的初始化函数
    function initializePage() {
        if (isInitialized) return; // 如果已经初始化，直接返回
        isInitialized = true; // 设置旗帜，防止重复
        loadGraph();
    }

    // 等待 main.js 确认用户身份
    document.addEventListener('userReady', initializePage);

    // 兼容 userReady 事件可能已错过的情况
    // (例如，页面加载很慢，但用户早已登录)
    setTimeout(() => {
        if (!isInitialized && supabaseClient.auth.getSession()) {
             console.log("userReady event might have been missed. Initializing manually.");
             initializePage();
        }
    }, 500); // 延迟500毫秒检查
});