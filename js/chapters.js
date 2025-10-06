// 文件路径: js/chapters.js (新版 - 静态列表)
document.addEventListener('DOMContentLoaded', () => {
    const chaptersList = document.getElementById('chapters-list');
    chaptersList.innerHTML = ''; // 清空“加载中...”

    // 定义所有章节
    const chapters = [
        { name: '绪论', id: 0 },
        { name: '第一单元', id: 1 },
        { name: '第二单元', id: 2 },
        { name: '第三单元', id: 3 },
        { name: '第四单元', id: 4 },
        { name: '第五单元', id: 5 },
        { name: '第六单元', id: 6 },
        { name: '第七单元', id: 7 },
        { name: '第八单元', id: 8 },
        { name: '第九单元', id: 9 },
        { name: '第十单元', id: 10 },
        { name: '第十一单元', id: 11 }
    ];

    // 循环生成章节链接
    chapters.forEach(chapter => {
        const chapterLink = document.createElement('a');
        // 点击链接后，将模式(mode)和章节ID(id)通过URL参数传递给答题页
        chapterLink.href = `quiz.html?mode=chapter&id=${chapter.id}`;
        chapterLink.className = 'menu-button';
        chapterLink.innerHTML = `<h2>${chapter.name}</h2>`;
        chaptersList.appendChild(chapterLink);
    });
});