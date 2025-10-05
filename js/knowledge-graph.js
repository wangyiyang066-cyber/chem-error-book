// js/knowledge-graph.js

// 等待页面加载完成
document.addEventListener('DOMContentLoaded', function() {
    const id = document.getElementById("drawflow");
    const editor = new Drawflow(id);
    editor.start();

    // 注册我们自定义的节点，让 Drawflow 知道如何渲染它们
    const conceptNodeHTML = `
        <div>
            <textarea df-text placeholder="输入概念..."></textarea>
        </div>
    `;
    const exampleNodeHTML = `
        <div>
            <textarea df-text placeholder="输入实例..."></textarea>
        </div>
    `;

    // --- 拖拽功能所需的辅助函数 ---
    window.allowDrop = function(ev) {
        ev.preventDefault();
    }

    window.drag = function(ev) {
        // 告诉浏览器我们正在拖拽什么类型的数据
        ev.dataTransfer.setData("node-type", ev.target.getAttribute('data-node-type'));
    }

    window.drop = function(ev) {
        ev.preventDefault();
        const nodeType = ev.dataTransfer.getData("node-type");

        // 根据拖拽的类型，在鼠标落下的位置创建一个新的方块
        let nodeName = '';
        let nodeHTML = '';
        if (nodeType === 'concept') {
            nodeName = '核心概念';
            nodeHTML = conceptNodeHTML;
        } else if (nodeType === 'example') {
            nodeName = '具体实例';
            nodeHTML = exampleNodeHTML;
        }

        // 确保是我们认识的类型
        if(nodeName) {
            editor.addNode(nodeName, 1, 1, ev.clientX, ev.clientY, nodeName, {}, nodeHTML);
        }
    }
});