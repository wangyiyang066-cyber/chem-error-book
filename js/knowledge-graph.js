// js/knowledge-graph.js (最终干净版)

// -----------------------------------------------------------------------------
// 全局区域: 定义拖拽函数和 editor 变量
// -----------------------------------------------------------------------------
let editor; 

function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev) {
    ev.dataTransfer.setData("node-type", ev.target.getAttribute('data-node-type'));
}

function drop(ev) {
    ev.preventDefault();
    if (!editor) return; // 安全检查，确保 editor 已初始化

    const nodeType = ev.dataTransfer.getData("node-type");
    let nodeName = '';
    if (nodeType === 'concept') nodeName = '核心概念';
    else if (nodeType === 'example') nodeName = '具体实例';
    
    if (nodeName) {
        // 精确计算节点在画板上的位置（考虑平移和缩放）
        const canvasRect = editor.precanvas.getBoundingClientRect();
        const pos_x = (ev.clientX - canvasRect.x) / editor.zoom - (editor.canvas_x / editor.zoom);
        const pos_y = (ev.clientY - canvasRect.y) / editor.zoom - (editor.canvas_y / editor.zoom);
        
        editor.addNode(nodeName, 1, 1, pos_x, pos_y, nodeName, { text: '' }, `<div><textarea df-text placeholder="输入内容..."></textarea></div>`);
    }
}

// -----------------------------------------------------------------------------
// 主逻辑区域: 页面加载完成后执行
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function() {

    if (typeof supabaseClient === 'undefined') {
        alert("客户端初始化失败，请检查 main.js。");
        return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const graphId = urlParams.get('id');
    if (!graphId) {
        document.getElementById('drawflow').innerHTML = '<h1>错误：未指定图谱ID。</h1>';
        return;
    }

    // 将创建的 editor 实例赋值给全局变量
    editor = new Drawflow(document.getElementById("drawflow"));
    editor.start();

    // --- 状态变量 ---
    let lastFocusedTextarea = null;
    let isInitialized = false;
    let isLocalChange = false; 

    // --- 工具箱逻辑 ---
    const toolbox = document.querySelector('.toolbox');
    if (toolbox) {
        document.getElementById('drawflow').addEventListener('focusin', (e) => {
            if(e.target.tagName === 'TEXTAREA') { lastFocusedTextarea = e.target; }
        });
        toolbox.addEventListener('click', (e) => {
            const target = e.target.closest('[data-element]') || e.target.closest('[data-symbol]');
            if (!target || !lastFocusedTextarea) return;
            insertTextAtCursor(lastFocusedTextarea, target.dataset.element || target.dataset.symbol);
            saveGraph();
        });
    }

    // --- 核心功能函数 ---
    async function fetchWithAuth(url, options = {}) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) { throw new Error('用户未认证，请重新登录。'); }
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
        isLocalChange = true;
        const graphData = editor.export();
        console.log("正在自动保存...");
        try {
            await fetchWithAuth('/.netlify/functions/save-graph', {
                method: 'POST',
                body: JSON.stringify({ graphId: graphId, graphData: graphData.drawflow })
            });
            console.log(`图谱 (ID: ${graphId}) 保存成功！`);
        } catch (error) { 
            console.error("自动保存失败:", error.message); 
        } finally {
            setTimeout(() => { isLocalChange = false; }, 2000); 
        }
    }, 1500);

    async function loadGraph() {
        console.log("正在加载图谱...");
        try {
            const graphData = await fetchWithAuth('/.netlify/functions/get-graph', {
                method: 'POST',
                body: JSON.stringify({ graphId: graphId })
            });
            if (graphData) {
                editor.import({ "drawflow": graphData });
            }
        } catch (error) { 
            console.error("加载失败:", error.message); 
            document.getElementById('drawflow').innerHTML = `<h1>加载图谱失败</h1><p>${error.message}</p>`;
        }
    }
    
    function insertTextAtCursor(textarea, text) {
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
        textarea.focus();
        textarea.selectionEnd = start + text.length;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // --- 事件监听器 ---
    const channel = supabaseClient.channel(`knowledge_graph_${graphId}`);
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'knowledge_graphs', filter: `id=eq.${graphId}` }, (payload) => {
        console.log('收到远程更新...');
        if (!isLocalChange) {
            console.log('非本地修改，正在同步画板...');
            editor.import({ "drawflow": payload.new.graph_data });
        } else {
            console.log('本地修改进行中，跳过同步。');
        }
    }).subscribe();

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

    // --- 页面初始化 ---
    function initializePage() {
        if (isInitialized) return;
        isInitialized = true;
        loadGraph();
    }

    document.addEventListener('userReady', initializePage);

    setTimeout(() => {
        if (!isInitialized && supabaseClient.auth.getSession()) {
             initializePage();
        }
    }, 500);
});