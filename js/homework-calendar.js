document.addEventListener('DOMContentLoaded', () => {
    const homeworkGrid = document.getElementById('homeworkGrid');
    
    const lessons = [
        { id: 1, title: '物质的变化与性质', icon: 'fa-vial' },
        { id: 2, title: '空气与氧气', icon: 'fa-wind' },
        { id: 3, title: '氧气的制取', icon: 'fa-fire' },
        { id: 4, title: '水的组成与净化', icon: 'fa-droplet' },
        { id: 5, title: '原子与离子', icon: 'fa-atom' },
        { id: 6, title: '化学式与化合价', icon: 'fa-vials' },
        { id: 7, title: '质量守恒定律', icon: 'fa-balance-scale' },
        { id: 8, title: '化学方程式计算', icon: 'fa-calculator' }
    ];

    homeworkGrid.innerHTML = '';

    lessons.forEach(lesson => {
        const card = document.createElement('a');
        // 🔥 关键改动：映射为虚拟 ID 101-108，骗过 quiz.js 的参数检查
        const virtualId = 100 + lesson.id;
        card.href = `homework-quiz.html?id=${virtualId}&source=homework`;
        card.className = 'homework-card';
        
        card.innerHTML = `
            <span class="lesson-num">第 ${lesson.id} 课</span>
            <div class="status-icon"><i class="fas ${lesson.icon}"></i></div>
            <div class="lesson-title">${lesson.title}</div>
        `;
        
        homeworkGrid.appendChild(card);
    });
});