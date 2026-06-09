#!/usr/bin/env python3
"""
ATLAS: Adherence Tools and Location Analytics System
Version 7.2 Enterprise - FULL RED CARPET EDITION - PART 1/3

PART 1: Imports, Configuration, Core Models, Data Generation

Complete application with ALL features:
- Live Assessment with FULL 22 questions
- Real-time KAI floater (updates after EACH click)
- Stunning map with OpenStreetMap fallback
- 3D cube with prediction surfaces and journey tracking
- Complete IOPE investor dashboard
- All interactive features

Corrected Formula: KAI = (BASE × MVMT × STRATA³)^(1/5)
                  EA = KAI × (1 - INA)
"""

import os
import json
import math
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

import dash
from dash import dcc, html, Input, Output, State, callback_context, ALL, MATCH
import dash_bootstrap_components as dbc
from dash.exceptions import PreventUpdate

import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots

# ============================================================================
# CONFIGURATION
# ============================================================================

APP_TITLE = "ATLAS: Adherence Tools and Location Analytics System"
VERSION = "7.2 Enterprise - Full Red Carpet Edition"

# Mapbox token - set as environment variable or leave empty for OpenStreetMap
MAPBOX_TOKEN = os.environ.get("MAPBOX_TOKEN", "")
USE_MAPBOX = len(MAPBOX_TOKEN) > 0

print("="*80)
print(f"🎬 {APP_TITLE}")
print(f"🎞️  {VERSION}")
print("="*80)
print(f"🗺️  Map: Using {'Mapbox Dark' if USE_MAPBOX else 'OpenStreetMap'}")
print("="*80)

# ============================================================================
# PART 1: CORE MODELS WITH FULL QUESTION SETS
# ============================================================================

class BASEAssessment:
    """BASE: Behavioral Architecture & Stability Evaluation (X-axis)"""
    
    QUESTIONS = [
        {
            "id": "base_q1",
            "title": "Memory Architecture",
            "question": "Do you reliably remember to take your medication as scheduled, even on stressful days?",
            "category": "memory",
            "options": ["Yes", "Sometimes", "No"]
        },
        {
            "id": "base_q2", 
            "title": "Routine Stability",
            "question": "Do you maintain a consistent routine for taking your medication when your daily schedule changes?",
            "category": "routine",
            "options": ["Yes", "Sometimes", "No"]
        },
        {
            "id": "base_q3",
            "title": "Symptom Resilience", 
            "question": "If you begin to feel better, do you continue your medication exactly as prescribed?",
            "category": "symptom",
            "options": ["Yes", "Sometimes", "No"]
        },
        {
            "id": "base_q4",
            "title": "Adaptive Flexibility",
            "question": "Can you adapt your daily routine to make sure you take your medication when your schedule shifts?",
            "category": "flexibility",
            "options": ["Yes", "Sometimes", "No"]
        },
        {
            "id": "base_q5",
            "title": "Side-Effect Tolerance",
            "question": "If you experience side effects, can you continue treatment while managing them?",
            "category": "tolerance",
            "options": ["Yes", "Sometimes", "No"]
        },
        {
            "id": "base_q6",
            "title": "Behavioral Integration", 
            "question": "Does taking medication fit naturally into your daily life?",
            "category": "integration",
            "options": ["Yes", "Sometimes", "No"]
        },
        {
            "id": "base_q7",
            "title": "Preparedness Structure",
            "question": "Do you routinely keep a backup supply so you don't run out of medication?",
            "category": "preparedness",
            "options": ["Yes", "Sometimes", "No"]
        }
    ]
    
    @staticmethod
    def calculate_base_score(responses):
        if len(responses) != 7:
            return 3.5
        score_map = {"Yes": 1.0, "Sometimes": 0.5, "No": 0.0}
        return round(sum(score_map.get(r, 0.5) for r in responses), 2)
    
    @staticmethod
    def calculate_base_normalized(base_raw):
        return round(base_raw / 7.0, 3)


class MVMTAssessment:
    """MVMT: Measurable Variance Minimal Term (Y-axis)"""
    
    QUESTIONS = [
        {
            "id": "MVMT_q1",
            "title": "Timing Consistency",
            "question": "In the past 7 days, did you have trouble taking your medication at the same time each day?",
            "category": "routine",
            "options": ["No", "Yes, once", "Yes, more than once"]
        },
        {
            "id": "MVMT_q2",
            "title": "Dose Completion",
            "question": "In the past 7 days, did you miss any doses?",
            "category": "memory",
            "options": ["No", "Yes, once", "Yes, more than once"]
        },
        {
            "id": "MVMT_q3", 
            "title": "Symptom-Based Skipping",
            "question": "In the past 7 days, did you skip or stop taking medication because you felt better?",
            "category": "symptom",
            "is_intentional": True,
            "options": ["No", "Yes, once", "Yes, more than once"]
        },
        {
            "id": "MVMT_q4",
            "title": "Side-Effect Response",
            "question": "In the past 7 days, did you stop or skip medication because of side effects?",
            "category": "sideeffect",
            "is_intentional": True,
            "options": ["No", "Yes, once", "Yes, more than once"]
        },
        {
            "id": "MVMT_q5",
            "title": "Environmental Disruption",
            "question": "In the past 7 days, did travel, being away, or your environment cause you to miss medication?",
            "category": "environment",
            "options": ["No", "Yes, once", "Yes, more than once"]
        },
        {
            "id": "MVMT_q6",
            "title": "Schedule Adaptation", 
            "question": "In the past 7 days, did you have difficulty adjusting your routine to take medication when your schedule changed?",
            "category": "flexibility",
            "options": ["No", "Yes, once", "Yes, more than once"]
        },
        {
            "id": "MVMT_q7",
            "title": "Daily Integration",
            "question": "In the past 7 days, did taking medication feel like a hassle or not fit naturally into daily life?",
            "category": "integration",
            "options": ["No", "Yes, once", "Yes, more than once"]
        }
    ]
    
    @staticmethod
    def calculate_MVMT_score(responses):
        if len(responses) != 7:
            return 3.5
        score_map = {"No": 1.0, "Yes, once": 0.5, "Yes, more than once": 0.0}
        return round(sum(score_map.get(r, 0.5) for r in responses), 2)
    
    @staticmethod
    def calculate_MVMT_normalized(MVMT_raw):
        return round(MVMT_raw / 7.0, 3)
    
    @staticmethod
    def calculate_ina_component(responses):
        if len(responses) != 7:
            return 0.0
        penalty = 0.0
        for idx in [2, 3]:
            if idx < len(responses) and responses[idx]:
                if responses[idx] == "Yes, more than once":
                    penalty += 0.25
                elif responses[idx] == "Yes, once":
                    penalty += 0.125
        return round(penalty, 3)


class STRATAAssessment:
    """STRATA: Social & Tangible Resource Access & Terrain Assessment (Z-axis)"""
    
    QUESTIONS = [
        {
            "id": "STRATA_q1",
            "title": "Primary Support Person",
            "question": "Who typically helps you remember or manage your medications?",
            "category": "network_strength",
            "options": [
                ("Spouse/Partner", 1.0),
                ("Adult child", 0.9),
                ("Other family member", 0.8),
                ("Friend/Neighbor", 0.7),
                ("Home health aide/Caregiver", 0.8),
                ("I manage on my own", 0.3),
                ("No one helps me", 0.0)
            ]
        },
        {
            "id": "STRATA_q2",
            "title": "Contact Frequency",
            "question": "How often do you have meaningful contact with family or friends?",
            "category": "network_strength",
            "options": [
                ("Daily", 1.0),
                ("Several times a week", 0.8),
                ("Once a week", 0.6),
                ("A few times a month", 0.4),
                ("Rarely", 0.2),
                ("Almost never", 0.0)
            ]
        },
        {
            "id": "STRATA_q3",
            "title": "Living Situation",
            "question": "What is your current living situation?",
            "category": "practical_support",
            "options": [
                ("Live with spouse/partner", 1.0),
                ("Live with family members", 0.9),
                ("Live alone but nearby family", 0.6),
                ("Live alone, family far away", 0.3),
                ("Live in assisted living", 0.7),
                ("Homeless or unstable housing", 0.0)
            ]
        },
        {
            "id": "STRATA_q4",
            "title": "Emergency Contact Network",
            "question": "If you missed an appointment or had an emergency, who would notice?",
            "category": "network_strength",
            "options": [
                ("Multiple people would notice quickly", 1.0),
                ("At least one person would notice", 0.7),
                ("Someone would eventually notice", 0.4),
                ("Probably no one would notice", 0.1),
                ("Definitely no one would notice", 0.0)
            ]
        },
        {
            "id": "STRATA_q5",
            "title": "Transportation Access",
            "question": "How do you usually get to medical appointments or the pharmacy?",
            "category": "practical_support",
            "options": [
                ("Drive myself", 1.0),
                ("Family/friends drive me", 0.8),
                ("Public transportation", 0.6),
                ("Medical transport/taxi", 0.5),
                ("Have difficulty getting transportation", 0.2),
                ("Cannot get to appointments", 0.0)
            ]
        },
        {
            "id": "STRATA_q6",
            "title": "Financial Resources",
            "question": "Can you afford your medications each month?",
            "category": "resource_access",
            "options": [
                ("Yes, without difficulty", 1.0),
                ("Yes, but it's a stretch", 0.6),
                ("Sometimes I struggle to afford them", 0.3),
                ("Often cannot afford them", 0.1),
                ("Cannot afford them", 0.0)
            ]
        },
        {
            "id": "STRATA_q7",
            "title": "Medication Management Tools",
            "question": "What tools or systems do you use to manage your medications?",
            "category": "practical_support",
            "options": [
                ("Pill organizer + reminders", 1.0),
                ("Pill organizer", 0.8),
                ("Phone/timer reminders", 0.7),
                ("Written notes/calendar", 0.5),
                ("Try to remember", 0.2),
                ("No system", 0.0)
            ]
        },
        {
            "id": "STRATA_q8",
            "title": "Health Literacy",
            "question": "Do you understand your medications and why you take them?",
            "category": "resource_access",
            "options": [
                ("Yes, completely understand", 1.0),
                ("Understand most of it", 0.7),
                ("Understand some of it", 0.4),
                ("Understand very little", 0.2),
                ("Don't understand at all", 0.0)
            ]
        }
    ]
    
    @staticmethod
    def calculate_STRATA_score(responses):
        if len(responses) != 8:
            return 4.0
        return round(sum(float(r) for r in responses if r is not None), 2)
    
    @staticmethod
    def calculate_STRATA_normalized(STRATA_raw):
        return round(STRATA_raw / 8.0, 3)
    
    @staticmethod
    def get_STRATA_interpretation(STRATA_score):
        if STRATA_score >= 0.80:
            return "Strong Support", "Robust contextual support with good resources"
        elif STRATA_score >= 0.60:
            return "Adequate Support", "Reasonable support with some gaps"
        elif STRATA_score >= 0.40:
            return "Moderate Risk", "Limited support - assistance recommended"
        elif STRATA_score >= 0.20:
            return "High Risk", "Significant support deficits - intervention needed"
        else:
            return "Critical Risk", "Severe isolation - immediate support services required"


