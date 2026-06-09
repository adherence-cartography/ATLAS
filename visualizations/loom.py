"""LOOM: Demonstrates weakest link principle and near-zero collapse - NO INA"""
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots

def create_loom_sewing_machine(base_val=0.70, mvmt_val=0.70, strata_val=0.70):
    """
    LOOM Sewing Machine: Shows how weakest thread limits fabric strength.
    NO INA involved - pure PE = (B × M × S)^(1/3)
    """
    # Ensure minimum values to prevent division issues
    base_val = max(0.01, base_val)
    mvmt_val = max(0.01, mvmt_val)
    strata_val = max(0.01, strata_val)
    
    pe = (base_val * mvmt_val * strata_val) ** (1/3)
    
    threads = [('BASE', base_val, '#3b82f6'), ('MVMT', mvmt_val, '#8b5cf6'), ('STRATA', strata_val, '#10b981')]
    weakest = min(threads, key=lambda x: x[1])
    
    # Check for collapse condition
    is_collapsed = weakest[1] < 0.15
    is_near_collapse = weakest[1] < 0.30
    
    fig = go.Figure()
    
    x_points = np.linspace(0, 12, 150)
    
    # THREAD VISUALIZATION
    # Thread thickness and waviness based on value
    # Near-zero values = very thin, very wavy (broken/fraying)
    
    def get_thread_params(val):
        width = max(1, val * 8)  # 0.01 -> 0.08, 1.0 -> 8
        amplitude = 0.5 * (1 - val) + 0.1  # Low value = high amplitude (unstable)
        decay = 0.03 + (1 - val) * 0.07  # Low value = faster decay (thread breaks)
        return width, amplitude, decay
    
    # BASE thread
    w, amp, dec = get_thread_params(base_val)
    base_y = 3.5 + amp * np.sin(x_points * 3) * np.exp(-dec * x_points)
    fig.add_trace(go.Scatter(
        x=x_points, y=base_y, mode='lines',
        line=dict(color='#3b82f6', width=w, dash='solid' if base_val > 0.3 else 'dot'),
        name=f'BASE: {base_val:.2f}'
    ))
    
    # MVMT thread
    w, amp, dec = get_thread_params(mvmt_val)
    mvmt_y = 2.3 + amp * np.sin(x_points * 3 + np.pi/2) * np.exp(-dec * x_points)
    fig.add_trace(go.Scatter(
        x=x_points, y=mvmt_y, mode='lines',
        line=dict(color='#8b5cf6', width=w, dash='solid' if mvmt_val > 0.3 else 'dot'),
        name=f'MVMT: {mvmt_val:.2f}'
    ))
    
    # STRATA thread
    w, amp, dec = get_thread_params(strata_val)
    strata_y = 1.1 + amp * np.sin(x_points * 3 + np.pi) * np.exp(-dec * x_points)
    fig.add_trace(go.Scatter(
        x=x_points, y=strata_y, mode='lines',
        line=dict(color='#10b981', width=w, dash='solid' if strata_val > 0.3 else 'dot'),
        name=f'STRATA: {strata_val:.2f}'
    ))
    
    # FABRIC OUTPUT (right side)
    if is_collapsed:
        # Collapsed - broken fabric
        fig.add_annotation(
            x=11, y=2, text="⚠️ FABRIC<br>COLLAPSED",
            font=dict(size=16, color='#ef4444', family='Arial Black'),
            showarrow=False, bgcolor='rgba(127,29,29,0.8)', borderpad=10
        )
    else:
        # Fabric density based on PE
        fabric_color = '#10b981' if pe >= 0.7 else '#f59e0b' if pe >= 0.5 else '#ef4444'
        density = int(pe * 15) + 3
        for i in range(density):
            y_pos = 0.5 + (i / density) * 3.5
            opacity = 0.4 + pe * 0.5
            fig.add_trace(go.Scatter(
                x=[10, 12.5], y=[y_pos, y_pos], mode='lines',
                line=dict(color=fabric_color, width=2 + pe * 2),
                opacity=opacity, showlegend=False, hoverinfo='skip'
            ))
    
    # Machine frame
    fig.add_shape(type="rect", x0=-0.5, y0=-0.5, x1=12.5, y1=4.8,
                  line=dict(color="rgba(255,255,255,0.3)", width=2),
                  fillcolor="rgba(30,30,50,0.3)")
    
    # Needle
    fig.add_trace(go.Scatter(
        x=[9.5, 9.5], y=[5, 0.3], mode='lines',
        line=dict(color='silver', width=4), showlegend=False, hoverinfo='skip'
    ))
    fig.add_trace(go.Scatter(
        x=[9.5], y=[0.5], mode='markers',
        marker=dict(size=18, symbol='triangle-down', color='silver'),
        showlegend=False, hoverinfo='skip'
    ))
    
    # PE DISPLAY
    pe_color = '#10b981' if pe >= 0.7 else '#f59e0b' if pe >= 0.5 else '#ef4444'
    if is_collapsed:
        pe_color = '#7f1d1d'
    
    fig.add_annotation(
        x=6, y=5.8, 
        text=f"<b>FABRIC STRENGTH (PE): {pe:.4f}</b>",
        font=dict(size=22, color=pe_color),
        showarrow=False, bgcolor='rgba(0,0,0,0.8)', borderpad=12
    )
    
    # Zone indicator
    if pe >= 0.70:
        zone_text = "✅ STABILITY ZONE"
        zone_color = "#10b981"
    elif pe >= 0.50:
        zone_text = "⚠️ TRANSITION ZONE"
        zone_color = "#f59e0b"
    elif pe >= 0.34:
        zone_text = "⛔ FRAGILITY ZONE"
        zone_color = "#ef4444"
    else:
        zone_text = "🚨 CRITICAL - COLLAPSE IMMINENT"
        zone_color = "#7f1d1d"
    
    fig.add_annotation(
        x=6, y=-1.5, text=zone_text,
        font=dict(size=16, color=zone_color, family='Arial Black'),
        showarrow=False, bgcolor='rgba(0,0,0,0.7)', borderpad=8
    )
    
    # WEAKEST LINK WARNING
    fig.add_annotation(
        x=6, y=-2.5,
        text=f"🔗 WEAKEST: {weakest[0]} = {weakest[1]:.2f} {'(CRITICAL!)' if weakest[1] < 0.3 else ''}",
        font=dict(size=14, color=weakest[2] if weakest[1] > 0.3 else '#ef4444'),
        showarrow=False, bgcolor='rgba(0,0,0,0.6)', borderpad=6
    )
    
    # INTERVENTION TARGET
    interventions = {
        'BASE': 'Build routines & habits',
        'MVMT': 'Improve timing & consistency',
        'STRATA': 'Strengthen support network'
    }
    fig.add_annotation(
        x=6, y=-3.3,
        text=f"🎯 TARGET: {interventions[weakest[0]]}",
        font=dict(size=12, color='white'),
        showarrow=False, bgcolor='rgba(0,0,0,0.5)', borderpad=4
    )
    
    fig.update_layout(
        title={'text': '🧵 LOOM: Adherence Fabric Weaver', 'x': 0.5, 
               'font': {'size': 24, 'color': 'white'}},
        height=550,
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(15,23,42,0.95)',
        font={'color': 'white'},
        showlegend=True,
        legend=dict(yanchor="top", y=0.98, xanchor="left", x=0.01, 
                   bgcolor="rgba(0,0,0,0.7)", font=dict(size=11)),
        xaxis=dict(showgrid=False, showticklabels=False, range=[-1, 13]),
        yaxis=dict(showgrid=False, showticklabels=False, range=[-4, 6.5])
    )
    
    return fig


