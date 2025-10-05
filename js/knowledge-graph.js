// js/knowledge-graph.js (最终完整版)

// 全局函数，用于处理拖拽
function allowDrop(ev) { ev.preventDefault(); }
function drag(ev) { ev.dataTransfer.setData("node-type", ev.target.getAttribute('data-node-type')); }

document.addEventListener('DOMContentLoaded', function() {
    // 确保 main.js 中的 supabaseClient 已经初始化
    if (typeof supabaseClient === 'undefined') {
        console.error("Supabase client not found. Make sure main.js is loaded first.");
        return;
    }

    // --- 1. 获取当前图谱ID ---
    const urlParams = new URLSearchParams(window.location.search);
    const graphId = urlParams.get('id');

    if (!graphId) {
        document.getElementById('drawflow').innerHTML = '<div class="detail-card"><h1>错误：未指定图谱ID。</h1><p>请从“我的知识图谱”页面进入。</p></div>';
        return;
    }

    // --- 2. 初始化画板 ---
    const editor = new Drawflow(document.getElementById("drawflow"));
    editor.start();

    let lastFocusedTextarea = null; // 追踪最后点击的输入框

    // --- 3. 拖拽与工具箱逻辑 ---
    window.drop = function(ev) {
        ev.preventDefault();
        const nodeType = ev.dataTransfer.getData("node-type");
        let nodeName = '';
        if (nodeType === 'concept') nodeName = '核心概念';
        else if (nodeType === 'example') nodeName = '具体实例';
        
        if (nodeName) {
            const data = { text: '' };
            const nodeHTML = `<div><textarea df-text placeholder="输入内容..."></textarea></div>`;
            editor.addNode(nodeName, 1, 1, ev.clientX, ev.clientY, nodeName, data, nodeHTML);
        }
    }
    
    const toolbox = document.querySelector('.toolbox');
    if (toolbox) {
        document.getElementById('drawflow').addEventListener('focusin', (e) => {
            if(e.target.tagName === 'TEXTAREA') { lastFocusedTextarea = e.target; }
        });

        toolbox.addEventListener('click', (e) => {
            const target = e.target.closest('[data-element]') || e.target.closest('[data-symbol]');
            if (!target) return;
            if (!lastFocusedTextarea) {
                alert("请先点击一个卡片中的输入框。");
                return;
            }
            const textToInsert = target.dataset.element || target.dataset.symbol;
            insertTextAtCursor(lastFocusedTextarea, textToInsert);
            saveGraph(); // 插入后自动保存
        });
    }

    // --- 4. 保存、加载与实时同步 ---
    function debounce(func, delay) {
        let timeout;
        return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); };
    }

    const saveGraph = debounce(async () => {
        if (!user) return; // 如果用户未登录，不保存
        const graphData = editor.export();
        try {
            // 使用带认证的 fetch 辅助函数
            await fetchWithAuth('/.netlify/functions/save-graph', {
                method: 'POST',
                body: JSON.stringify({
                    graphId: graphId,
                    graphData: graphData.drawflow 
                })
            });
            console.log(`图谱 (ID: ${graphId}) 已自动保存！`);
        } catch (error) { console.error("自动保存失败:", error); }
    }, 1000); // 延迟1秒保存

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

    const channel = supabaseClient.channel(`knowledge_graph_${graphId}`);
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'knowledge_graphs', filter: `id=eq.${graphId}` }, (payload) => {
        console.log('收到远程更新，正在同步画板...');
        const currentUserEditing = document.activeElement.tagName === 'TEXTAREA';
        if (!currentUserEditing) {
             editor.import({ "drawflow": payload.new.graph_data });
        } else {
            console.log("用户正在编辑，已跳过本次自动同步以避免冲突。");
        }
    }).subscribe();

    // --- 5. 删除功能 (双保险) ---
    // 方法A: 键盘删除
    editor.on('keydown', function(e) {
        if (e.keyCode === 46 || e.keyCode === 8) { // Delete or Backspace
            if (editor.precanvas.selected_node && document.activeElement.tagName !== 'TEXTAREA') {
                editor.removeNodeId('node-' + editor.precanvas.selected_node.id);
            }
        }
    });

    // 方法B: 按钮删除
    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (editor.precanvas.selected_node) {
                editor.removeNodeId('node-' + editor.precanvas.selected_node.id);
            } else {
                alert('请先通过单击选中一个卡片，然后再删除。');
            }
        });
    }
    
    // --- 6. 辅助函数与事件监听 ---
    function insertTextAtCursor(textarea, text) {
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const oldValue = textarea.value;
        textarea.value = oldValue.substring(0, start) + text + oldValue.substring(end);
        textarea.focus();
        textarea.selectionEnd = start + text.length;
        // 手动触发 input 事件，以便 Drawflow 知道内容已更改
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // 监听所有编辑操作，触发自动保存
    editor.on('nodeCreated', saveGraph);
    editor.on('nodeRemoved', saveGraph);
    editor.on('nodeMoved', saveGraph);
    editor.on('connectionCreated', saveGraph);
    editor.on('connectionRemoved', saveGraph);
    // 使用 input 事件监听文本变化，比 clickEnd 更可靠
    editor.on('change', (event) => {
        if (event.target && event.target.matches('textarea[df-text]')) {
            saveGraph();
        }
    });


    // --- 7. 初始加载与认证 ---
    let user = null;

    // 创建带认证的 fetch 辅助函数
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
        return response.json();
    }
    
    // 等待 main.js 确认用户身份
    document.addEventListener('userReady', (e) => {
        user = e.detail;
        loadGraph(); // 用户信息就绪后，加载图谱
    });

    // 如果 userReady 事件已经错过，手动检查
    if(supabaseClient.auth.user()) {
        user = supabaseClient.auth.user();
        loadGraph();
    }
});