class KAICalculator:
    """KYBOS Adherence Index - CORRECTED FORMULA"""
    
    @staticmethod
    def calculate_kai(base_norm, MVMT_norm, STRATA_norm):
        """Calculate KAI = (BASE × MVMT × STRATA³)^(1/5)"""
        if None in [base_norm, MVMT_norm, STRATA_norm]:
            return 0.5
        
        base_norm = max(0.0, min(1.0, base_norm))
        MVMT_norm = max(0.0, min(1.0, MVMT_norm))
        STRATA_norm = max(0.0, min(1.0, STRATA_norm))
        
        product = base_norm * MVMT_norm * (STRATA_norm ** 3)
        kai = product ** (1/5)
        
        return round(kai, 4)
    
    @staticmethod
    def get_kai_interpretation(kai_score):
        if kai_score >= 0.85:
            return "Optimal Alignment", "Strong adherence potential across all dimensions"
        elif kai_score >= 0.70:
            return "Good Alignment", "Generally strong adherence architecture"
        elif kai_score >= 0.55:
            return "Moderate Alignment", "Some dimensional weaknesses present"
        elif kai_score >= 0.40:
            return "Poor Alignment", "Significant challenges across multiple dimensions"
        else:
            return "Critical Misalignment", "Severe deficits requiring immediate intervention"


class INACalculator:
    """INA: Intentional Non-Adherence Overlay"""
    
    @staticmethod
    def calculate_ina(MVMT_responses):
        return MVMTAssessment.calculate_ina_component(MVMT_responses)
    
    @staticmethod
    def calculate_effective_adherence(kai, ina):
        """EA = KAI × (1 - INA)"""
        if kai is None or ina is None:
            return 0.5
        effective = kai * (1.0 - ina)
        return round(max(0.0, min(1.0, effective)), 4)
    
    @staticmethod
    def get_ina_interpretation(ina_value):
        if ina_value >= 0.40:
            return "High Intentional Deviation", "Significant volitional resistance to therapy"
        elif ina_value >= 0.25:
            return "Moderate Intentional Deviation", "Some conscious modification of regimen"
        elif ina_value >= 0.10:
            return "Low Intentional Deviation", "Minimal volitional changes"
        else:
            return "Negligible Intentional Deviation", "Patient follows prescribed plan"

print("✅ Core models loaded with FULL 22 questions (7 BASE + 7 MVMT + 8 STRATA)")

# ============================================================================
# PART 2: DATA GENERATION
# ============================================================================

def generate_synthetic_patients(n_patients=1000, existing_df=None):
    """Generate synthetic patient data with CORRECTED KAI formula"""
    
    if existing_df is not None and not existing_df.empty:
        start_id = len(existing_df) + 400001
    else:
        start_id = 400001
    
    global_cities = [
        ("New York", "United States", 40.7128, -74.0060, "Urban", "North America"),
        ("Los Angeles", "United States", 34.0522, -118.2437, "Urban", "North America"),
        ("Chicago", "United States", 41.8781, -87.6298, "Urban", "North America"),
        ("London", "United Kingdom", 51.5074, -0.1278, "Urban", "Europe"),
        ("Paris", "France", 48.8566, 2.3522, "Urban", "Europe"),
        ("Berlin", "Germany", 52.5200, 13.4050, "Urban", "Europe"),
        ("Tokyo", "Japan", 35.6762, 139.6503, "Urban", "Asia"),
        ("Singapore", "Singapore", 1.3521, 103.8198, "Urban", "Asia"),
        ("Dubai", "United Arab Emirates", 25.2048, 55.2708, "Urban", "Middle East"),
        ("Sydney", "Australia", -33.8688, 151.2093, "Urban", "Oceania"),
        ("Toronto", "Canada", 43.6532, -79.3832, "Urban", "North America"),
        ("Mumbai", "India", 19.0760, 72.8777, "Urban", "Asia"),
    ]
    
    patients = []
    
    for i in range(n_patients):
        city_idx = np.random.choice(len(global_cities))
        city, country, base_lat, base_lon, area_type, region = global_cities[city_idx]
        
        age = int(np.clip(np.random.gamma(2.2, 28) + 25, 18, 95))
        gender = np.random.choice(["Female", "Male"], p=[0.52, 0.48])
        
        health_stability = np.random.beta(2, 2)
        
        # BASE responses
        base_p1 = health_stability
        base_p2 = 0.3
        base_p3 = max(0.01, 1 - base_p1 - base_p2)
        base_total = base_p1 + base_p2 + base_p3
        base_probs = [base_p1/base_total, base_p2/base_total, base_p3/base_total]
        
        base_responses = [
            np.random.choice(["Yes", "Sometimes", "No"], p=base_probs)
            for _ in range(7)
        ]
        
        # MVMT responses
        mvmt_p1 = health_stability
        mvmt_p2 = 0.25
        mvmt_p3 = max(0.01, 1 - mvmt_p1 - mvmt_p2)
        mvmt_total = mvmt_p1 + mvmt_p2 + mvmt_p3
        mvmt_probs = [mvmt_p1/mvmt_total, mvmt_p2/mvmt_total, mvmt_p3/mvmt_total]
        
        MVMT_responses = [
            np.random.choice(["No", "Yes, once", "Yes, more than once"], p=mvmt_probs)
            for _ in range(7)
        ]
        
        # STRATA responses
        STRATA_responses = [
            np.random.choice([1.0, 0.8, 0.6, 0.4, 0.2, 0.0],
                           p=[0.3, 0.25, 0.2, 0.15, 0.07, 0.03])
            for _ in range(8)
        ]
        
        base_raw = BASEAssessment.calculate_base_score(base_responses)
        base_norm = BASEAssessment.calculate_base_normalized(base_raw)
        MVMT_raw = MVMTAssessment.calculate_MVMT_score(MVMT_responses)
        MVMT_norm = MVMTAssessment.calculate_MVMT_normalized(MVMT_raw)
        ina_value = MVMTAssessment.calculate_ina_component(MVMT_responses)
        
        STRATA_raw = STRATAAssessment.calculate_STRATA_score(STRATA_responses)
        STRATA_score = STRATAAssessment.calculate_STRATA_normalized(STRATA_raw)
        STRATA_level, _ = STRATAAssessment.get_STRATA_interpretation(STRATA_score)
        
        kai_score = KAICalculator.calculate_kai(base_norm, MVMT_norm, STRATA_score)
        kai_level, _ = KAICalculator.get_kai_interpretation(kai_score)
        
        effective_adherence = INACalculator.calculate_effective_adherence(kai_score, ina_value)
        ina_level, _ = INACalculator.get_ina_interpretation(ina_value)
        
        patient = {
            'patient_id': f"ATLAS{str(start_id + i).zfill(7)}",
            'age': age,
            'gender': gender,
            'city': city,
            'country': country,
            'region': region,
            'latitude': float(base_lat + np.random.normal(0, 0.1)),
            'longitude': float(base_lon + np.random.normal(0, 0.1)),
            'base_normalized': base_norm,
            'MVMT_normalized': MVMT_norm,
            'STRATA_score': STRATA_score,
            'STRATA_level': STRATA_level,
            'kai_score': kai_score,
            'kai_level': kai_level,
            'ina_value': ina_value,
            'ina_level': ina_level,
            'effective_adherence': effective_adherence,
            'hospitalization_risk': round((1 - kai_score) * 0.6, 3),
            'emergency_risk': round((1 - kai_score) * 0.7, 3),
            'intervention_roi': round(2 + np.random.exponential(1.5), 2),
            'net_savings': round(np.random.uniform(1000, 15000), 0)
        }
        
        patients.append(patient)
    
    return pd.DataFrame(patients)

print("✅ Data generation functions loaded - 12 global cities")
print("="*80)
print("📦 PART 1/3 COMPLETE - Core Models & Data Generation")
print("="*80)

# ============================================================================
# ATLAS PART 2/3 - VISUALIZATIONS, DASHBOARDS & UI COMPONENTS
# ============================================================================
# This is the middle section - paste AFTER Part 1

# ============================================================================
# VISUALIZATION COMPONENTS - STUNNING EDITION
# ============================================================================

