"""PE Calculations - NO INA, just pure geometric mean"""

class PECalculator:
    @staticmethod
    def calculate_pe(base, mvmt, strata):
        """PE = (BASE × MVMT × STRATA)^(1/3)"""
        if base <= 0 or mvmt <= 0 or strata <= 0:
            return 0.0
        return round((base * mvmt * strata) ** (1/3), 4)
    
    @staticmethod
    def get_pe_level(pe):
        if pe >= 0.70: return ("Stability", "Maintenance protocols", "#10b981")
        elif pe >= 0.50: return ("Transition", "Active intervention", "#f59e0b")
        elif pe >= 0.34: return ("Fragility", "Intensive support", "#ef4444")
        else: return ("Critical", "Immediate intervention", "#7f1d1d")
    
    @staticmethod
    def get_zone(pe):
        if pe >= 0.70: return "stability"
        elif pe >= 0.50: return "transition"
        elif pe >= 0.34: return "fragility"
        else: return "critical"
    
    @staticmethod
    def get_weakest_axis(base, mvmt, strata):
        dims = [("BASE", base, "Behavioral Architecture", "info"),
                ("MVMT", mvmt, "Execution Consistency", "success"),
                ("STRATA", strata, "Support & Context", "warning")]
        return min(dims, key=lambda x: x[1])
    
    @staticmethod
    def get_intervention(weakest_axis):
        interventions = {
            "BASE": "Focus on building routines, habit formation, and behavioral cues",
            "MVMT": "Address timing consistency, dose completion, and daily integration",
            "STRATA": "Strengthen support network, access to care, and environmental factors"
        }
        return interventions.get(weakest_axis, "Comprehensive assessment needed")
