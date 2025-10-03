# 文件: classify_question.py

from transformers import pipeline

# 1. 聘请一位“零样本分类”专家（加载预训练模型）
#    这行代码第一次运行时会自动下载模型，可能需要几分钟
print("正在聘请 AI 图书管理员，请稍候...")
classifier = pipeline("zero-shot-classification", model="uer/roberta-base-finetuned-dianping-chinese")
print("AI 图书管理员已就位！")

# 2. 准备你的“新书”（一道新的化学题）
new_question = "在铜和浓硝酸的反应中，铜作为什么剂？"

# 3. 准备你的“图书分类标签”（你的知识点列表）
knowledge_points = [
    "氧化还原反应",
    "酸碱中和",
    "离子共存",
    "化学平衡",
    "物质的量"
]

# 4. 让 AI 开始分类！
print(f"\n正在为题目: '{new_question}' 进行分类...")
print(f"备选知识点: {knowledge_points}")

result = classifier(new_question, knowledge_points)

# 5. 查看分类结果
print("\n--- AI 分类结果 ---")
print(f"最匹配的知识点: {result['labels'][0]}")
print(f"置信度分数: {result['scores'][0]:.2%}") # 将分数格式化为百分比

print("\n--- 详细分数 ---")
# zip() 是一个很酷的函数，可以把两个列表配对起来
for label, score in zip(result['labels'], result['scores']):
    print(f"{label}: {score:.2%}")