class ATLASMapVisualization:
    """Professional map visualization system"""
    
    @staticmethod
    def create_interactive_map(df, mapbox_token, selected_patient=None):
        """Create stunning interactive patient map with OpenStreetMap fallback"""
        
        if df.empty:
            fig = go.Figure()
            fig.update_layout(
                title="No patients loaded - Click 'GENERATE' button",
                height=650,
                paper_bgcolor='rgba(0,0,0,0)',
                font={'color': 'white'}
            )
            return fig
        
        if len(df) > 5000:
            df_map = df.sample(n=5000, random_state=42).copy()
        else:
            df_map = df.copy()
        
        fig = go.Figure()
        
        kai_colors = {
            "Optimal Alignment": "#10b981",
            "Good Alignment": "#3b82f6",
            "Moderate Alignment": "#f59e0b",
            "Poor Alignment": "#ef4444",
            "Critical Misalignment": "#7f1d1d"
        }
        
        for kai_level in kai_colors.keys():
            level_data = df_map[df_map['kai_level'] == kai_level]
            
            if len(level_data) == 0:
                continue
            
            marker_sizes = level_data.apply(lambda row: 
                max(8, min(20, 12 + (row['ina_value'] * 20))), axis=1
            )
            
            hover_text = level_data.apply(lambda row:
                f"<b>{row['patient_id']}</b><br>" +
                f"📍 {row['city']}, {row['country']}<br>" +
                f"<br><b>Adherence Cartography:</b><br>" +
                f"🎯 KAI: {row['kai_score']:.4f} ({row['kai_level']})<br>" +
                f"📊 BASE: {row['base_normalized']:.3f}<br>" +
                f"📈 MVMT: {row['MVMT_normalized']:.3f}<br>" +
                f"🌐 STRATA: {row['STRATA_score']:.3f}<br>" +
                f"⚡ INA: {row['ina_value']:.3f}<br>" +
                f"✨ Effective: {row['effective_adherence']:.4f}<br>" +
                f"<br><i>Click for full profile</i>", axis=1
            )
            
            fig.add_trace(go.Scattermapbox(
                lat=level_data['latitude'],
                lon=level_data['longitude'],
                mode='markers',
                marker=dict(
                    size=marker_sizes,
                    color=kai_colors[kai_level],
                    opacity=0.8,
                    sizemode='diameter'
                ),
                text=hover_text,
                hovertemplate='%{text}<extra></extra>',
                name=f"{kai_level} ({len(level_data)})",
                showlegend=True,
                customdata=level_data['patient_id'].values
            ))
        
        # Configure map - FIXED: Better OpenStreetMap handling
        if mapbox_token and len(mapbox_token) > 10:  # Valid token check
            try:
                mapbox_config = dict(
                    center=dict(lat=20, lon=0),
                    zoom=1.5,
                    style="dark",
                    accesstoken=mapbox_token
                )
            except:
                # Fallback to OpenStreetMap if Mapbox fails
                mapbox_config = dict(
                    center=dict(lat=20, lon=0),
                    zoom=1.5,
                    style="open-street-map"
                )
        else:
            # Use OpenStreetMap by default
            mapbox_config = dict(
                center=dict(lat=20, lon=0),
                zoom=1.5,
                style="open-street-map"
            )
        
        fig.update_layout(
            mapbox=mapbox_config,
            height=650,
            margin=dict(l=0, r=0, t=40, b=0),
            title={
                'text': "🌍 ATLAS Global Patient Distribution",
                'x': 0.5,
                'xanchor': 'center',
                'font': {'size': 20, 'color': 'white', 'family': 'Inter'}
            },
            legend=dict(
                yanchor="top", y=0.99,
                xanchor="left", x=0.01,
                bgcolor="rgba(0,0,0,0.9)",
                bordercolor="rgba(255,255,255,0.3)",
                borderwidth=2,
                font={'size': 12, 'color': 'white'}
            ),
            hovermode='closest',
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)'
        )
        
        return fig
    
    @staticmethod
    def create_3d_kai_cube(df, selected_patient=None, show_journey=False):
        """Create STUNNING 3D KAI cube with prediction surfaces"""
        
        if df.empty:
            fig = go.Figure()
            fig.update_layout(
                title="No patients loaded",
                height=900,
                paper_bgcolor='rgba(0,0,0,0)',
                font={'color': 'white'}
            )
            return fig
        
        if len(df) > 2000:
            df_3d = df.sample(n=2000, random_state=42).copy()
        else:
            df_3d = df.copy()
        
        fig = go.Figure()
        
        kai_colors = {
            "Optimal Alignment": "#10b981",
            "Good Alignment": "#3b82f6",
            "Moderate Alignment": "#f59e0b",
            "Poor Alignment": "#ef4444",
            "Critical Misalignment": "#7f1d1d"
        }
        
        # Plot all patients
        for kai_level in kai_colors.keys():
            level_data = df_3d[df_3d['kai_level'] == kai_level]
            
            if len(level_data) > 0:
                marker_sizes = level_data.apply(lambda row: 
                    5 + (row['ina_value'] * 25), axis=1
                )
                
                hover_text = level_data.apply(lambda row:
                    f"<b>{row['patient_id']}</b><br>" +
                    f"<br><b>📊 Dimensional Scores:</b><br>" +
                    f"BASE (Structure): {row['base_normalized']:.3f}<br>" +
                    f"MVMT (Execution): {row['MVMT_normalized']:.3f}<br>" +
                    f"STRATA (Support): {row['STRATA_score']:.3f}<br>" +
                    f"<br><b>🎯 Calculated Indices:</b><br>" +
                    f"KAI Score: {row['kai_score']:.4f}<br>" +
                    f"INA Friction: {row['ina_value']:.3f}<br>" +
                    f"Effective Adherence: {row['effective_adherence']:.4f}<br>" +
                    f"<br><b>📍 Location:</b><br>" +
                    f"{row['city']}, {row['country']}", axis=1
                )
                
                fig.add_trace(go.Scatter3d(
                    x=level_data['base_normalized'],
                    y=level_data['MVMT_normalized'],
                    z=level_data['STRATA_score'],
                    mode='markers',
                    marker=dict(
                        size=marker_sizes,
                        color=kai_colors[kai_level],
                        opacity=0.7,
                        symbol='circle',
                        line=dict(width=1, color='white')
                    ),
                    text=hover_text,
                    hovertemplate='%{text}<extra></extra>',
                    name=f"{kai_level} ({len(level_data)})",
                    customdata=level_data['patient_id'].values
                ))
        
        # Add prediction surfaces if enabled - FIXED to not cover patients
        if show_journey:
            base_range = np.linspace(0, 1, 15)
            mvmt_range = np.linspace(0, 1, 15)
            base_mesh, mvmt_mesh = np.meshgrid(base_range, mvmt_range)
            
            colors_for_levels = ['Purples', 'Blues', 'Greens']
            
            for idx, strata_level in enumerate([0.3, 0.6, 0.9]):
                kai_surface = np.zeros_like(base_mesh)
                for i in range(base_mesh.shape[0]):
                    for j in range(base_mesh.shape[1]):
                        kai_surface[i, j] = KAICalculator.calculate_kai(
                            base_mesh[i, j], mvmt_mesh[i, j], strata_level
                        )
                
                fig.add_trace(go.Surface(
                    x=base_mesh,
                    y=mvmt_mesh,
                    z=np.full_like(base_mesh, strata_level),
                    surfacecolor=kai_surface,
                    colorscale=colors_for_levels[idx],
                    opacity=0.2,
                    showscale=False,
                    name=f"STRATA={strata_level:.1f} Plane",
                    hoverinfo='skip',
                    visible=True
                ))
        
        fig.update_layout(
            title={
                'text': "🧊 KYBOS Cube™: BASE × MVMT × STRATA³",
                'x': 0.5,
                'xanchor': 'center',
                'font': {'size': 20, 'color': 'white', 'family': 'Inter'}
            },
            scene=dict(
                xaxis=dict(
                    title=dict(text="<b>BASE</b><br>(Behavioral Structure)", 
                              font=dict(size=14, color='white')),
                    backgroundcolor="rgba(10,10,30,0.3)",
                    gridcolor="rgba(255,255,255,0.4)",
                    gridwidth=2,
                    showspikes=True,
                    spikesides=True,
                    spikecolor='cyan',
                    spikethickness=3,
                    range=[-0.05, 1.05],
                    tickfont=dict(color='white', size=11)
                ),
                yaxis=dict(
                    title=dict(text="<b>MVMT</b><br>(Execution Consistency)", 
                              font=dict(size=14, color='white')),
                    backgroundcolor="rgba(10,10,30,0.3)",
                    gridcolor="rgba(255,255,255,0.4)",
                    gridwidth=2,
                    showspikes=True,
                    spikesides=True,
                    spikecolor='cyan',
                    spikethickness=3,
                    range=[-0.05, 1.05],
                    tickfont=dict(color='white', size=11)
                ),
                zaxis=dict(
                    title=dict(text="<b>STRATA</b><br>(Support Network)", 
                              font=dict(size=14, color='white')),
                    backgroundcolor="rgba(10,10,30,0.3)",
                    gridcolor="rgba(255,255,255,0.4)",
                    gridwidth=2,
                    showspikes=True,
                    spikesides=True,
                    spikecolor='cyan',
                    spikethickness=3,
                    range=[-0.05, 1.05],
                    tickfont=dict(color='white', size=11)
                ),
                camera=dict(
                    eye=dict(x=1.8, y=1.8, z=1.8),
                    center=dict(x=0, y=0, z=0),
                    projection=dict(type='perspective')
                ),
                aspectmode='cube',
                bgcolor="rgba(5,5,15,0.8)"
            ),
            height=900,
            showlegend=True,
            legend=dict(
                x=0.02, y=0.98,
                bgcolor="rgba(0,0,0,0.9)",
                bordercolor="rgba(255,255,255,0.3)",
                borderwidth=2,
                font={'color': 'white', 'size': 11}
            ),
            hovermode='closest',
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)'
        )
        
        return fig

print("✅ Stunning visualization components loaded (Map + 3D Cube)")

# ============================================================================
# IOPE DASHBOARD - FULL INVESTOR ROI ANALYTICS
# ============================================================================

