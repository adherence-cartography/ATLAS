# atlas_kybos_enhancement.py
# Complete KYBOS Clinical Intelligence Module
# Deploy this alongside ATLAS1.py for full functionality

import numpy as np
from enum import Enum
from dataclasses import dataclass
from typing import List, Tuple, Dict


# ============================================================================
# KYBOS MATHEMATICAL CORE
# ============================================================================

class KYBOSMathematicalCore:
    """Advanced mathematical foundations for KAI calculation"""
    
    @staticmethod
    def calculate_kai_formal(base: float, mvmt: float, strata: float) -> float:
        """
        Formal KAI calculation using geometric mean with stability weighting
        KAI = (BASE^α × MVMT^β × STRATA^γ)^(1/3)
        where α, β, γ are stability weights
        """
        # Adaptive weighting based on dimension strength
        alpha = 1.0 + (0.1 if base > 0.75 else -0.1 if base < 0.40 else 0)
        beta = 1.0 + (0.1 if mvmt > 0.75 else -0.1 if mvmt < 0.40 else 0)
        gamma = 1.0 + (0.1 if strata > 0.75 else -0.1 if strata < 0.40 else 0)
        
        # Normalize weights
        weight_sum = alpha + beta + gamma
        alpha, beta, gamma = alpha/weight_sum, beta/weight_sum, gamma/weight_sum
        
        # Calculate weighted geometric mean
        product = (base ** alpha) * (mvmt ** beta) * (strata ** gamma)
        kai = product ** (1.0 / 3.0)
        
        return round(kai, 4)
    
    @staticmethod
    def calculate_dimensional_harmony(base: float, mvmt: float, strata: float) -> float:
        """
        Measure alignment across dimensions (0 = perfect harmony, 1 = maximum discord)
        """
        mean_val = (base + mvmt + strata) / 3.0
        variance = ((base - mean_val)**2 + (mvmt - mean_val)**2 + (strata - mean_val)**2) / 3.0
        harmony = 1.0 - min(variance * 3.0, 1.0)  # Scale to 0-1
        return round(harmony, 3)


# ============================================================================
# CLINICAL ARCHETYPE SYSTEM
# ============================================================================

class ClinicalArchetype(Enum):
    """12 evidence-based clinical archetypes"""
    RESILIENT_ADHERENT = "resilient_adherent"
    STABLE_ADHERENT = "stable_adherent"
    FRAGILE_ADHERENT = "fragile_adherent"
    CAPABLE_BUT_UNSUPPORTED = "capable_but_unsupported"
    INCONSISTENT_EXECUTOR = "inconsistent_executor"
    INTENTIONAL_MODIFIER = "intentional_modifier"
    STRUCTURAL_CHALLENGER = "structural_challenger"
    ENVIRONMENTAL_STRUGGLER = "environmental_struggler"
    BEHAVIORAL_DISORGANIZED = "behavioral_disorganized"
    MULTI_BARRIER_PATIENT = "multi_barrier_patient"
    CHAOTIC_NON_ADHERENT = "chaotic_non_adherent"
    ISOLATED_VULNERABLE = "isolated_vulnerable"


@dataclass
class ArchetypeProfile:
    """Complete clinical archetype profile"""
    archetype: ClinicalArchetype
    display_name: str
    clinical_focus: str
    monitoring_cadence: str
    interventions: List[str]
    philosophical_insight: str
    risk_level: str


