"""MMAS-8: Morisky Medication Adherence Scale"""

class MMAS8Assessment:
    QUESTIONS = [
        {"id": "Q1", "question": "Do you sometimes forget to take your medication?", "options": ["No", "Yes"], "scoring": {"No": 1, "Yes": 0}},
        {"id": "Q2", "question": "Over the past two weeks, were there any days you did not take your medication?", "options": ["No", "Yes"], "scoring": {"No": 1, "Yes": 0}},
        {"id": "Q3", "question": "Have you ever stopped taking your medication without telling your doctor because you felt worse?", "options": ["No", "Yes"], "scoring": {"No": 1, "Yes": 0}},
        {"id": "Q4", "question": "When you travel or leave home, do you sometimes forget to bring your medication?", "options": ["No", "Yes"], "scoring": {"No": 1, "Yes": 0}},
        {"id": "Q5", "question": "Did you take your medication yesterday?", "options": ["No", "Yes"], "scoring": {"No": 0, "Yes": 1}},
        {"id": "Q6", "question": "When you feel your symptoms are under control, do you sometimes stop taking your medication?", "options": ["No", "Yes"], "scoring": {"No": 1, "Yes": 0}},
        {"id": "Q7", "question": "Do you ever feel hassled about sticking to your treatment plan?", "options": ["No", "Yes"], "scoring": {"No": 1, "Yes": 0}},
        {"id": "Q8", "question": "How often do you have difficulty remembering to take all your medication?", "options": ["Never", "Rarely", "Sometimes", "Often", "Always"], "scoring": {"Never": 1, "Rarely": 0.75, "Sometimes": 0.5, "Often": 0.25, "Always": 0}},
    ]
    
    @classmethod
    def calculate_score(cls, responses):
        if not responses or len(responses) != 8:
            return {"score": 0, "level": "Unknown", "color": "secondary"}
        total = sum(cls.QUESTIONS[i]["scoring"].get(r, 0) for i, r in enumerate(responses) if r)
        if total == 8: level, color = "High Adherence", "success"
        elif total >= 6: level, color = "Medium Adherence", "warning"
        else: level, color = "Low Adherence", "danger"
        return {"score": round(total, 2), "level": level, "color": color}