class IOPEDashboard:
    """Complete IOPE Dashboard - Investor-Focused ROI Analysis"""
    
    @staticmethod
    def create_roi_explosion_chart(df):
        """Animated ROI explosion showing value creation"""
        if df.empty:
            return go.Figure()
        
        df_copy = df.copy()
        df_copy['roi_tier'] = pd.cut(df_copy['intervention_roi'], 
                                bins=[0, 1.5, 2.5, 4, 10],
                                labels=['1-1.5x', '1.5-2.5x', '2.5-4x', '4x+'])
        
        roi_summary = df_copy.groupby('roi_tier', observed=True).agg({
            'net_savings': 'sum',
            'patient_id': 'count'
        }).reset_index()
        roi_summary.columns = ['ROI Tier', 'Total Value ($)', 'Patients']
        
        roi_summary = roi_summary[roi_summary['Patients'] > 0]
        
        if roi_summary.empty:
            fig = go.Figure()
            fig.update_layout(
                title="No ROI data available",
                paper_bgcolor='rgba(0,0,0,0)',
                font={'color': 'white'}
            )
            return fig
        
        fig = go.Figure()
        colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981']
        
        for idx, row in roi_summary.iterrows():
            avg_per_patient = row['Total Value ($)'] / row['Patients'] if row['Patients'] > 0 else 0
            
            fig.add_trace(go.Bar(
                name=row['ROI Tier'],
                x=[row['ROI Tier']],
                y=[row['Total Value ($)']],
                text=f"${row['Total Value ($)']/1000:.0f}K<br>{row['Patients']} pts",
                textposition='auto',
                marker_color=colors[idx % len(colors)],
                marker_line_color='white',
                marker_line_width=2,
                hovertemplate=f"<b>{row['ROI Tier']}</b><br>" +
                             f"Value: ${row['Total Value ($)']:,.0f}<br>" +
                             f"Patients: {row['Patients']}<br>" +
                             f"Avg per patient: ${avg_per_patient:,.0f}" +
                             "<extra></extra>"
            ))
        
        fig.update_layout(
            title={
                'text': "💰 ROI Explosion: Value by Return Tier",
                'x': 0.5,
                'xanchor': 'center',
                'font': {'size': 20, 'color': 'white'}
            },
            showlegend=False,
            height=450,
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            font={'color': 'white', 'size': 14},
            xaxis=dict(title="ROI Tier", gridcolor='rgba(255,255,255,0.1)'),
            yaxis=dict(title="Total Value Generated ($)", gridcolor='rgba(255,255,255,0.1)')
        )
        
        return fig
    
    @staticmethod
    def create_roi_scatter_bubble(df):
        """Interactive bubble chart: KAI vs ROI"""
        if df.empty:
            return go.Figure()
        
        sample_df = df.sample(min(500, len(df)), random_state=42)
        
        fig = go.Figure()
        
        fig.add_trace(go.Scatter(
            x=sample_df['kai_score'],
            y=sample_df['intervention_roi'],
            mode='markers',
            marker=dict(
                size=sample_df['net_savings'] / 200,
                color=sample_df['effective_adherence'],
                colorscale='Viridis',
                showscale=True,
                colorbar=dict(title="Effective<br>Adherence"),
                line=dict(width=1, color='white'),
                sizemode='diameter',
                sizemin=4
            ),
            text=sample_df.apply(lambda row: 
                f"Patient: {row['patient_id']}<br>" +
                f"KAI: {row['kai_score']:.3f}<br>" +
                f"ROI: {row['intervention_roi']:.1f}x<br>" +
                f"Net Value: ${row['net_savings']:,.0f}<br>" +
                f"EA: {row['effective_adherence']:.3f}", axis=1
            ),
            hovertemplate='%{text}<extra></extra>',
            name='Patients'
        ))
        
        fig.add_hline(y=2, line_dash="dash", line_color="yellow", 
                     annotation_text="2x ROI Target", annotation_position="right")
        fig.add_hline(y=3, line_dash="dash", line_color="lime", 
                     annotation_text="3x ROI Excellence", annotation_position="right")
        
        fig.update_layout(
            title="🎯 Investment Sweet Spot: KAI × ROI Matrix",
            xaxis_title="KAI Score (Adherence Potential)",
            yaxis_title="Return on Investment (Multiplier)",
            height=550,
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0.1)',
            font={'color': 'white'},
            xaxis=dict(gridcolor='rgba(255,255,255,0.1)', range=[0, 1]),
            yaxis=dict(gridcolor='rgba(255,255,255,0.1)'),
            showlegend=False
        )
        
        return fig

print("✅ IOPE Dashboard components loaded")

# ============================================================================
# THE ADHERENCE LOOM™ - PARALLEL COORDINATES
# ============================================================================

def create_adherence_loom(df):
    """🧵 The Adherence Loom™ - Beautiful parallel coordinates"""
    
    if df.empty:
        fig = go.Figure()
        fig.update_layout(
            title="No patients loaded",
            height=600,
            paper_bgcolor='rgba(0,0,0,0)',
            font={'color': 'white'}
        )
        return fig
    
    if len(df) > 1000:
        df_loom = df.sample(n=1000, random_state=42).copy()
    else:
        df_loom = df.copy()
    
    colorscale = [
        [0.0, '#ef4444'],
        [0.25, '#f59e0b'],
        [0.5, '#eab308'],
        [0.75, '#3b82f6'],
        [1.0, '#10b981']
    ]
    
    fig = go.Figure(data=go.Parcoords(
        line=dict(
            color=df_loom['kai_score'],
            colorscale=colorscale,
            showscale=True,
            cmin=0,
            cmax=1,
            colorbar=dict(
                title=dict(text="<b>KAI Score</b>", font=dict(size=14, color='white')),
                tickfont=dict(color='white', size=12),
                len=0.7,
                thickness=20,
                x=1.12
            )
        ),
        dimensions=[
            dict(range=[0, 1], constraintrange=[0, 1], label='<b>BASE</b><br>(Structure)', 
                 values=df_loom['base_normalized']),
            dict(range=[0, 1], constraintrange=[0, 1], label='<b>MVMT</b><br>(Execution)', 
                 values=df_loom['MVMT_normalized']),
            dict(range=[0, 1], constraintrange=[0, 1], label='<b>STRATA</b><br>(Support)', 
                 values=df_loom['STRATA_score']),
            dict(range=[0, 1], constraintrange=[0, 1], label='<b>KAI</b><br>(Index)', 
                 values=df_loom['kai_score']),
            dict(range=[0, 0.5], constraintrange=[0, 0.5], label='<b>INA</b><br>(Friction)', 
                 values=df_loom['ina_value']),
            dict(range=[0, 1], constraintrange=[0, 1], label='<b>EA</b><br>(Effective)', 
                 values=df_loom['effective_adherence'])
        ],
        labelangle=-45,
        labelside='bottom',
        labelfont=dict(size=13, color='white', family='Inter')
    ))
    
    fig.update_layout(
        title={
            'text': '🧵 The Adherence Loom™: Weaving the Patient Journey',
            'x': 0.5,
            'xanchor': 'center',
            'font': {'size': 22, 'color': 'white', 'family': 'Inter', 'weight': 'bold'}
        },
        height=600,
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0.1)',
        font={'color': 'white'},
        margin=dict(l=80, r=200, t=100, b=80)
    )
    
    return fig

print("✅ The Adherence Loom™ loaded")

# ============================================================================
# LIVE ASSESSMENT WITH REAL-TIME KAI FLOATER
# ============================================================================

def create_assessment_interface():
    """Create live assessment interface with REAL-TIME KAI (no submit button!)"""
    
    return html.Div([
        # Real-time KAI Floater - EA PROMINENT, KAI at bottom
        html.Div([
            html.Div([
                html.Div([
                    html.I(className="fas fa-star fa-4x mb-3 pulse-animation", 
                          style={"color": "#10b981"}),
                    html.H3("EFFECTIVE ADHERENCE", className="mb-2", 
                           style={"letterSpacing": "2px", "fontSize": "1.2rem"}),
                ], className="text-center"),
                
                html.Div([
                    html.H1(id="live-ea", children="--", 
                           className="text-center",
                           style={
                               "fontSize": "4.5rem",
                               "fontWeight": "900",
                               "background": "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                               "WebkitBackgroundClip": "text",
                               "WebkitTextFillColor": "transparent",
                               "textShadow": "0 0 40px rgba(16, 185, 129, 0.6)"
                           }),
                    html.P(id="live-kai-level", children="Answer questions below", 
                          className="text-center text-success fw-bold mb-3",
                          style={"fontSize": "1.1rem"})
                ]),
                
                html.Hr(style={"borderColor": "rgba(16, 185, 129, 0.3)", "borderWidth": "2px"}),
                
                html.Div([
                    html.Div([
                        html.Div([
                            html.I(className="fas fa-brain me-2 text-info"),
                            html.Strong("BASE: ", style={"color": "#3b82f6"}),
                            html.Span(id="live-base", children="--", className="float-end fw-bold text-info")
                        ], className="mb-2 p-2", style={"background": "rgba(59, 130, 246, 0.1)", "borderRadius": "8px"}),
                        
                        html.Div([
                            html.I(className="fas fa-chart-line me-2 text-primary"),
                            html.Strong("MVMT: ", style={"color": "#8b5cf6"}),
                            html.Span(id="live-mvmt", children="--", className="float-end fw-bold text-primary")
                        ], className="mb-2 p-2", style={"background": "rgba(139, 92, 246, 0.1)", "borderRadius": "8px"}),
                        
                        html.Div([
                            html.I(className="fas fa-network-wired me-2 text-success"),
                            html.Strong("STRATA: ", style={"color": "#10b981"}),
                            html.Span(id="live-strata", children="--", className="float-end fw-bold text-success")
                        ], className="mb-2 p-2", style={"background": "rgba(16, 185, 129, 0.1)", "borderRadius": "8px"}),
                        
                        html.Div([
                            html.I(className="fas fa-bolt me-2 text-warning"),
                            html.Strong("INA: ", style={"color": "#f59e0b"}),
                            html.Span(id="live-ina", children="--", className="float-end fw-bold text-warning")
                        ], className="mb-2 p-2", style={"background": "rgba(245, 158, 11, 0.1)", "borderRadius": "8px"}),
                        
                        html.Hr(style={"borderColor": "rgba(255, 255, 255, 0.2)", "margin": "10px 0"}),
                        
                        html.Div([
                            html.I(className="fas fa-cube me-2 text-info"),
                            html.Strong("KAI Score: ", style={"color": "#3b82f6", "fontSize": "0.9rem"}),
                            html.Span(id="live-kai-score", children="--", 
                                     className="float-end fw-bold text-info",
                                     style={"fontSize": "1.1rem"})
                        ], className="p-2", style={
                            "background": "rgba(59, 130, 246, 0.1)",
                            "borderRadius": "8px",
                            "border": "1px solid rgba(59, 130, 246, 0.3)"
                        })
                    ])
                ])
            ], className="p-4")
        ], style={
            'position': 'fixed',
            'top': '120px',
            'right': '30px',
            'width': '320px',
            'zIndex': '1000',
            'background': 'linear-gradient(135deg, rgba(0,0,0,0.95) 0%, rgba(15,23,42,0.98) 100%)',
            'border': '3px solid rgba(16, 185, 129, 0.4)',
            'borderRadius': '25px',
            'boxShadow': '0 20px 60px rgba(16, 185, 129, 0.3), 0 0 100px rgba(16, 185, 129, 0.1)',
            'animation': 'float 3s ease-in-out infinite'
        }),
        
        # Assessment Content - NO SUBMIT BUTTON!
        html.Div([
            html.Div([
                html.H1([
                    html.I(className="fas fa-clipboard-check me-3"),
                    "Live Patient Assessment"
                ], className="mb-2", style={
                    "background": "linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)",
                    "WebkitBackgroundClip": "text",
                    "WebkitTextFillColor": "transparent",
                    "fontSize": "2.5rem",
                    "fontWeight": "900"
                }),
                html.P("✨ KAI calculates automatically as you answer each question", 
                      className="text-muted mb-4", style={"fontSize": "1.1rem"})
            ]),
            
            # BASE Section  
            html.Div([
                html.H4([html.I(className="fas fa-brain me-2 text-info"), 
                        "BASE: Behavioral Architecture"], className="mb-3"),
                html.Div(id="base-questions", children=[
                    create_question_card(q, idx) 
                    for idx, q in enumerate(BASEAssessment.QUESTIONS)
                ])
            ], className="mb-5"),
            
            # MVMT Section
            html.Div([
                html.H4([html.I(className="fas fa-chart-line me-2 text-primary"), 
                        "MVMT: Execution Consistency (Past 7 Days)"], className="mb-3"),
                html.Div(id="mvmt-questions", children=[
                    create_question_card(q, idx, prefix="mvmt") 
                    for idx, q in enumerate(MVMTAssessment.QUESTIONS)
                ])
            ], className="mb-5"),
            
            # STRATA Section
            html.Div([
                html.H4([html.I(className="fas fa-network-wired me-2 text-success"), 
                        "STRATA: Support Network"], className="mb-3"),
                html.Div(id="strata-questions", children=[
                    create_strata_question_card(q, idx) 
                    for idx, q in enumerate(STRATAAssessment.QUESTIONS)
                ])
            ], className="mb-5")
            
        ], style={'marginRight': '370px', 'paddingLeft': '20px'})
    ])