class KYBOSArchetypeLibrary:
    """Complete library of 12 clinical archetypes with classification logic"""
    
    PROFILES = {
        ClinicalArchetype.RESILIENT_ADHERENT: ArchetypeProfile(
            archetype=ClinicalArchetype.RESILIENT_ADHERENT,
            display_name="Resilient Adherent",
            clinical_focus="Excellence maintenance through periodic monitoring",
            monitoring_cadence="Quarterly",
            interventions=[
                "Annual comprehensive review",
                "Peer mentorship opportunities",
                "Advanced self-management tools"
            ],
            philosophical_insight="These patients demonstrate mastery across all dimensions. They are candidates for reduced clinical burden and peer leadership roles.",
            risk_level="LOW"
        ),
        
        ClinicalArchetype.STABLE_ADHERENT: ArchetypeProfile(
            archetype=ClinicalArchetype.STABLE_ADHERENT,
            display_name="Stable Adherent",
            clinical_focus="Sustain good practices, address minor gaps",
            monitoring_cadence="Monthly",
            interventions=[
                "Routine check-ins",
                "Preventive education",
                "Reinforcement of successful strategies"
            ],
            philosophical_insight="Solid foundation with room for optimization. Focus on preventing regression rather than intensive intervention.",
            risk_level="LOW"
        ),
        
        ClinicalArchetype.FRAGILE_ADHERENT: ArchetypeProfile(
            archetype=ClinicalArchetype.FRAGILE_ADHERENT,
            display_name="Fragile Adherent",
            clinical_focus="Strengthen contextual support systems",
            monitoring_cadence="Bi-weekly",
            interventions=[
                "Social support enhancement",
                "Resource connection",
                "Resilience building"
            ],
            philosophical_insight="Strong internal capability but vulnerable to external shocks. Support system fortification is key to stability.",
            risk_level="MODERATE"
        ),
        
        ClinicalArchetype.CAPABLE_BUT_UNSUPPORTED: ArchetypeProfile(
            archetype=ClinicalArchetype.CAPABLE_BUT_UNSUPPORTED,
            display_name="Capable but Unsupported",
            clinical_focus="Bridge resource gaps, enhance access",
            monitoring_cadence="Bi-weekly",
            interventions=[
                "Transportation assistance",
                "Financial counseling",
                "Community resource navigation"
            ],
            philosophical_insight="High personal capacity undermined by structural barriers. Environmental modification yields rapid improvement.",
            risk_level="MODERATE"
        ),
        
        ClinicalArchetype.INCONSISTENT_EXECUTOR: ArchetypeProfile(
            archetype=ClinicalArchetype.INCONSISTENT_EXECUTOR,
            display_name="Inconsistent Executor",
            clinical_focus="Build routine consistency and execution reliability",
            monitoring_cadence="Weekly",
            interventions=[
                "Habit formation coaching",
                "Reminder system optimization",
                "Routine architecture redesign"
            ],
            philosophical_insight="Understands the plan but struggles with daily execution. Behavioral scaffolding creates breakthrough.",
            risk_level="MODERATE"
        ),
        
        ClinicalArchetype.INTENTIONAL_MODIFIER: ArchetypeProfile(
            archetype=ClinicalArchetype.INTENTIONAL_MODIFIER,
            display_name="Intentional Modifier",
            clinical_focus="Address treatment concerns and misconceptions",
            monitoring_cadence="Weekly",
            interventions=[
                "Motivational interviewing",
                "Shared decision-making",
                "Side effect management",
                "Treatment belief exploration"
            ],
            philosophical_insight="Volitional non-adherence signals unaddressed concerns. Deep listening reveals modifiable treatment barriers.",
            risk_level="MODERATE-HIGH"
        ),
        
        ClinicalArchetype.STRUCTURAL_CHALLENGER: ArchetypeProfile(
            archetype=ClinicalArchetype.STRUCTURAL_CHALLENGER,
            display_name="Structural Challenger",
            clinical_focus="Overcome systemic and logistical barriers",
            monitoring_cadence="Weekly",
            interventions=[
                "Case management",
                "System navigation support",
                "Advocacy services"
            ],
            philosophical_insight="Personal capability exists but systemic barriers dominate. Requires care coordination rather than patient education.",
            risk_level="HIGH"
        ),
        
        ClinicalArchetype.ENVIRONMENTAL_STRUGGLER: ArchetypeProfile(
            archetype=ClinicalArchetype.ENVIRONMENTAL_STRUGGLER,
            display_name="Environmental Struggler",
            clinical_focus="Comprehensive contextual support enhancement",
            monitoring_cadence="Weekly",
            interventions=[
                "Social work consultation",
                "Home health services",
                "Community health worker engagement"
            ],
            philosophical_insight="Severe isolation creates adherence impossibility. Multi-modal support is prerequisite to behavior change.",
            risk_level="HIGH"
        ),
        
        ClinicalArchetype.BEHAVIORAL_DISORGANIZED: ArchetypeProfile(
            archetype=ClinicalArchetype.BEHAVIORAL_DISORGANIZED,
            display_name="Behavioral Disorganized",
            clinical_focus="Foundational behavioral architecture rebuilding",
            monitoring_cadence="Bi-weekly",
            interventions=[
                "Cognitive behavioral therapy",
                "Organizational skill building",
                "Memory compensation strategies"
            ],
            philosophical_insight="Cognitive or organizational deficits undermine adherence. Requires therapeutic intervention before standard care.",
            risk_level="HIGH"
        ),
        
        ClinicalArchetype.MULTI_BARRIER_PATIENT: ArchetypeProfile(
            archetype=ClinicalArchetype.MULTI_BARRIER_PATIENT,
            display_name="Multi-Barrier Patient",
            clinical_focus="Coordinated multi-dimensional intervention",
            monitoring_cadence="Weekly",
            interventions=[
                "Intensive case management",
                "Interdisciplinary team approach",
                "Crisis prevention planning"
            ],
            philosophical_insight="Multiple simultaneous deficits require orchestrated response. Prioritize highest-impact intervention first.",
            risk_level="CRITICAL"
        ),
        
        ClinicalArchetype.CHAOTIC_NON_ADHERENT: ArchetypeProfile(
            archetype=ClinicalArchetype.CHAOTIC_NON_ADHERENT,
            display_name="Chaotic Non-Adherent",
            clinical_focus="Crisis stabilization and immediate intervention",
            monitoring_cadence="Daily",
            interventions=[
                "Urgent care coordination",
                "Supervised medication administration",
                "Emergency support activation"
            ],
            philosophical_insight="System failure across dimensions. Requires immediate intervention to prevent adverse events.",
            risk_level="CRITICAL"
        ),
        
        ClinicalArchetype.ISOLATED_VULNERABLE: ArchetypeProfile(
            archetype=ClinicalArchetype.ISOLATED_VULNERABLE,
            display_name="Isolated Vulnerable",
            clinical_focus="Emergency social support establishment",
            monitoring_cadence="Daily",
            interventions=[
                "Adult protective services referral",
                "Emergency social support",
                "Housing assistance"
            ],
            philosophical_insight="Social isolation creates life-threatening vulnerability. Social infrastructure is medical necessity.",
            risk_level="CRITICAL"
        )
    }
    
    @classmethod
    def classify_patient(cls, base: float, mvmt: float, strata: float, ina: float) -> Tuple[ClinicalArchetype, ArchetypeProfile, float]:
        """
        Classify patient into clinical archetype with confidence score
        Returns: (archetype_enum, profile, confidence)
        """
        
        # Rule-based classification with confidence scoring
        
        # TIER 1: CRITICAL ARCHETYPES
        if base < 0.40 and mvmt < 0.40 and strata < 0.40:
            return (ClinicalArchetype.CHAOTIC_NON_ADHERENT, 
                   cls.PROFILES[ClinicalArchetype.CHAOTIC_NON_ADHERENT], 0.95)
        
        if strata < 0.30 and (base < 0.50 or mvmt < 0.50):
            return (ClinicalArchetype.ISOLATED_VULNERABLE,
                   cls.PROFILES[ClinicalArchetype.ISOLATED_VULNERABLE], 0.90)
        
        if base < 0.45 and mvmt < 0.45 and strata < 0.60:
            return (ClinicalArchetype.MULTI_BARRIER_PATIENT,
                   cls.PROFILES[ClinicalArchetype.MULTI_BARRIER_PATIENT], 0.88)
        
        # TIER 2: HIGH-RISK ARCHETYPES
        if ina >= 0.30:
            return (ClinicalArchetype.INTENTIONAL_MODIFIER,
                   cls.PROFILES[ClinicalArchetype.INTENTIONAL_MODIFIER], 0.85)
        
        if strata < 0.40 and base >= 0.50 and mvmt >= 0.50:
            return (ClinicalArchetype.ENVIRONMENTAL_STRUGGLER,
                   cls.PROFILES[ClinicalArchetype.ENVIRONMENTAL_STRUGGLER], 0.82)
        
        if base < 0.45 and strata >= 0.60:
            return (ClinicalArchetype.BEHAVIORAL_DISORGANIZED,
                   cls.PROFILES[ClinicalArchetype.BEHAVIORAL_DISORGANIZED], 0.80)
        
        if strata < 0.50 and (base >= 0.50 or mvmt >= 0.50):
            return (ClinicalArchetype.STRUCTURAL_CHALLENGER,
                   cls.PROFILES[ClinicalArchetype.STRUCTURAL_CHALLENGER], 0.78)
        
        # TIER 3: MODERATE-RISK ARCHETYPES
        if mvmt < 0.60 and base >= 0.60 and strata >= 0.55:
            return (ClinicalArchetype.INCONSISTENT_EXECUTOR,
                   cls.PROFILES[ClinicalArchetype.INCONSISTENT_EXECUTOR], 0.75)
        
        if base >= 0.70 and mvmt >= 0.65 and strata < 0.60:
            return (ClinicalArchetype.FRAGILE_ADHERENT,
                   cls.PROFILES[ClinicalArchetype.FRAGILE_ADHERENT], 0.72)
        
        if base >= 0.65 and mvmt >= 0.65 and strata < 0.55:
            return (ClinicalArchetype.CAPABLE_BUT_UNSUPPORTED,
                   cls.PROFILES[ClinicalArchetype.CAPABLE_BUT_UNSUPPORTED], 0.70)
        
        # TIER 4: LOW-RISK ARCHETYPES
        if base >= 0.80 and mvmt >= 0.75 and strata >= 0.70:
            return (ClinicalArchetype.RESILIENT_ADHERENT,
                   cls.PROFILES[ClinicalArchetype.RESILIENT_ADHERENT], 0.92)
        
        if base >= 0.70 and mvmt >= 0.65 and strata >= 0.60:
            return (ClinicalArchetype.STABLE_ADHERENT,
                   cls.PROFILES[ClinicalArchetype.STABLE_ADHERENT], 0.85)
        
        # DEFAULT: STABLE ADHERENT (with lower confidence)
        return (ClinicalArchetype.STABLE_ADHERENT,
               cls.PROFILES[ClinicalArchetype.STABLE_ADHERENT], 0.60)


