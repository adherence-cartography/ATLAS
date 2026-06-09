"""ATLAS Global Map - Brighter colors, proper zoom"""
import plotly.graph_objects as go
from config import PE_COLORS

def create_atlas_map(df, selected_patient=None):
    if df is None or len(df) == 0:
        fig = go.Figure()
        fig.add_annotation(
            x=0.5, y=0.5, xref="paper", yref="paper",
            text="Click 'Add 1,000 Patients' to populate the map",
            font=dict(size=20, color="white"),
            showarrow=False
        )
        fig.update_layout(
            height=600, 
            paper_bgcolor='rgba(15,23,42,1)',
            plot_bgcolor='rgba(15,23,42,1)',
            xaxis=dict(visible=False),
            yaxis=dict(visible=False)
        )
        return fig
    
    df_map = df.sample(n=min(3000, len(df)), random_state=42).copy() if len(df) > 3000 else df.copy()
    fig = go.Figure()
    
    # Brighter colors for better visibility
    bright_colors = {
        "Stability": "#22c55e",  # Bright green
        "Transition": "#fbbf24",  # Bright amber
        "Fragility": "#f87171",  # Bright red
        "Critical": "#dc2626"    # Vivid red
    }
    
    for pe_level in bright_colors.keys():
        level_data = df_map[df_map['pe_level'] == pe_level]
        if len(level_data) == 0: continue
        
        hover = level_data.apply(lambda r: 
            f"<b>{r['patient_id']}</b><br>"
            f"📍 {r['city']}, {r['country']}<br>"
            f"<b>PE: {r['pe_score']:.3f}</b><br>"
            f"BASE: {r['base_norm']:.2f} | MVMT: {r['mvmt_norm']:.2f} | STRATA: {r['strata_norm']:.2f}", axis=1)
        
        fig.add_trace(go.Scattermapbox(
            lat=level_data['latitude'], 
            lon=level_data['longitude'], 
            mode='markers',
            marker=dict(size=12, color=bright_colors[pe_level], opacity=0.9),
            text=hover, 
            hovertemplate='%{text}<extra></extra>',
            name=f"{pe_level} ({len(level_data)})", 
            customdata=level_data['patient_id'].values
        ))
    
    # Highlight selected patient
    if selected_patient and selected_patient in df_map['patient_id'].values:
        sel = df_map[df_map['patient_id'] == selected_patient].iloc[0]
        fig.add_trace(go.Scattermapbox(
            lat=[sel['latitude']], lon=[sel['longitude']], 
            mode='markers',
            marker=dict(size=25, color='#fef08a', symbol='circle', 
                       line=dict(width=3, color='white')),
            name=f'Selected: {selected_patient}', 
            hoverinfo='skip'
        ))
    
    fig.update_layout(
        mapbox=dict(
            center=dict(lat=25, lon=0), 
            zoom=1.5, 
            style="carto-positron"  # Brighter map style
        ),
        height=600, 
        margin=dict(l=0, r=0, t=0, b=0),
        legend=dict(
            yanchor="top", y=0.98, 
            xanchor="left", x=0.02,
            bgcolor="rgba(255,255,255,0.9)", 
            font=dict(color='black', size=12),
            bordercolor="rgba(0,0,0,0.3)",
            borderwidth=1
        ),
        paper_bgcolor='rgba(0,0,0,0)', 
        hovermode='closest'
    )
    return fig