def create_loom_sensitivity(base_val, mvmt_val, strata_val):
    """Show sensitivity - how changing each dimension affects PE"""
    base_val = max(0.01, base_val)
    mvmt_val = max(0.01, mvmt_val)
    strata_val = max(0.01, strata_val)
    
    x_range = np.linspace(0.01, 1.0, 100)
    pe_if_base = [(x * mvmt_val * strata_val) ** (1/3) for x in x_range]
    pe_if_mvmt = [(base_val * x * strata_val) ** (1/3) for x in x_range]
    pe_if_strata = [(base_val * mvmt_val * x) ** (1/3) for x in x_range]
    pe_current = (base_val * mvmt_val * strata_val) ** (1/3)
    
    fig = go.Figure()
    
    # Show collapse zone
    fig.add_vrect(x0=0, x1=0.15, fillcolor="rgba(127,29,29,0.3)", line_width=0,
                  annotation_text="COLLAPSE", annotation_position="top left",
                  annotation_font_color="#ef4444")
    
    # Sensitivity lines
    fig.add_trace(go.Scatter(x=x_range, y=pe_if_base, mode='lines', name='If BASE changes',
                             line=dict(color='#3b82f6', width=3)))
    fig.add_trace(go.Scatter(x=x_range, y=pe_if_mvmt, mode='lines', name='If MVMT changes',
                             line=dict(color='#8b5cf6', width=3)))
    fig.add_trace(go.Scatter(x=x_range, y=pe_if_strata, mode='lines', name='If STRATA changes',
                             line=dict(color='#10b981', width=3)))
    
    # Current position
    fig.add_trace(go.Scatter(x=[base_val, mvmt_val, strata_val], 
                             y=[pe_current, pe_current, pe_current],
                             mode='markers', name='Current',
                             marker=dict(size=12, color='gold', symbol='diamond')))
    
    # Thresholds
    fig.add_hline(y=0.70, line_dash="dash", line_color="#10b981", 
                  annotation_text="Stability (0.70)")
    fig.add_hline(y=0.34, line_dash="dash", line_color="#ef4444",
                  annotation_text="Fragility (0.34)")
    
    fig.update_layout(
        title={'text': '📈 Sensitivity: Impact of Each Dimension', 'x': 0.5, 
               'font': {'color': 'white', 'size': 14}},
        xaxis_title='Dimension Value', yaxis_title='Resulting PE',
        height=280, paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(15,23,42,0.9)',
        font={'color': 'white', 'size': 10},
        xaxis=dict(gridcolor='rgba(255,255,255,0.1)', range=[0, 1.05]),
        yaxis=dict(gridcolor='rgba(255,255,255,0.1)', range=[0, 1.05]),
        legend=dict(bgcolor='rgba(0,0,0,0.7)', font=dict(size=9), orientation='h', y=-0.2),
        margin=dict(l=40, r=20, t=50, b=60)
    )
    return fig