def create_question_card(question, idx, prefix="base"):
    """Create a question card for BASE/MVMT"""
    return dbc.Card([
        dbc.CardBody([
            html.H6([
                html.Span(f"Q{idx+1}", className="badge bg-primary me-2"),
                question['title']
            ], className="mb-2"),
            html.P(question['question'], className="mb-3"),
            dbc.RadioItems(
                id={'type': f'{prefix}-radio', 'index': idx},
                options=[{'label': opt, 'value': opt} for opt in question['options']],
                inline=True,
                className="mb-0"
            )
        ])
    ], className="glass-card mb-3")


def create_strata_question_card(question, idx):
    """Create a question card for STRATA with weighted options"""
    return dbc.Card([
        dbc.CardBody([
            html.H6([
                html.Span(f"Q{idx+1}", className="badge bg-success me-2"),
                question['title']
            ], className="mb-2"),
            html.P(question['question'], className="mb-3"),
            dbc.RadioItems(
                id={'type': 'strata-radio', 'index': idx},
                options=[
                    {'label': f"{opt[0]} ({opt[1]:.1f})", 'value': str(opt[1])} 
                    for opt in question['options']
                ],
                className="mb-0"
            )
        ])
    ], className="glass-card mb-3")

print("✅ Live assessment interface loaded (REAL-TIME, NO SUBMIT BUTTON)")

# ============================================================================
# PATIENT PROFILE COMPONENT
# ============================================================================

def create_patient_profile_card(patient_data):
    """Create detailed patient profile card"""
    
    if isinstance(patient_data, pd.Series):
        patient_data = patient_data.to_dict()
    
    kai_score = patient_data['kai_score']
    if kai_score >= 0.85:
        risk_color = "success"
    elif kai_score >= 0.70:
        risk_color = "primary"
    elif kai_score >= 0.55:
        risk_color = "info"
    elif kai_score >= 0.40:
        risk_color = "warning"
    else:
        risk_color = "danger"
    
    return html.Div([
        dbc.Row([
            dbc.Col([
                html.H3([html.I(className="fas fa-user-circle me-2"), 
                        patient_data['patient_id']], className="mb-2"),
                html.H6([html.I(className="fas fa-map-marker-alt me-2"), 
                        f"{patient_data['city']}, {patient_data['country']}"], 
                       className="text-muted"),
                html.P([
                    html.I(className="fas fa-user me-2"),
                    f"{patient_data['gender']}, Age {patient_data['age']}"
                ], className="text-muted mb-0")
            ], width=8),
            dbc.Col([
                html.Div([
                    html.H1(f"{patient_data['kai_score']:.4f}", 
                           className=f"text-{risk_color} mb-0"),
                    html.P("KAI Score", className="text-muted mb-0"),
                    html.Small(patient_data['kai_level'], className="text-muted")
                ], className="text-center")
            ], width=4)
        ], className="mb-4"),
        
        html.Hr(),
        
        html.H6([html.I(className="fas fa-cube me-2"), 
                "Adherence Cartography"], className="text-primary mb-3"),
        dbc.Row([
            dbc.Col([
                html.Div([
                    html.H5("BASE", className="text-info mb-1"),
                    html.H3(f"{patient_data['base_normalized']:.3f}", 
                           className="text-info mb-1"),
                    html.Small("Behavioral Structure"),
                    dbc.Progress(value=patient_data['base_normalized']*100, 
                               color="info", className="mt-2", style={'height': '8px'})
                ], className="text-center p-3 glass-card")
            ], width=4),
            dbc.Col([
                html.Div([
                    html.H5("MVMT", className="text-primary mb-1"),
                    html.H3(f"{patient_data['MVMT_normalized']:.3f}", 
                           className="text-primary mb-1"),
                    html.Small("Execution Consistency"),
                    dbc.Progress(value=patient_data['MVMT_normalized']*100, 
                               color="primary", className="mt-2", style={'height': '8px'})
                ], className="text-center p-3 glass-card")
            ], width=4),
            dbc.Col([
                html.Div([
                    html.H5("STRATA", className="text-success mb-1"),
                    html.H3(f"{patient_data['STRATA_score']:.3f}", 
                           className="text-success mb-1"),
                    html.Small("Support Network"),
                    dbc.Progress(value=patient_data['STRATA_score']*100, 
                               color="success", className="mt-2", style={'height': '8px'})
                ], className="text-center p-3 glass-card")
            ], width=4)
        ], className="mb-4"),
        
        html.Hr(),
        
        html.H6([html.I(className="fas fa-bolt me-2"), 
                "Friction & Effectiveness"], className="text-warning mb-3"),
        dbc.Row([
            dbc.Col([
                html.Div([
                    html.H5("INA Friction", className="text-warning mb-1"),
                    html.H2(f"{patient_data['ina_value']:.3f}", 
                           className="text-warning mb-1"),
                    html.Small("Intentional Deviation"),
                    dbc.Progress(value=patient_data['ina_value']*200, 
                               color="warning", className="mt-2")
                ], className="text-center p-3 glass-card")
            ], width=6),
            dbc.Col([
                html.Div([
                    html.H5("Effective Adherence", className="text-success mb-1"),
                    html.H2(f"{patient_data['effective_adherence']:.4f}", 
                           className="text-success mb-1"),
                    html.Small("KAI × (1 - INA)"),
                    dbc.Progress(value=patient_data['effective_adherence']*100, 
                               color="success", className="mt-2")
                ], className="text-center p-3 glass-card")
            ], width=6)
        ], className="mb-4"),
        
        html.Hr(),
        
        html.H6([html.I(className="fas fa-chart-bar me-2"), 
                "Clinical Risk & ROI"], className="text-info mb-3"),
        dbc.Row([
            dbc.Col([
                html.P([html.Strong("Hospitalization Risk: "), 
                       f"{patient_data['hospitalization_risk']:.1%}"], className="mb-2"),
                html.P([html.Strong("Emergency Risk: "), 
                       f"{patient_data['emergency_risk']:.1%}"], className="mb-2"),
            ], width=6),
            dbc.Col([
                html.P([html.Strong("Intervention ROI: "), 
                       f"{patient_data['intervention_roi']:.2f}x"], className="mb-2"),
                html.P([html.Strong("Net Savings: "), 
                       f"${patient_data['net_savings']:,.0f}"], className="mb-2 text-success")
            ], width=6)
        ])
    ])

print("✅ Patient profile components loaded")
print("="*80)
print("📦 PART 2/3 COMPLETE - Visualizations & UI Components")
print("="*80)

# ============================================================================
# ATLAS PART 3/3 - MAIN APPLICATION, CALLBACKS & ENTRY POINT
# ============================================================================
# This is the final section - paste AFTER Part 1 and Part 2

# ============================================================================
# MAIN DASH APPLICATION
# ============================================================================

