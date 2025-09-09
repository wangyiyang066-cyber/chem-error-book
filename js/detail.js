
document.addEventListener('DOMContentLoaded', function() {
  const params = new URLSearchParams(window.location.search);
  const questionId = params.get('id');
  const questionData = errorData.find(item => item.id === questionId);

  if (questionData) {
    document.getElementById('question-title').innerHTML = `错题详情 (ID: ${questionData.id})`;
    document.getElementById('key-point').innerHTML = questionData.detailedKeyPoint;
    document.getElementById('full-question').innerHTML = questionData.fullQuestion;
    document.getElementById('user-answer').innerHTML = questionData.userAnswer;
    document.getElementById('correct-answer').innerHTML = questionData.correctAnswer;
    document.getElementById('analysis').innerHTML = questionData.analysis;
  } else {
    document.getElementById('question-title').textContent = "错误：未找到该题目";
    document.querySelector('.container').innerHTML += '<p>请检查链接是否正确。</p>';
  }
});