# ============================================================================
# INTERPRETIVE COMPASS SYSTEM
# ============================================================================

class InterpretiveCompass:
    """3x3 compass grid for dimensional positioning"""
    
    @staticmethod
    def calculate_composite_stability(base: float, mvmt: float, strata: float) -> Tuple[float, float]:
        """
        Calculate internal (BASE+MVMT) and external (STRATA) stability
        Returns: (internal_stability, external_stability)
        """
        internal = (base + mvmt) / 2.0
        external = strata
        return round(internal, 3), round(external, 3)
    
    @staticmethod
    def get_compass_position(base: float, mvmt: float, strata: float) -> Tuple[str, str, str]:
        """
        Map patient to 3x3 compass grid
        Returns: (internal_band, external_band, compass_cell)
        """
        internal, external = InterpretiveCompass.calculate_composite_stability(base, mvmt, strata)
        
        # Band classification
        if internal >= 0.70:
            internal_band = "Strong"
        elif internal >= 0.50:
            internal_band = "Moderate"
        else:
            internal_band = "Weak"
        
        if external >= 0.70:
            external_band = "Strong"
        elif external >= 0.50:
            external_band = "Moderate"
        else:
            external_band = "Weak"
        
        # Compass cell
        compass_cell = f"{internal_band}-Internal / {external_band}-External"
        
        return internal_band, external_band, compass_cell


