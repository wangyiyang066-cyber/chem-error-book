// js/script.js

document.addEventListener('DOMContentLoaded', function() {
  const tableBody = document.getElementById('error-list-body');

  errorData.forEach(item => {
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${item.id}</td>
      <td>${item.keyPoint}</td>
      <td>${item.questionTitle}</td>
      <td>
        <a href="detail.html?id=${item.id}" class="btn-detail">点击跳转</a>
      </td>
    `;

    tableBody.appendChild(row);
  });
});