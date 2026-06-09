"""PEACS v2.0: Predictive Emergence Assessment for Clinical Settings"""

class BASEAssessment:
    """BASE: Behavioral Architecture & Stability Evaluation (7 items)"""
    QUESTIONS = [
        {"id": "B1", "code": "B1", "question": "Do you have a consistent way of remembering to take your medication(s)?", "options": ["Yes", "Sometimes", "No"]},
        {"id": "B2", "code": "B2", "question": "Is taking your medication(s) part of a regular daily routine?", "options": ["Yes", "Sometimes", "No"]},
        {"id": "B3", "code": "B3", "question": "Can you continue taking your medication(s) even when symptoms improve?", "options": ["Yes", "Sometimes", "No"]},
        {"id": "B4", "code": "B4", "question": "Can you adjust your routine when unexpected changes occur?", "options": ["Yes", "Sometimes", "No"]},
        {"id": "B5", "code": "B5", "question": "Can you continue taking your medication(s) despite side effects?", "options": ["Yes", "Sometimes", "No"]},
        {"id": "B6", "code": "B6", "question": "Have your medication-taking behaviors become automatic?", "options": ["Yes", "Sometimes", "No"]},
        {"id": "B7", "code": "B7", "question": "Do you prepare in advance to ensure medication availability?", "options": ["Yes", "Sometimes", "No"]},
    ]
    SCORING = {"Yes": 1.0, "Sometimes": 0.5, "No": 0.0}
    
    @classmethod
    def calculate_score(cls, responses):
        if not responses or len(responses) != 7:
            return {"raw": 0, "norm": 0, "level": "Unknown"}
        total = sum(cls.SCORING.get(r, 0) for r in responses if r)
        norm = total / 7.0
        if norm >= 0.76: level = "Strong"
        elif norm >= 0.51: level = "Developing"
        elif norm >= 0.26: level = "Fragile"
        else: level = "Weak"
        return {"raw": total, "norm": round(norm, 4), "level": level}


class MVMTAssessment:
    """MVMT: Measurable Variance in Medication-Taking (7 items, past 7 days)"""
    QUESTIONS = [
        {"id": "M1", "code": "M1", "question": "Did you miss taking your medication(s) at the scheduled time?", "options": ["No", "Yes, once", "Yes, more than once"], "is_intentional": False},
        {"id": "M2", "code": "M2", "question": "Did you take less than the prescribed dose?", "options": ["No", "Yes, once", "Yes, more than once"], "is_intentional": False},
        {"id": "M3", "code": "M3", "question": "Did you skip a dose because you felt your symptoms were under control?", "options": ["No", "Yes, once", "Yes, more than once"], "is_intentional": True},
        {"id": "M4", "code": "M4", "question": "Did you skip a dose because of side effects?", "options": ["No", "Yes, once", "Yes, more than once"], "is_intentional": True},
        {"id": "M5", "code": "M5", "question": "Did a change in your environment disrupt your medication routine?", "options": ["No", "Yes, once", "Yes, more than once"], "is_intentional": False},
        {"id": "M6", "code": "M6", "question": "Did you have difficulty fitting your medication into your schedule?", "options": ["No", "Yes, once", "Yes, more than once"], "is_intentional": False},
        {"id": "M7", "code": "M7", "question": "Did you struggle to take your medication(s) as part of daily activities?", "options": ["No", "Yes, once", "Yes, more than once"], "is_intentional": False},
    ]
    SCORING = {"No": 1.0, "Yes, once": 0.5, "Yes, more than once": 0.0}
    
    @classmethod
    def calculate_score(cls, responses):
        if not responses or len(responses) != 7:
            return {"raw": 0, "norm": 0, "level": "Unknown"}
        total = sum(cls.SCORING.get(r, 0) for r in responses if r)
        norm = total / 7.0
        if norm >= 0.76: level = "Reliable"
        elif norm >= 0.51: level = "Moderately Steady"
        elif norm >= 0.26: level = "Unstable"
        else: level = "Highly Prone"
        return {"raw": total, "norm": round(norm, 4), "level": level}


class STRATAAssessment:
    """STRATA: Support, Treatment access, Resources And Terrain (8 items)"""
    QUESTIONS = [
        {"id": "S1", "code": "S1", "question": "Who primarily supports your medication-taking?", "level": "Interpersonal",
         "options": [("Dedicated caregiver/family", 1.0), ("Multiple support persons", 0.67), ("Occasional support", 0.33), ("No support", 0.0)]},
        {"id": "S2", "code": "S2", "question": "How often do you communicate with your support person about medications?", "level": "Interpersonal",
         "options": [("Daily", 1.0), ("Weekly", 0.67), ("Monthly", 0.33), ("Rarely/Never", 0.0)]},
        {"id": "S3", "code": "S3", "question": "What is your living situation?", "level": "Interpersonal",
         "options": [("With supportive family/caregivers", 1.0), ("With roommates/others", 0.67), ("Alone with regular visitors", 0.33), ("Alone, isolated", 0.0)]},
        {"id": "S4", "code": "S4", "question": "Who would help in a medication emergency?", "level": "Interpersonal",
         "options": [("Multiple reliable contacts", 1.0), ("One reliable contact", 0.67), ("Uncertain availability", 0.33), ("No one", 0.0)]},
        {"id": "S5", "code": "S5", "question": "How do you access pharmacy/clinic for medications?", "level": "Organizational",
         "options": [("Easy access, multiple options", 1.0), ("Moderate access", 0.67), ("Difficult but possible", 0.33), ("Very difficult", 0.0)]},
        {"id": "S6", "code": "S6", "question": "How stable is your access to healthcare providers?", "level": "Organizational",
         "options": [("Stable, consistent provider", 1.0), ("Mostly stable", 0.67), ("Frequent changes", 0.33), ("No regular provider", 0.0)]},
        {"id": "S7", "code": "S7", "question": "What tools help you manage medications?", "level": "Organizational",
         "options": [("Multiple tools (app, pillbox, alarms)", 1.0), ("One reliable tool", 0.67), ("Informal methods", 0.33), ("No tools", 0.0)]},
        {"id": "S8", "code": "S8", "question": "How well do you understand your medication regimen?", "level": "Organizational",
         "options": [("Complete understanding", 1.0), ("Good understanding", 0.67), ("Partial understanding", 0.33), ("Poor understanding", 0.0)]},
    ]
    
    @classmethod
    def calculate_score(cls, responses):
        if not responses or len(responses) != 8:
            return {"raw": 0, "norm": 0, "level": "Unknown"}
        total = sum(float(r) for r in responses if r is not None)
        norm = total / 8.0
        if norm >= 0.76: level = "Strong Support"
        elif norm >= 0.51: level = "Moderate Support"
        elif norm >= 0.26: level = "Limited Support"
        else: level = "Vulnerable"
        return {"raw": total, "norm": round(norm, 4), "level": level}