def create_atlas_app():
    """Create the complete ATLAS application"""
    
    external_stylesheets = [
        dbc.themes.CYBORG,
        "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
    ]
    
    app = dash.Dash(
        __name__, 
        external_stylesheets=external_stylesheets,
        title=f"{APP_TITLE} v{VERSION}",
        suppress_callback_exceptions=True
    )
    
    app.index_string = '''
    <!DOCTYPE html>
    <html>
        <head>
            {%metas%}
            <title>{%title%}</title>
            {%favicon%}
            {%css%}
            <style>
                body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 25%, #0f172a 50%, #1e3a8a 100%);
                    background-attachment: fixed;
                    color: white;
                    min-height: 100vh;
                }
                .glass-card {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                    transition: all 0.3s ease;
                }
                .glass-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
                    border-color: rgba(255, 255, 255, 0.2);
                }
                .atlas-header {
                    background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%);
                    padding: 2.5rem;
                    border-radius: 25px 25px 0 0;
                    box-shadow: 0 10px 40px rgba(59, 130, 246, 0.3);
                }
                .metric-card {
                    background: rgba(255, 255, 255, 0.08);
                    border: 2px solid rgba(255, 255, 255, 0.1);
                    border-radius: 15px;
                    padding: 1.5rem;
                    text-align: center;
                    transition: all 0.3s ease;
                }
                .metric-card:hover {
                    transform: translateY(-5px) scale(1.02);
                    border-color: rgba(59, 130, 246, 0.5);
                    box-shadow: 0 15px 40px rgba(59, 130, 246, 0.2);
                }
                .control-panel {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(15px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 15px;
                    padding: 1.5rem;
                }
                .nav-tabs .nav-link {
                    color: rgba(255, 255, 255, 0.7);
                    border: none;
                    border-radius: 10px 10px 0 0;
                    transition: all 0.2s;
                }
                .nav-tabs .nav-link:hover {
                    color: white;
                    background: rgba(255, 255, 255, 0.1);
                }
                .nav-tabs .nav-link.active {
                    color: white;
                    background: rgba(59, 130, 246, 0.3);
                    border-bottom: 3px solid #3b82f6;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
                .pulse-animation {
                    animation: pulse 2s ease-in-out infinite;
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-10px); }
                }
                #generate-patients-btn:hover {
                    transform: translateY(-3px) scale(1.02);
                    box-shadow: 0 15px 50px rgba(139, 92, 246, 0.6) !important;
                }
            </style>
        </head>
        <body>
            {%app_entry%}
            <footer>
                {%config%}
                {%scripts%}
                {%renderer%}
            </footer>
        </body>
    </html>
    '''
    
    # Main Layout
    app.layout = html.Div([
        dcc.Store(id="atlas-dataset", data=pd.DataFrame().to_json(orient="split")),
        dcc.Store(id="selected-patient", data=None),
        
        # Patient Profile Modal
        dbc.Modal([
            dbc.ModalHeader(dbc.ModalTitle(id="profile-modal-title")),
            dbc.ModalBody(id="profile-modal-body")
        ], id="patient-profile-modal", size="xl", is_open=False, scrollable=True),
        
        # Main Container
        html.Div([
            create_header(),
            create_patient_generator(),
            create_controls(),
            
            # Tabs
            dbc.Tabs([
                dbc.Tab(label="🗺️ Global Map", tab_id="map"),
                dbc.Tab(label="🧊 3D Cube", tab_id="cube"),
                dbc.Tab(label="📊 Analytics", tab_id="analysis"),
                dbc.Tab(label="💰 IOPE Dashboard", tab_id="iope"),
                dbc.Tab(label="📋 Live Assessment", tab_id="assessment")
            ], id="main-tabs", active_tab="map", className="mb-3"),
            
            html.Div(id="main-content", className="p-3")
            
        ], className="atlas-container m-3", style={
            "background": "rgba(255, 255, 255, 0.02)",
            "borderRadius": "25px",
            "minHeight": "calc(100vh - 20px)"
        })
    ])
    
    register_callbacks(app)
    
    return app


def create_header():
    """Create header with live metrics"""
    return html.Div([
        dbc.Row([
            dbc.Col([
                html.H1([
                    html.I(className="fas fa-satellite-dish me-3"),
                    "ATLAS"
                ], style={"fontSize": "3rem", "fontWeight": "800", "letterSpacing": "2px"}),
                html.P("Adherence Tools and Location Analytics System", 
                      className="mb-1", style={"fontSize": "1.2rem"}),
                html.Small(f"{VERSION}", className="opacity-75")
            ], md=6),
            
            dbc.Col([
                dbc.Row([
                    dbc.Col([
                        html.Div([
                            html.I(className="fas fa-users mb-2", style={"fontSize": "2.5rem"}),
                            html.H2(id="header-patient-count", children="0", className="mb-1"),
                            html.Small("Patients")
                        ], className="metric-card")
                    ], width=3),
                    dbc.Col([
                        html.Div([
                            html.I(className="fas fa-cube mb-2", style={"fontSize": "2.5rem"}),
                            html.H2(id="header-avg-kai", children="--", className="mb-1"),
                            html.Small("Avg KAI")
                        ], className="metric-card")
                    ], width=3),
                    dbc.Col([
                        html.Div([
                            html.I(className="fas fa-bolt mb-2", style={"fontSize": "2.5rem"}),
                            html.H2(id="header-avg-ea", children="--", className="mb-1"),
                            html.Small("Avg EA")
                        ], className="metric-card")
                    ], width=3),
                    dbc.Col([
                        html.Div([
                            html.I(className="fas fa-dollar-sign mb-2 text-success", 
                                  style={"fontSize": "2.5rem"}),
                            html.H2(id="header-total-roi", children="$0", className="mb-1 text-success"),
                            html.Small("Total ROI")
                        ], className="metric-card")
                    ], width=3)
                ])
            ], md=6)
        ])
    ], className="atlas-header")


def create_patient_generator():
    """Create AWESOME patient generation controls"""
    return html.Div([
        dbc.Card([
            dbc.CardBody([
                dbc.Row([
                    dbc.Col([
                        html.Div([
                            html.I(className="fas fa-magic fa-4x mb-3 pulse-animation",
                                  style={"color": "#8b5cf6"}),
                            html.H3("Patient Data Generator", className="mb-2",
                                   style={"fontWeight": "800", "letterSpacing": "1px"}),
                            html.P("Generate synthetic patient cohorts with realistic adherence profiles",
                                  className="text-muted mb-0")
                        ], className="text-center")
                    ], md=12)
                ], className="mb-4"),
                
                dbc.Row([
                    dbc.Col([
                        html.Div([
                            html.I(className="fas fa-flask fa-2x mb-2 text-info"),
                            html.H4("1,000", className="mb-1 fw-bold"),
                            html.Small("Patients per batch", className="text-muted")
                        ], className="text-center p-3", style={
                            "background": "rgba(59, 130, 246, 0.1)",
                            "borderRadius": "15px",
                            "border": "2px solid rgba(59, 130, 246, 0.3)"
                        })
                    ], md=3),
                    dbc.Col([
                        html.Div([
                            html.I(className="fas fa-globe fa-2x mb-2 text-success"),
                            html.H4("12", className="mb-1 fw-bold"),
                            html.Small("Global cities", className="text-muted")
                        ], className="text-center p-3", style={
                            "background": "rgba(16, 185, 129, 0.1)",
                            "borderRadius": "15px",
                            "border": "2px solid rgba(16, 185, 129, 0.3)"
                        })
                    ], md=3),
                    dbc.Col([
                        html.Div([
                            html.I(className="fas fa-cube fa-2x mb-2 text-warning"),
                            html.H4("3D", className="mb-1 fw-bold"),
                            html.Small("Dimensional analysis", className="text-muted")
                        ], className="text-center p-3", style={
                            "background": "rgba(245, 158, 11, 0.1)",
                            "borderRadius": "15px",
                            "border": "2px solid rgba(245, 158, 11, 0.3)"
                        })
                    ], md=3),
                    dbc.Col([
                        html.Div([
                            html.I(className="fas fa-calculator fa-2x mb-2 text-danger"),
                            html.H4("KAI", className="mb-1 fw-bold"),
                            html.Small("Corrected formula", className="text-muted")
                        ], className="text-center p-3", style={
                            "background": "rgba(239, 68, 68, 0.1)",
                            "borderRadius": "15px",
                            "border": "2px solid rgba(239, 68, 68, 0.3)"
                        })
                    ], md=3)
                ], className="mb-4"),
                
                dbc.Row([
                    dbc.Col([
                        dbc.Button([
                            html.I(className="fas fa-rocket me-3", style={"fontSize": "1.5rem"}),
                            html.Span([
                                html.Div("GENERATE", style={"fontSize": "1.3rem", "fontWeight": "900", "letterSpacing": "2px"}),
                                html.Small("Click to create 1,000 patients", className="d-block", style={"fontSize": "0.8rem", "opacity": "0.8"})
                            ])
                        ], id="generate-patients-btn", 
                        size="lg", 
                        className="w-100",
                        style={
                            "height": "80px",
                            "background": "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 50%, #06b6d4 100%)",
                            "border": "none",
                            "borderRadius": "15px",
                            "boxShadow": "0 10px 40px rgba(139, 92, 246, 0.4)",
                            "transition": "all 0.3s ease",
                            "fontSize": "1.2rem",
                            "fontWeight": "bold"
                        })
                    ], md=12)
                ]),
                
                html.Div(id="generation-status", className="mt-3")
            ])
        ], className="glass-card m-3", style={
            "background": "linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)",
            "border": "2px solid rgba(139, 92, 246, 0.3)"
        })
    ])


def create_controls():
    """Create filter controls"""
    return html.Div([
        dbc.Row([
            dbc.Col([
                dbc.Label("🌍 Region Filter", style={"color": "white", "fontSize": "1.1rem"}),
                dcc.Dropdown(
                    id="region-filter", 
                    options=[
                        {"label": "🌎 All Regions", "value": "all"},
                        {"label": "🇺🇸 North America", "value": "North America"},
                        {"label": "🇪🇺 Europe", "value": "Europe"},
                        {"label": "🇯🇵 Asia", "value": "Asia"},
                        {"label": "🇦🇪 Middle East", "value": "Middle East"},
                    ], 
                    value="all",
                    style={"color": "#000000"}
                )
            ], md=4),
            dbc.Col([
                dbc.Label("🎯 KAI Level", style={"color": "white", "fontSize": "1.1rem"}),
                dcc.Dropdown(
                    id="risk-filter", 
                    options=[
                        {"label": "All Levels", "value": "all"},
                        {"label": "🔴 Critical Misalignment", "value": "Critical Misalignment"},
                        {"label": "🟠 Poor Alignment", "value": "Poor Alignment"},
                        {"label": "🟡 Moderate Alignment", "value": "Moderate Alignment"},
                        {"label": "🔵 Good Alignment", "value": "Good Alignment"},
                        {"label": "🟢 Optimal Alignment", "value": "Optimal Alignment"}
                    ], 
                    value="all",
                    style={"color": "#000000"}
                )
            ], md=4),
            dbc.Col([
                dbc.Label("📊 Filtered Count", style={"color": "white", "fontSize": "1.1rem"}),
                html.H4(id="filter-count", className="text-success fw-bold mt-2")
            ], md=4)
        ])
    ], className="control-panel m-3")


# ============================================================================
# TAB CONTENT CREATORS
# ============================================================================

def create_empty_state():
    """Empty state when no patients"""
    return dbc.Alert([
        html.I(className="fas fa-exclamation-circle fa-4x mb-4"),
        html.H3("No Patients Loaded", className="mb-3"),
        html.P("Click the 'GENERATE' button above to create your first cohort"),
        html.Hr(),
        html.Div([
            html.H5("🔬 Corrected Formula:"),
            html.P([html.Strong("KAI = (BASE × MVMT × STRATA³)^(1/5)")], 
                  className="font-monospace text-info"),
            html.P([html.Strong("EA = KAI × (1 - INA)")], 
                  className="font-monospace text-success")
        ])
    ], color="warning", className="text-center p-5 m-3 glass-card")


