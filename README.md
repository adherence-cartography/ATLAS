<<<<<<< HEAD
# ATLAS v8.0 Enterprise

**Adherence Tools and Location Analytics System**

## Quick Start

```bash
pip install -r requirements.txt
python app.py
# Open http://localhost:8050
```

## Features

- **🗺️ Global Map** - Interactive patient distribution with click-to-select
- **🎲 KYBOS Cube** - 3D state-space visualization (1D/2D/3D modes)
- **🧵 Adherence LOOM** - Parallel coordinates with draggable vertical sliders
- **📋 Assessment** - PEACS v2.0 (22 items) and MMAS-8 with IP location detection

## LOOM Visualization

The LOOM uses parallel coordinates where:
- Each vertical axis represents a dimension (BASE, MVMT, STRATA, PE, INA, PEₐ)
- Lines connecting axes show individual patient journeys
- Drag ranges on any axis to filter patients
- Colors indicate PE level (red=critical, green=optimal)

## Auto-Population

When you complete either PEACS or MMAS-8 assessment:
1. Your location is detected via IP
2. Results are calculated
3. Patient is automatically added to the map at your location

© 2026 Adherence Inc.
=======
# ATLAS: Adherence Tools and Location Analytics System

**Version:** 7.0 Enterprise – Adherence Cartography Edition  
**Tech Stack:** Dash + Plotly + Pandas + NumPy + Scikit-Learn  

This dashboard visualizes global adherence cartography across BASE, MVMT, STRATA, and KAI frameworks with INA overlays, predictive analytics, and geospatial mapping.

### 🚀 Run Locally

```bash
pip install -r requirements.txt
python atlas1.py
>>>>>>> 9547eaa32d240c4549a5698e4795c55fae372ea3