# ============================================================================
# CLINICAL INTERVENTION MAPPER
# ============================================================================

class ClinicalInterventionMapper:
    """Map archetypes to specific intervention strategies"""
    
    @staticmethod
    def get_intervention_strategy(archetype: ClinicalArchetype, ina: float, kai: float) -> Dict:
        """
        Generate comprehensive intervention strategy
        Returns: dict with urgency, interventions, timeline
        """
        profile = KYBOSArchetypeLibrary.PROFILES[archetype]
        
        # Calculate urgency multiplier
        urgency_multiplier = 1.0
        if ina >= 0.30:
            urgency_multiplier *= 1.3
        if kai < 0.40:
            urgency_multiplier *= 1.5
        
        # Determine urgency level
        base_urgency = profile.risk_level
        if urgency_multiplier >= 1.5:
            urgency = "CRITICAL"
        elif urgency_multiplier >= 1.2:
            urgency = "HIGH"
        elif base_urgency == "MODERATE":
            urgency = "MODERATE"
        else:
            urgency = "LOW"
        
        return {
            'urgency': urgency,
            'primary_interventions': profile.interventions,
            'monitoring_cadence': profile.monitoring_cadence,
            'clinical_focus': profile.clinical_focus,
            'philosophical_context': profile.philosophical_insight,
            'estimated_timeline': cls._estimate_improvement_timeline(kai, ina),
            'success_indicators': cls._define_success_metrics(archetype)
        }
    
    @staticmethod
    def _estimate_improvement_timeline(kai: float, ina: float) -> str:
        """Estimate realistic improvement timeline"""
        if kai >= 0.70:
            return "3-6 months for optimization"
        elif kai >= 0.55:
            return "6-12 months for significant improvement"
        elif kai >= 0.40:
            return "12-18 months for stabilization"
        else:
            return "18-24 months for foundational change"
    
    @staticmethod
    def _define_success_metrics(archetype: ClinicalArchetype) -> List[str]:
        """Define archetype-specific success indicators"""
        metrics_map = {
            ClinicalArchetype.RESILIENT_ADHERENT: [
                "Maintained KAI ≥ 0.85 for 6 months",
                "Zero adverse events",
                "Continued self-management mastery"
            ],
            ClinicalArchetype.INCONSISTENT_EXECUTOR: [
                "MVMT score improves by 0.20",
                "Missed doses <2 per month",
                "Established sustainable routine"
            ],
            ClinicalArchetype.INTENTIONAL_MODIFIER: [
                "INA reduces below 0.15",
                "Treatment concerns addressed",
                "Shared decision-making plan in place"
            ],
            ClinicalArchetype.CHAOTIC_NON_ADHERENT: [
                "KAI improves above 0.40",
                "Crisis events prevented",
                "Basic stability achieved"
            ]
        }
        
        return metrics_map.get(archetype, [
            "KAI improvement by 0.15+",
            "Reduced hospitalization risk",
            "Enhanced quality of life"
        ])


# ============================================================================
# ENHANCED INA CALCULATOR
# ============================================================================

class INACalculatorEnhanced:
    """Enhanced Intentional Non-Adherence analysis"""
    
    @staticmethod
    def decompose_ina(ina_value: float, mvmt_responses: List[str]) -> Dict:
        """
        Decompose INA into symptom-based vs side-effect-based components
        """
        if len(mvmt_responses) < 7:
            return {'symptom_component': 0.0, 'sideeffect_component': 0.0}
        
        # Q3 is symptom-based (feeling better)
        # Q4 is side-effect-based
        symptom_score = 0.0
        if mvmt_responses[2] == "Yes, more than once":
            symptom_score = 0.25
        elif mvmt_responses[2] == "Yes, once":
            symptom_score = 0.125
        
        sideeffect_score = 0.0
        if mvmt_responses[3] == "Yes, more than once":
            sideeffect_score = 0.25
        elif mvmt_responses[3] == "Yes, once":
            sideeffect_score = 0.125
        
        return {
            'symptom_component': round(symptom_score, 3),
            'sideeffect_component': round(sideeffect_score, 3),
            'total_ina': round(symptom_score + sideeffect_score, 3)
        }