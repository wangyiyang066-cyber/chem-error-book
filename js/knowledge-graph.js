// js/knowledge-graph.js (终极整合版)

document.addEventListener('DOMContentLoaded', function() {
    // --- 1. 获取当前要编辑的图谱ID ---
    const urlParams = new URLSearchParams(window.location.search);
    const graphId = urlParams.get('id');

    if (!graphId) {
        document.getElementById('drawflow').innerHTML = '<div class="detail-card"><h1>错误：未指定图谱ID。</h1><p>请从“我的知识图谱”页面进入。</p></div>';
        return;
    }

    // --- 2. 配置与初始化 ---
    const SUPABASE_URL = 'https://ghuyiwhqdellucjxqiwj.supabase.co'; // <<< 填入你的信息
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodXlpd2hxZGVsbHVjanhxaXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQzNDA5NCwiZXhwIjoyMDczMDEwMDk0fQ.op6RPiEDsjSnwy5yMRq3Got0dfLzPxGKWc0PFa8D5Go'; // <<< 填入你的信息
    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const editor = new Drawflow(document.getElementById("drawflow"));
    editor.start();

    let selectedColor = '#3498db'; // 默认节点颜色
    let lastFocusedTextarea = null; // 追踪最后点击的输入框

    // --- 3. 拖拽、颜色选择与工具箱逻辑 ---
    window.allowDrop = function(ev) { ev.preventDefault(); }
    window.drag = function(ev) { ev.dataTransfer.setData("node-type", ev.target.getAttribute('data-node-type')); }
    window.drop = function(ev) {
        ev.preventDefault();
        const nodeType = ev.dataTransfer.getData("node-type");
        let nodeName = '';
        if (nodeType === 'concept') nodeName = '核心概念';
        else if (nodeType === 'example') nodeName = '具体实例';
        
        if (nodeName) {
            const data = { color: selectedColor, text: '' };
            const nodeHTML = `<div><textarea df-text placeholder="输入内容..."></textarea></div>`;
            const nodeId = editor.addNode(nodeName, 1, 1, ev.clientX, ev.clientY, nodeName, data, nodeHTML);
            updateNodeStyle(nodeId, selectedColor);
        }
    }
    
    const colorPicker = document.querySelector('.color-picker');
    if(colorPicker) {
        colorPicker.addEventListener('click', (e) => {
            if (e.target.dataset.color) {
                selectedColor = e.target.dataset.color;
                colorPicker.querySelectorAll('span.selected').forEach(el => el.classList.remove('selected'));
                e.target.classList.add('selected');
            }
        });
    }

    const toolbox = document.querySelector('.toolbox');
    if (toolbox) {
        document.getElementById('drawflow').addEventListener('focusin', (e) => {
            if(e.target.tagName === 'TEXTAREA') {
                lastFocusedTextarea = e.target;
            }
        });

        function insertTextAtCursor(textarea, text) {
            if (!textarea) return;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
            textarea.focus();
            textarea.selectionEnd = start + text.length;
        }

        toolbox.addEventListener('click', (e) => {
            const target = e.target.closest('[data-element]') || e.target.closest('[data-symbol]');
            if (!target) return;
            if (!lastFocusedTextarea) {
                alert("请先点击一个卡片中的输入框。");
                return;
            }
            const textToInsert = target.dataset.element || target.dataset.symbol;
            insertTextAtCursor(lastFocusedTextarea, textToInsert);
            saveGraph();
        });
    }

    // --- 4. 保存、加载与实时同步 ---
    function debounce(func, delay) {
        let timeout;
        return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); };
    }

    const saveGraph = debounce(async () => {
        const graphData = editor.export();
        try {
            await fetch('/.netlify/functions/save-graph', {
                method: 'POST',
                body: JSON.stringify({
                    graphId: graphId,
                    graphData: graphData.drawflow 
                })
            });
            console.log(`图谱 (ID: ${graphId}) 已自动保存！`);
        } catch (error) { console.error("自动保存失败:", error); }
    }, 1500);

    async function loadGraph() {
        try {
            const response = await fetch('/.netlify/functions/get-graph', {
                method: 'POST',
                body: JSON.stringify({ graphId: graphId })
            });
            const graphData = await response.json();
            if (graphData) {
                editor.import({ "drawflow": graphData });
            }
        } catch (error) { console.error("加载图谱失败:", error); }
    }

    const channel = supabaseClient.channel(`knowledge_graph_${graphId}`);
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'knowledge_graphs', filter: `id=eq.${graphId}` }, (payload) => {
        console.log('收到远程更新，正在同步画板...');
        const currentUserEditing = editor.precanvas.selected_node || document.activeElement.tagName === 'TEXTAREA';
        if (!currentUserEditing) {
             editor.import({ "drawflow": payload.new.graph_data });
        } else {
            console.log("用户正在编辑，已跳过本次自动同步以避免冲突。");
        }
    }).subscribe();

    // --- 5. 核心体验优化功能 ---
    function updateNodeStyle(nodeId, color) {
        const nodeElement = document.querySelector(`#node-${nodeId} .title-box`);
        if (nodeElement) {
            nodeElement.style.backgroundColor = color;
        }
    }

    editor.on('import', function() {
        const nodes = editor.export().drawflow.main.data;
        for (const id in nodes) {
            const color = nodes[id].data.color;
            if (color) {
                updateNodeStyle(id, color);
            }
        }
    });
    
    editor.on('keydown', function(e) {
        if (e.keyCode === 46 || e.keyCode === 8) {
            if (editor.precanvas.selected_node) {
                editor.removeNodeId('node-' + editor.precanvas.selected_node.id);
            }
        }
    });

    editor.on('nodeCreated', saveGraph);
    editor.on('nodeRemoved', saveGraph);
    editor.on('nodeMoved', saveGraph);
    editor.on('connectionCreated', saveGraph);
    editor.on('connectionRemoved', saveGraph);
    editor.on('clickEnd', saveGraph);

    // --- 6. 初始加载 ---
    loadGraph();
});