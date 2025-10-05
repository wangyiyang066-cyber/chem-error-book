// js/knowledge-graph.js (V2版 - 支持保存和加载)

document.addEventListener('DOMContentLoaded', function() {
    const id = document.getElementById("drawflow");
    const editor = new Drawflow(id);
    editor.start();

    // --- 拖拽功能 (和之前一样) ---
    window.allowDrop = function(ev) { ev.preventDefault(); }
    window.drag = function(ev) { ev.dataTransfer.setData("node-type", ev.target.getAttribute('data-node-type')); }
    window.drop = function(ev) {
        ev.preventDefault();
        const nodeType = ev.dataTransfer.getData("node-type");
        let nodeName = '';
        let nodeHTML = `<div><textarea df-text placeholder="输入内容..."></textarea></div>`;
        if (nodeType === 'concept') nodeName = '核心概念';
        else if (nodeType === 'example') nodeName = '具体实例';
        if (nodeName) editor.addNode(nodeName, 1, 1, ev.clientX, ev.clientY, nodeName, {}, nodeHTML);
    }

    // --- ↓↓↓ 新增的保存和加载功能 ↓↓↓ ---
    const saveButton = document.getElementById('save-button');
    const saveStatus = document.getElementById('save-status');

    // 保存函数
    async function saveGraph() {
        const graphData = editor.export();
        saveButton.textContent = '正在保存...';
        try {
            await fetch('/.netlify/functions/save-graph', {
                method: 'POST',
                body: JSON.stringify(graphData.drawflow)
            });
            saveButton.textContent = '保存图谱';
            saveStatus.style.display = 'inline';
            setTimeout(() => { saveStatus.style.display = 'none'; }, 2000); // 2秒后自动消失
        } catch (error) {
            saveButton.textContent = '保存失败!';
            console.error("保存图谱失败:", error);
        }
    }

    // 加载函数
    async function loadGraph() {
        try {
            const response = await fetch('/.netlify/functions/get-graph');
            const graphData = await response.json();
            if (graphData) {
                editor.import({ "drawflow": graphData });
                console.log("成功从数据库加载图谱！");
            } else {
                console.log("数据库中没有图谱，这是一个新画板。");
            }
        } catch (error) {
            console.error("加载图谱失败:", error);
        }
    }

    // 绑定保存按钮的点击事件
    saveButton.addEventListener('click', saveGraph);

    // 页面加载时，自动加载上一次的图谱
    loadGraph();
    // --- ↑↑↑ 新增功能结束 ↑↑↑ ---
});