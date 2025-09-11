# excel_to_js.py (V5版：智能格式化化学式与文本)
####'/Users/yiyangwang/Desktop/learning_others/some_projects/some_projects_learning/2025小创(立项省级）/知识-题目对应.xlsx'
# excel_to_js.py (V6版：智能难度分类)
import pandas as pd
import os
import json
import re

EXCEL_FILE_PATH = '/Users/yiyangwang/Desktop/learning_others/some_projects/some_projects_learning/2025小创(立项省级）/知识-题目对应.xlsx'
SHEET1_NAME = 0
SHEET2_NAME = 1
OUTPUT_JS_PATH = os.path.join('js', 'data.js')

def convert_excel_to_js():
    try:
        df_summary = pd.read_excel(EXCEL_FILE_PATH, sheet_name=SHEET1_NAME, header=0).rename(columns={'知识点编号': 'id', '知识点摘要': 'keyPoint', '题目摘要': 'questionTitle'})[['id', 'keyPoint', 'questionTitle']]
        df_detail = pd.read_excel(EXCEL_FILE_PATH, sheet_name=SHEET2_NAME, header=0).rename(columns={'知识点编号': 'id', '知识点': 'detailedKeyPoint', '题目': 'fullQuestion'})[['id', 'detailedKeyPoint', 'fullQuestion']]
    except Exception as e:
        print(f"读取 Excel 时发生错误: {e}")
        return

    df_summary['id'] = df_summary['id'].astype(str).str.zfill(3)
    df_detail['id'] = df_detail['id'].astype(str).str.zfill(3)
    df_detail['fullQuestion'] = df_detail['fullQuestion'].astype(str)
    df_detail['detailedKeyPoint'] = df_detail['detailedKeyPoint'].astype(str)
    df_merged = pd.merge(df_summary, df_detail, on='id', how='left')
    df_merged.fillna({'fullQuestion': '', 'keyPoint': '', 'detailedKeyPoint': ''}, inplace=True)
    
    answer_pattern = re.compile(r'\s*(?:a\s*n\s*s|答\s*案)\s*[:：]\s*', re.IGNORECASE)

    js_objects = []
    for index, row in df_merged.iterrows():
        full_question_text = row['fullQuestion']
        
        difficulty = 'easy'
        if full_question_text.strip().startswith('[中]'):
            difficulty = 'medium'
            full_question_text = full_question_text.replace('[中]', '', 1).strip()
        elif full_question_text.strip().startswith('[难]'):
            difficulty = 'hard'
            full_question_text = full_question_text.replace('[难]', '', 1).strip()
        
        parts = answer_pattern.split(full_question_text, 1)
        if len(parts) > 1:
            question_part = parts[0].strip()
            answer_part = parts[1].strip()
        else:
            question_part = full_question_text.strip()
            answer_part = "（待补充正确答案）"

        js_obj = { "id": row['id'], "keyPoint": row['keyPoint'], "detailedKeyPoint": row['detailedKeyPoint'], "questionTitle": row['questionTitle'], "fullQuestion": question_part, "userAnswer": "（待补充你的答案）", "correctAnswer": answer_part, "analysis": "（待补充题目解析）", "difficulty": difficulty }
        js_objects.append(js_obj)

    js_content = "const errorData = " + json.dumps(js_objects, ensure_ascii=False, indent=2) + ";"
    
    try:
        with open(OUTPUT_JS_PATH, 'w', encoding='utf-8') as f:
            f.write(js_content)
        print(f"🎉 成功！带有难度标签的数据已写入 {OUTPUT_JS_PATH}")
    except Exception as e:
        print(f"写入文件时发生错误: {e}")

if __name__ == "__main__":
    convert_excel_to_js()