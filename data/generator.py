"""Synthetic patient data generator"""
import numpy as np
import pandas as pd
import random
from config import GLOBAL_CITIES

def generate_synthetic_patients(n=1000, seed=42):
    np.random.seed(seed)
    random.seed(seed)
    
    patients = []
    for i in range(n):
        city_info = random.choice(GLOBAL_CITIES)
        
        # Generate realistic PE distributions
        profile = random.choices(['high', 'medium', 'low', 'critical'], weights=[0.25, 0.40, 0.25, 0.10])[0]
        
        if profile == 'high':
            base = np.clip(np.random.normal(0.85, 0.08), 0.6, 1.0)
            mvmt = np.clip(np.random.normal(0.82, 0.10), 0.55, 1.0)
            strata = np.clip(np.random.normal(0.80, 0.12), 0.5, 1.0)
        elif profile == 'medium':
            base = np.clip(np.random.normal(0.65, 0.12), 0.35, 0.85)
            mvmt = np.clip(np.random.normal(0.60, 0.15), 0.30, 0.85)
            strata = np.clip(np.random.normal(0.62, 0.14), 0.32, 0.88)
        elif profile == 'low':
            base = np.clip(np.random.normal(0.45, 0.12), 0.15, 0.65)
            mvmt = np.clip(np.random.normal(0.42, 0.14), 0.12, 0.62)
            strata = np.clip(np.random.normal(0.48, 0.15), 0.18, 0.68)
        else:
            base = np.clip(np.random.normal(0.28, 0.10), 0.05, 0.45)
            mvmt = np.clip(np.random.normal(0.25, 0.12), 0.05, 0.42)
            strata = np.clip(np.random.normal(0.30, 0.14), 0.08, 0.48)
        
        pe = (base * mvmt * strata) ** (1/3)
        
        if pe >= 0.70: pe_level, pe_color = "Stability", "#10b981"
        elif pe >= 0.50: pe_level, pe_color = "Transition", "#f59e0b"
        elif pe >= 0.34: pe_level, pe_color = "Fragility", "#ef4444"
        else: pe_level, pe_color = "Critical", "#7f1d1d"
        
        patients.append({
            'patient_id': f'PT-{seed}-{i+1:04d}',
            'age': random.randint(25, 75),
            'gender': random.choice(['M', 'F']),
            'city': city_info['city'],
            'country': city_info['country'],
            'region': city_info['region'],
            'latitude': city_info['lat'] + np.random.normal(0, 0.5),
            'longitude': city_info['lon'] + np.random.normal(0, 0.5),
            'base_norm': round(base, 4),
            'mvmt_norm': round(mvmt, 4),
            'strata_norm': round(strata, 4),
            'pe_score': round(pe, 4),
            'pe_level': pe_level,
            'pe_color': pe_color,
        })
    
    return pd.DataFrame(patients)


def create_new_patient(patient_id, base_vals, mvmt_vals, strata_vals, city_idx=0):
    from models.peacs_v2 import BASEAssessment, MVMTAssessment, STRATAAssessment
    from models.calculators import PECalculator
    
    base_result = BASEAssessment.calculate_score(base_vals)
    mvmt_result = MVMTAssessment.calculate_score(mvmt_vals)
    strata_result = STRATAAssessment.calculate_score(strata_vals)
    
    pe = PECalculator.calculate_pe(base_result['norm'], mvmt_result['norm'], strata_result['norm'])
    level, _, color = PECalculator.get_pe_level(pe)
    
    city_info = GLOBAL_CITIES[city_idx % len(GLOBAL_CITIES)]
    
    return {
        'patient_id': patient_id,
        'age': random.randint(25, 65),
        'gender': random.choice(['M', 'F']),
        'city': city_info['city'],
        'country': city_info['country'],
        'region': city_info['region'],
        'latitude': city_info['lat'] + np.random.normal(0, 0.3),
        'longitude': city_info['lon'] + np.random.normal(0, 0.3),
        'base_norm': base_result['norm'],
        'mvmt_norm': mvmt_result['norm'],
        'strata_norm': strata_result['norm'],
        'pe_score': pe,
        'pe_level': level,
        'pe_color': color,
    }