def create_map_tab(df):
    """Create map tab content"""
    map_fig = ATLASMapVisualization.create_interactive_map(df, MAPBOX_TOKEN)
    
    return dbc.Row([
        dbc.Col([
            dbc.Card([
                dbc.CardHeader([
                    html.H4([html.I(className="fas fa-globe-americas me-2"),
                            "Global Patient Distribution Map"], className="mb-0")
                ]),
                dbc.CardBody([
                    dcc.Graph(
                        figure=map_fig, 
                        id="map-graph",
                        config={
                            'displayModeBar': True, 
                            'displaylogo': False,
                            'modeBarButtonsToRemove': ['lasso2d', 'select2d']
                        }
                    ),
                    html.Div([
                        html.I(className="fas fa-info-circle me-2"),
                        "Click any patient marker to view detailed profile"
                    ], className="text-center text-muted small mt-3")
                ])
            ], className="glass-card")
        ], width=12)
    ])


def create_cube_tab_content(df):
    """Create cube tab content with prediction surfaces toggle"""
    
    return dbc.Row([
        dbc.Col([
            dbc.Card([
                dbc.CardHeader([
                    dbc.Row([
                        dbc.Col([
                            html.H4([html.I(className="fas fa-cube me-2"),
                                    "KYBOS Cube™ - 3D Adherence Space"], className="mb-0")
                        ], md=8),
                        dbc.Col([
                            dbc.Checklist(
                                id="show-journey-toggle",
                                options=[{"label": " Show Prediction Surfaces", "value": "show"}],
                                value=[],
                                inline=True,
                                switch=True,
                                className="float-end"
                            )
                        ], md=4)
                    ])
                ]),
                dbc.CardBody([
                    dcc.Graph(
                        figure=ATLASMapVisualization.create_3d_kai_cube(df, show_journey=False), 
                        id="cube-graph",
                        config={
                            'displayModeBar': True, 
                            'displaylogo': False,
                            'scrollZoom': True
                        },
                        style={'height': '900px'}
                    ),
                    html.Div([
                        dbc.Row([
                            dbc.Col([
                                html.P([
                                    html.I(className="fas fa-arrows-alt-h me-2 text-info"),
                                    html.Strong("X-Axis (BASE): "),
                                    "Behavioral Architecture & Stability"
                                ], className="mb-2")
                            ], md=4),
                            dbc.Col([
                                html.P([
                                    html.I(className="fas fa-arrows-alt-v me-2 text-primary"),
                                    html.Strong("Y-Axis (MVMT): "),
                                    "Measurable Variance Minimal Term"
                                ], className="mb-2")
                            ], md=4),
                            dbc.Col([
                                html.P([
                                    html.I(className="fas fa-layer-group me-2 text-success"),
                                    html.Strong("Z-Axis (STRATA): "),
                                    "Social & Tangible Resource Access"
                                ], className="mb-2")
                            ], md=4)
                        ]),
                        html.Div([
                            html.I(className="fas fa-lightbulb me-2 text-warning"),
                            html.Strong("Tip: "),
                            "Use mouse to rotate, scroll to zoom. Enable prediction surfaces to see KAI contours at different STRATA levels."
                        ], className="text-center mt-3 p-3", style={
                            "background": "rgba(245, 158, 11, 0.1)",
                            "borderRadius": "10px",
                            "border": "1px solid rgba(245, 158, 11, 0.3)"
                        })
                    ], className="text-center text-muted small mt-3")
                ])
            ], className="glass-card")
        ], width=12)
    ])


def create_analysis_tab(df):
    """Create analysis tab with THE ADHERENCE LOOM™"""
    
    loom_fig = create_adherence_loom(df)
    
    kai_dist = px.histogram(
        df, x='kai_score', color='kai_level',
        nbins=40,
        title="KAI Score Distribution Across Cohort"
    )
    kai_dist.update_layout(
        height=400,
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font={'color': 'white'}
    )
    
    box_fig = go.Figure()
    box_fig.add_trace(go.Box(y=df['base_normalized'], name='BASE', marker_color='#3b82f6'))
    box_fig.add_trace(go.Box(y=df['MVMT_normalized'], name='MVMT', marker_color='#8b5cf6'))
    box_fig.add_trace(go.Box(y=df['STRATA_score'], name='STRATA', marker_color='#10b981'))
    box_fig.update_layout(
        title="Dimensional Score Distribution",
        height=400,
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font={'color': 'white'}
    )
    
    corr_data = df[['base_normalized', 'MVMT_normalized', 'STRATA_score', 
                    'kai_score', 'ina_value', 'effective_adherence']].corr()
    
    heatmap_fig = go.Figure(data=go.Heatmap(
        z=corr_data.values,
        x=['BASE', 'MVMT', 'STRATA', 'KAI', 'INA', 'EA'],
        y=['BASE', 'MVMT', 'STRATA', 'KAI', 'INA', 'EA'],
        colorscale='RdBu',
        zmid=0,
        text=corr_data.values.round(2),
        texttemplate='%{text}',
        textfont={"size": 12, "color": "white"}
    ))
    heatmap_fig.update_layout(
        title="Correlation Matrix",
        height=500,
        paper_bgcolor='rgba(0,0,0,0)',
        font={'color': 'white'}
    )
    
    return html.Div([
        dbc.Row([
            dbc.Col([
                dbc.Card([
                    dbc.CardHeader([
                        html.Div([
                            html.H4([
                                html.I(className="fas fa-project-diagram me-2"),
                                "🧵 The Adherence Loom™"
                            ], className="mb-2"),
                            html.P([
                                html.I(className="fas fa-info-circle me-2"),
                                "Interactive parallel coordinates: Drag vertically on any axis to filter patients. ",
                                "Watch how dimensions weave together!"
                            ], className="small text-muted mb-0")
                        ])
                    ]),
                    dbc.CardBody([dcc.Graph(figure=loom_fig, id="loom-graph")])
                ], className="glass-card mb-4")
            ], md=12)
        ]),
        
        dbc.Row([
            dbc.Col([
                dbc.Card([
                    dbc.CardHeader("📊 KAI Distribution"),
                    dbc.CardBody([dcc.Graph(figure=kai_dist)])
                ], className="glass-card mb-3")
            ], md=12)
        ]),
        dbc.Row([
            dbc.Col([
                dbc.Card([
                    dbc.CardHeader("📦 Dimensional Scores"),
                    dbc.CardBody([dcc.Graph(figure=box_fig)])
                ], className="glass-card mb-3")
            ], md=6),
            dbc.Col([
                dbc.Card([
                    dbc.CardHeader("🔗 Correlation Matrix"),
                    dbc.CardBody([dcc.Graph(figure=heatmap_fig)])
                ], className="glass-card mb-3")
            ], md=6)
        ])
    ])


def create_iope_tab(df):
    """Create IOPE dashboard tab"""
    
    return html.Div([
        dbc.Row([
            dbc.Col([
                dbc.Card([
                    dbc.CardBody([
                        html.I(className="fas fa-hand-holding-usd fa-3x mb-3 text-primary"),
                        html.H2(f"${len(df) * 800 / 1000:.0f}K", className="mb-1"),
                        html.P("Total Investment", className="text-muted mb-0")
                    ], className="text-center")
                ], className="glass-card")
            ], md=3),
            dbc.Col([
                dbc.Card([
                    dbc.CardBody([
                        html.I(className="fas fa-chart-line fa-3x mb-3 text-success"),
                        html.H2(f"${df['net_savings'].sum() / 1000:.0f}K", className="mb-1 text-success"),
                        html.P("Total Returns", className="text-muted mb-0")
                    ], className="text-center")
                ], className="glass-card")
            ], md=3),
            dbc.Col([
                dbc.Card([
                    dbc.CardBody([
                        html.I(className="fas fa-percentage fa-3x mb-3 text-info"),
                        html.H2(f"{df['intervention_roi'].mean():.2f}x", className="mb-1 text-info"),
                        html.P("Average ROI", className="text-muted mb-0")
                    ], className="text-center")
                ], className="glass-card")
            ], md=3),
            dbc.Col([
                dbc.Card([
                    dbc.CardBody([
                        html.I(className="fas fa-trophy fa-3x mb-3 text-warning"),
                        html.H2(f"{len(df[df['intervention_roi'] >= 3])}", className="mb-1 text-warning"),
                        html.P("High Performers (3x+)", className="text-muted mb-0")
                    ], className="text-center")
                ], className="glass-card")
            ], md=3)
        ], className="mb-4"),
        
        dbc.Row([
            dbc.Col([
                dbc.Card([
                    dbc.CardHeader("💰 ROI Explosion by Tier"),
                    dbc.CardBody([
                        dcc.Graph(figure=IOPEDashboard.create_roi_explosion_chart(df))
                    ])
                ], className="glass-card mb-3")
            ], md=6),
            dbc.Col([
                dbc.Card([
                    dbc.CardHeader("🎯 Investment Sweet Spot"),
                    dbc.CardBody([
                        dcc.Graph(figure=IOPEDashboard.create_roi_scatter_bubble(df))
                    ])
                ], className="glass-card mb-3")
            ], md=6)
        ])
    ])


# ============================================================================
# CALLBACKS - ALL THE MAGIC HAPPENS HERE
# ============================================================================

