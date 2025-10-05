// js/knowledge-graph.js (V3.1 - 核心体验优化版)

document.addEventListener('DOMContentLoaded', function() {
    // --- 1. 配置与初始化 ---
    const SUPABASE_URL = '你自己的 Supabase Project URL'; // <<< 填入你的信息
    const SUPABASE_ANON_KEY = '你自己的 Supabase anon public 密钥'; // <<< 填入你的信息
    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const editor = new Drawflow(document.getElementById("drawflow"));
    editor.start();

    let selectedColor = '#3498db'; // 默认节点颜色

    // --- 2. 拖拽与颜色选择 ---
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
    
    // 颜色选择器逻辑
    const colorPicker = document.querySelector('.color-picker');
    colorPicker.addEventListener('click', (e) => {
        if (e.target.dataset.color) {
            selectedColor = e.target.dataset.color;
            // 更新选中状态的视觉效果
            colorPicker.querySelectorAll('span.selected').forEach(el => el.classList.remove('selected'));
            e.target.classList.add('selected');
        }
    });

    // --- 3. 保存、加载与实时同步 ---
    function debounce(func, delay) {
        let timeout;
        return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); };
    }

    const saveGraph = debounce(async () => {
        const graphData = editor.export();
        try {
            await fetch('/.netlify/functions/save-graph', { method: 'POST', body: JSON.stringify(graphData.drawflow) });
            console.log("图谱已自动保存！");
        } catch (error) { console.error("自动保存失败:", error); }
    }, 1500); // 延长防抖时间，进一步减少卡顿

    async function loadGraph() {
        // ... (加载函数和之前一样)
    }

    const channel = supabaseClient.channel('knowledge_graph_updates');
    // ... (实时同步代码和之前一样)

    // --- 4. 核心功能升级 ---

    // 辅助函数：根据ID和颜色更新节点样式
    function updateNodeStyle(nodeId, color) {
        const nodeElement = document.querySelector(`#node-${nodeId} .title-box`);
        if (nodeElement) {
            nodeElement.style.backgroundColor = color;
        }
    }

    // 监听：当导入图谱完成时，为所有节点应用保存的颜色
    editor.on('import', function() {
        const nodes = editor.export().drawflow.main.data;
        for (const id in nodes) {
            const color = nodes[id].data.color;
            if (color) {
                updateNodeStyle(id, color);
            }
        }
    });
    
    // 监听：删除节点功能
    editor.on('keydown', function(e) {
        // 当按下 Delete 或 Backspace 键时
        if (e.keyCode === 46 || e.keyCode === 8) {
            if (editor.precanvas.selected_node) {
                // Drawflow 的删除方法需要完整的节点ID 'node-X'
                editor.removeNodeId('node-' + editor.precanvas.selected_node.id);
            }
        }
    });

    // 监听：优化性能，解决打字卡顿的问题
    editor.on('nodeCreated', saveGraph);
    editor.on('nodeRemoved', saveGraph);
    editor.on('nodeMoved', saveGraph);
    editor.on('connectionCreated', saveGraph);
    editor.on('connectionRemoved', saveGraph);
    // 我们移除了 'nodeDataChanged' 的监听。现在只有在用户完成编辑（比如点击节点外部）时，才会触发保存。
    editor.on('clickEnd', (e) => {
        // Drawflow 在点击结束时不直接提供节点信息，所以我们直接触发一次保存
        saveGraph();
    });



    const drawflowContainer = document.getElementById('drawflow');
    const toolbox = document.querySelector('.toolbox');

    // 记录最后被点击的输入框
    drawflowContainer.addEventListener('focusin', (e) => {
        if(e.target.tagName === 'TEXTAREA') {
            lastFocusedTextarea = e.target;
            console.log("已选中输入框:", lastFocusedTextarea);
        }
    });

    // 插入文本到光标所在位置的辅助函数
    function insertTextAtCursor(textarea, text) {
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const oldText = textarea.value;
        textarea.value = oldText.substring(0, start) + text + oldText.substring(end);
        textarea.focus();
        // 更新光标位置
        textarea.selectionEnd = start + text.length;
    }

    // 为整个工具箱添加点击事件监听
    toolbox.addEventListener('click', (e) => {
        const target = e.target.closest('[data-element]') || e.target.closest('[data-symbol]');
        if (!target) return;

        // 检查是否有选中的输入框
        if (!lastFocusedTextarea) {
            alert("请先点击一个卡片中的输入框，再选择元素或符号。");
            return;
        }

        const textToInsert = target.dataset.element || target.dataset.symbol;
        
        insertTextAtCursor(lastFocusedTextarea, textToInsert);

        // 插入文本后，手动触发一次保存
        // (因为我们之前优化了性能，打字不保存，所以这里需要手动触发)
        saveGraph();
    });

    // 页面首次加载时，加载图谱
    loadGraph();
});