def register_callbacks(app):
    """Register all application callbacks"""
    
    # Generate patients callback
    @app.callback(
        [Output("atlas-dataset", "data"),
         Output("generation-status", "children")],
        [Input("generate-patients-btn", "n_clicks")],
        [State("atlas-dataset", "data")],
        prevent_initial_call=True
    )
    def generate_patients(n_clicks, current_data_json):
        if not n_clicks:
            raise PreventUpdate
        
        try:
            if current_data_json:
                current_df = pd.read_json(current_data_json, orient="split")
            else:
                current_df = None
            
            new_patients = generate_synthetic_patients(1000, current_df)
            
            if current_df is not None and not current_df.empty:
                combined_df = pd.concat([current_df, new_patients], ignore_index=True)
            else:
                combined_df = new_patients
            
            status = dbc.Alert([
                html.Div([
                    html.I(className="fas fa-check-circle fa-3x mb-3 text-success"),
                    html.H4(f"✅ Success!", className="mb-2"),
                    html.P(f"Generated 1,000 new patients!"),
                    html.H5(f"Total Cohort: {len(combined_df):,} patients", 
                           className="text-success fw-bold")
                ], className="text-center")
            ], color="success", className="mt-3", style={
                "borderRadius": "15px",
                "border": "2px solid rgba(16, 185, 129, 0.5)",
                "background": "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)"
            })
            
            return combined_df.to_json(orient="split"), status
            
        except Exception as e:
            error_status = dbc.Alert([
                html.I(className="fas fa-exclamation-triangle me-2"),
                f"⚠️ Error: {str(e)}"
            ], color="danger", className="mt-3", style={"borderRadius": "15px"})
            return current_data_json, error_status
    
    # Update header metrics
    @app.callback(
        [Output("header-patient-count", "children"),
         Output("header-avg-kai", "children"),
         Output("header-avg-ea", "children"),
         Output("header-total-roi", "children")],
        [Input("atlas-dataset", "data")]
    )
    def update_header_metrics(dataset_json):
        if not dataset_json:
            return "0", "--", "--", "$0"
        
        try:
            df = pd.read_json(dataset_json, orient="split")
            if df.empty:
                return "0", "--", "--", "$0"
            
            count = f"{len(df):,}"
            avg_kai = f"{df['kai_score'].mean():.3f}"
            avg_ea = f"{df['effective_adherence'].mean():.3f}"
            total_roi = f"${df['net_savings'].sum()/1000:.0f}K"
            
            return count, avg_kai, avg_ea, total_roi
        except:
            return "0", "--", "--", "$0"
    
    # Update filter count
    @app.callback(
        Output("filter-count", "children"),
        [Input("atlas-dataset", "data"),
         Input("region-filter", "value"),
         Input("risk-filter", "value")]
    )
    def update_filter_count(dataset_json, region_filter, risk_filter):
        if not dataset_json:
            return "0 patients"
        
        try:
            df = pd.read_json(dataset_json, orient="split")
            if df.empty:
                return "0 patients"
            
            if region_filter and region_filter != "all":
                df = df[df['region'] == region_filter]
            
            if risk_filter and risk_filter != "all":
                df = df[df['kai_level'] == risk_filter]
            
            return f"{len(df):,} patients"
        except:
            return "0 patients"
    
    # Main content router
    @app.callback(
        Output("main-content", "children"),
        [Input("main-tabs", "active_tab"),
         Input("atlas-dataset", "data"),
         Input("region-filter", "value"),
         Input("risk-filter", "value")]
    )
    def update_main_content(active_tab, dataset_json, region_filter, risk_filter):
        if not dataset_json:
            return create_empty_state()
        
        try:
            df = pd.read_json(dataset_json, orient="split")
            
            if df.empty:
                return create_empty_state()
            
            # Apply filters
            if region_filter and region_filter != "all":
                df = df[df['region'] == region_filter]
            
            if risk_filter and risk_filter != "all":
                df = df[df['kai_level'] == risk_filter]
            
            if active_tab == "map":
                return create_map_tab(df)
            elif active_tab == "cube":
                return create_cube_tab_content(df)
            elif active_tab == "analysis":
                return create_analysis_tab(df)
            elif active_tab == "iope":
                return create_iope_tab(df)
            else:  # assessment
                return create_assessment_interface()
                
        except Exception as e:
            return dbc.Alert(f"Error: {str(e)}", color="danger", className="m-3")
    
    # Cube journey toggle callback
    @app.callback(
        Output("cube-graph", "figure"),
        [Input("show-journey-toggle", "value"),
         Input("atlas-dataset", "data"),
         Input("region-filter", "value"),
         Input("risk-filter", "value")],
        prevent_initial_call=True
    )
    def update_cube_with_journey(show_values, dataset_json, region_filter, risk_filter):
        if not dataset_json:
            return ATLASMapVisualization.create_3d_kai_cube(pd.DataFrame(), show_journey=False)
        
        try:
            df = pd.read_json(dataset_json, orient="split")
            
            if df.empty:
                return ATLASMapVisualization.create_3d_kai_cube(pd.DataFrame(), show_journey=False)
            
            # Apply filters
            if region_filter and region_filter != "all":
                df = df[df['region'] == region_filter]
            
            if risk_filter and risk_filter != "all":
                df = df[df['kai_level'] == risk_filter]
            
            show_journey = "show" in show_values if show_values else False
            
            return ATLASMapVisualization.create_3d_kai_cube(df, show_journey=show_journey)
        except:
            return ATLASMapVisualization.create_3d_kai_cube(pd.DataFrame(), show_journey=False)
    
    # Map click handler
    @app.callback(
        [Output("patient-profile-modal", "is_open"),
         Output("profile-modal-title", "children"),
         Output("profile-modal-body", "children")],
        [Input("map-graph", "clickData")],
        [State("atlas-dataset", "data"),
         State("patient-profile-modal", "is_open")],
        prevent_initial_call=True
    )
    def map_click_handler(clickData, dataset_json, current_is_open):
        if not clickData or not dataset_json:
            raise PreventUpdate
        
        try:
            df = pd.read_json(dataset_json, orient="split")
            
            point = clickData['points'][0]
            if 'customdata' in point:
                patient_id = point['customdata']
            else:
                raise PreventUpdate
            
            patient_data = df[df['patient_id'] == patient_id]
            if patient_data.empty:
                raise PreventUpdate
            
            patient = patient_data.iloc[0]
            
            title = html.Div([
                html.I(className="fas fa-user-md me-2"),
                f"Patient Profile: {patient_id}"
            ])
            
            body = create_patient_profile_card(patient)
            
            return True, title, body
        except:
            raise PreventUpdate
    
    # Live assessment callback - UPDATES AFTER EACH CLICK (EA FIRST, KAI LAST)
    @app.callback(
        [Output("live-ea", "children"),
         Output("live-kai-level", "children"),
         Output("live-base", "children"),
         Output("live-mvmt", "children"),
         Output("live-strata", "children"),
         Output("live-ina", "children"),
         Output("live-kai-score", "children")],
        [Input({'type': 'base-radio', 'index': ALL}, 'value'),
         Input({'type': 'mvmt-radio', 'index': ALL}, 'value'),
         Input({'type': 'strata-radio', 'index': ALL}, 'value')]
    )
    def update_live_kai(base_responses, mvmt_responses, strata_responses):
        # Count valid responses
        base_count = len([r for r in base_responses if r])
        mvmt_count = len([r for r in mvmt_responses if r])
        strata_count = len([r for r in strata_responses if r])
        
        # Calculate partial scores as questions are answered
        base_norm = 0.5
        mvmt_norm = 0.5
        strata_norm = 0.5
        ina_value = 0.0
        
        if base_count > 0:
            base_score_map = {"Yes": 1.0, "Sometimes": 0.5, "No": 0.0}
            base_sum = sum([base_score_map.get(r, 0.5) for r in base_responses if r])
            base_norm = base_sum / base_count if base_count > 0 else 0.5
        
        if mvmt_count > 0:
            mvmt_score_map = {"No": 1.0, "Yes, once": 0.5, "Yes, more than once": 0.0}
            mvmt_sum = sum([mvmt_score_map.get(r, 0.5) for r in mvmt_responses if r])
            mvmt_norm = mvmt_sum / mvmt_count if mvmt_count > 0 else 0.5
            
            # Calculate INA from MVMT responses
            if mvmt_count >= 4:
                ina_value = MVMTAssessment.calculate_ina_component(mvmt_responses)
        
        if strata_count > 0:
            strata_values = [float(r) for r in strata_responses if r]
            strata_norm = sum(strata_values) / strata_count if strata_count > 0 else 0.5
        
        # Always calculate KAI with current values
        kai_score = KAICalculator.calculate_kai(base_norm, mvmt_norm, strata_norm)
        kai_level, _ = KAICalculator.get_kai_interpretation(kai_score)
        
        # Calculate EA
        ea = INACalculator.calculate_effective_adherence(kai_score, ina_value)
        
        # Create status message
        total_answered = base_count + mvmt_count + strata_count
        total_questions = 22
        
        if total_answered == 0:
            status = "Start answering questions..."
        elif total_answered < total_questions:
            status = f"Calculating... ({total_answered}/{total_questions} answered)"
        else:
            status = f"✅ {kai_level}"
        
        return (
            f"{ea:.4f}",  # EA FIRST - PROMINENT
            status,
            f"{base_norm:.3f}" if base_count > 0 else "--",
            f"{mvmt_norm:.3f}" if mvmt_count > 0 else "--",
            f"{strata_norm:.3f}" if strata_count > 0 else "--",
            f"{ina_value:.3f}",
            f"{kai_score:.4f}"  # KAI LAST - AT BOTTOM
        )

print("✅ All callbacks registered")

# ============================================================================
# MAIN APPLICATION ENTRY POINT
# ============================================================================

app = create_atlas_app()
server = app.server

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8050))
    print("="*80)
    print(f"🎬 STARTING {APP_TITLE}")
    print(f"🎞️  {VERSION}")
    print("="*80)
    print("🔬 CORRECTED FORMULA:")
    print("   KAI = (BASE × MVMT × STRATA³)^(1/5)")
    print("   EA = KAI × (1 - INA)")
    print("="*80)
    print(f"🗺️  Map: Using {'Mapbox Dark' if USE_MAPBOX else 'OpenStreetMap'}")
    print(f"🌐 Server starting on port {port}...")
    print(f"🔗 Access at: http://localhost:{port}")
    print("="*80)
    print("🎉 FULL FEATURES LOADED:")
    print("   ✅ 22 Full Questions (7 BASE + 7 MVMT + 8 STRATA)")
    print("   ✅ Real-time KAI (updates after EACH click)")
    print("   ✅ Stunning Map (OpenStreetMap fallback)")
    print("   ✅ 3D Cube with Prediction Surfaces")
    print("   ✅ IOPE Dashboard")
    print("   ✅ Adherence Loom™")
    print("   ✅ Bag of Nuts 🥜")
    print("="*80)
    app.run(host="0.0.0.0", port=port, debug=False)

print("="*80)
print("📦 PART 3/3 COMPLETE - Main App & Callbacks")
print("="*80)
print("🎊 ALL THREE PARTS READY!")
print("="*80)
print("📝 TO ASSEMBLE:")
print("   cat atlas_part1.py atlas_part2.py atlas_part3.py > ATLASA.py")
print("   python ATLASA.py")
print("="*80)
