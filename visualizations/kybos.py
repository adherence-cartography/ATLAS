"""KYBOS: Know Your Behavioral Outcome in State-Space - Enhanced with trajectory & zones"""
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from config import PE_COLORS

def create_kybos_cube(df, selected_patient=None, mode='3D', trajectory_data=None):
    """Create KYBOS visualization with stability/fragility zones and optional trajectory"""
    
    if df is None or len(df) == 0:
        fig = go.Figure()
        fig.add_annotation(x=0.5, y=0.5, text="No patients loaded", 
                          font=dict(size=20, color="white"), showarrow=False)
        fig.update_layout(height=600, paper_bgcolor='rgba(0,0,0,0)')
        return fig
    
    if mode == '3D':
        return create_kybos_3d(df, selected_patient, trajectory_data)
    elif mode == '2D':
        return create_kybos_2d(df, selected_patient)
    elif mode == 'QUAD':
        return create_kybos_quadrant(df, selected_patient)
    else:
        return create_kybos_1d(df, selected_patient)


def create_kybos_3d(df, selected_patient=None, trajectory_data=None):
    """Full 3D state-space cube with zones"""
    fig = go.Figure()
    
    # Add stability zone surface (PE = 0.70)
    x_surf = np.linspace(0.3, 1, 15)
    y_surf = np.linspace(0.3, 1, 15)
    X, Y = np.meshgrid(x_surf, y_surf)
    Z = (0.70 ** 3) / (X * Y)  # Solve for Z where PE = 0.70
    Z = np.clip(Z, 0, 1)
    
    fig.add_trace(go.Surface(
        x=X, y=Y, z=Z,
        colorscale=[[0, 'rgba(16,185,129,0.15)'], [1, 'rgba(16,185,129,0.15)']],
        showscale=False, name='Stability Threshold (PE=0.70)',
        hoverinfo='skip', opacity=0.3
    ))
    
    # Add fragility zone floor (PE = 0.34)
    Z_frag = (0.34 ** 3) / (X * Y)
    Z_frag = np.clip(Z_frag, 0, 1)
    
    fig.add_trace(go.Surface(
        x=X, y=Y, z=Z_frag,
        colorscale=[[0, 'rgba(239,68,68,0.1)'], [1, 'rgba(239,68,68,0.1)']],
        showscale=False, name='Fragility Threshold (PE=0.34)',
        hoverinfo='skip', opacity=0.2
    ))
    
    # Plot patients by zone
    colors = {"Stability": "#10b981", "Transition": "#f59e0b", "Fragility": "#ef4444", "Critical": "#7f1d1d"}
    
    for level, color in colors.items():
        level_df = df[df['pe_level'] == level]
        if len(level_df) == 0: continue
        
        hover = level_df.apply(lambda r: 
            f"<b>{r['patient_id']}</b><br>PE: {r['pe_score']:.3f}<br>"
            f"B:{r['base_norm']:.2f} M:{r['mvmt_norm']:.2f} S:{r['strata_norm']:.2f}", axis=1)
        
        fig.add_trace(go.Scatter3d(
            x=level_df['base_norm'], y=level_df['mvmt_norm'], z=level_df['strata_norm'],
            mode='markers', name=f'{level} ({len(level_df)})',
            marker=dict(size=5, color=color, opacity=0.8),
            text=hover, hovertemplate='%{text}<extra></extra>',
            customdata=level_df['patient_id'].values
        ))
    
    # Add trajectory if provided
    if trajectory_data and len(trajectory_data) > 1:
        fig.add_trace(go.Scatter3d(
            x=[p['base_norm'] for p in trajectory_data],
            y=[p['mvmt_norm'] for p in trajectory_data],
            z=[p['strata_norm'] for p in trajectory_data],
            mode='lines+markers',
            line=dict(color='gold', width=6),
            marker=dict(size=[6]*len(trajectory_data), color='gold', symbol='circle'),
            name='Patient Trajectory'
        ))
        # Arrow at end
        fig.add_trace(go.Cone(
            x=[trajectory_data[-1]['base_norm']],
            y=[trajectory_data[-1]['mvmt_norm']],
            z=[trajectory_data[-1]['strata_norm']],
            u=[0.05], v=[0.05], w=[0.05],
            colorscale=[[0, 'gold'], [1, 'gold']],
            showscale=False, sizemode='absolute', sizeref=0.1
        ))
    
    # Highlight selected
    if selected_patient and selected_patient in df['patient_id'].values:
        sel = df[df['patient_id'] == selected_patient].iloc[0]
        fig.add_trace(go.Scatter3d(
            x=[sel['base_norm']], y=[sel['mvmt_norm']], z=[sel['strata_norm']],
            mode='markers', marker=dict(size=15, color='gold', symbol='diamond'),
            name=f'Selected: {selected_patient}'
        ))
    
    # Cube edges
    edges = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,0],[0,0,1],[1,0,1],[1,0,0],
             [1,0,1],[1,1,1],[1,1,0],[1,1,1],[0,1,1],[0,1,0],[0,1,1],[0,0,1]]
    fig.add_trace(go.Scatter3d(
        x=[e[0] for e in edges], y=[e[1] for e in edges], z=[e[2] for e in edges],
        mode='lines', line=dict(color='rgba(255,255,255,0.3)', width=2),
        showlegend=False, hoverinfo='skip'
    ))
    
    fig.update_layout(
        scene=dict(
            xaxis=dict(title='BASE', range=[0,1], backgroundcolor='rgba(0,0,0,0)'),
            yaxis=dict(title='MVMT', range=[0,1], backgroundcolor='rgba(0,0,0,0)'),
            zaxis=dict(title='STRATA', range=[0,1], backgroundcolor='rgba(0,0,0,0)'),
            bgcolor='rgba(15,23,42,0.8)'
        ),
        height=600, paper_bgcolor='rgba(0,0,0,0)',
        legend=dict(yanchor="top", y=0.95, xanchor="left", x=0.02, bgcolor="rgba(0,0,0,0.7)", font=dict(color='white')),
        title=dict(text="KYBOS 3D State-Space | Green=Stability Zone", x=0.5, font=dict(color='white', size=16))
    )
    return fig


def create_kybos_2d(df, selected_patient=None):
    """2D BASE × MVMT projection"""
    fig = go.Figure()
    
    colors = {"Stability": "#10b981", "Transition": "#f59e0b", "Fragility": "#ef4444", "Critical": "#7f1d1d"}
    
    for level, color in colors.items():
        level_df = df[df['pe_level'] == level]
        if len(level_df) == 0: continue
        
        fig.add_trace(go.Scatter(
            x=level_df['base_norm'], y=level_df['mvmt_norm'],
            mode='markers', name=f'{level} ({len(level_df)})',
            marker=dict(size=8, color=color, opacity=0.7),
            customdata=level_df['patient_id'].values,
            hovertemplate='<b>%{customdata}</b><br>BASE: %{x:.2f}<br>MVMT: %{y:.2f}<extra></extra>'
        ))
    
    # Quadrant lines
    fig.add_hline(y=0.5, line_dash="dash", line_color="rgba(255,255,255,0.3)")
    fig.add_vline(x=0.5, line_dash="dash", line_color="rgba(255,255,255,0.3)")
    
    # Zone labels
    fig.add_annotation(x=0.75, y=0.75, text="OPTIMAL", font=dict(color='#10b981', size=14), showarrow=False)
    fig.add_annotation(x=0.25, y=0.75, text="UNSTABLE", font=dict(color='#f59e0b', size=14), showarrow=False)
    fig.add_annotation(x=0.75, y=0.25, text="DORMANT", font=dict(color='#f59e0b', size=14), showarrow=False)
    fig.add_annotation(x=0.25, y=0.25, text="CRISIS", font=dict(color='#ef4444', size=14), showarrow=False)
    
    fig.update_layout(
        xaxis=dict(title='BASE', range=[0,1], gridcolor='rgba(255,255,255,0.1)'),
        yaxis=dict(title='MVMT', range=[0,1], gridcolor='rgba(255,255,255,0.1)'),
        height=600, paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(15,23,42,0.9)',
        font=dict(color='white'),
        title=dict(text="KYBOS 2D: BASE × MVMT Quadrants", x=0.5, font=dict(size=16))
    )
    return fig


def create_kybos_quadrant(df, selected_patient=None):
    """4-Quadrant comprehensive view"""
    fig = make_subplots(
        rows=2, cols=2,
        subplot_titles=('BASE vs MVMT', 'BASE vs STRATA', 'MVMT vs STRATA', 'PE Distribution'),
        specs=[[{"type": "scatter"}, {"type": "scatter"}],
               [{"type": "scatter"}, {"type": "histogram"}]]
    )
    
    colors_map = {"Stability": "#10b981", "Transition": "#f59e0b", "Fragility": "#ef4444", "Critical": "#7f1d1d"}
    colors = [colors_map.get(level, '#888') for level in df['pe_level']]
    
    # Q1: BASE vs MVMT
    fig.add_trace(go.Scatter(
        x=df['base_norm'], y=df['mvmt_norm'], mode='markers',
        marker=dict(size=6, color=colors, opacity=0.7),
        customdata=df['patient_id'], showlegend=False,
        hovertemplate='%{customdata}<br>B:%{x:.2f} M:%{y:.2f}<extra></extra>'
    ), row=1, col=1)
    
    # Q2: BASE vs STRATA
    fig.add_trace(go.Scatter(
        x=df['base_norm'], y=df['strata_norm'], mode='markers',
        marker=dict(size=6, color=colors, opacity=0.7),
        customdata=df['patient_id'], showlegend=False,
        hovertemplate='%{customdata}<br>B:%{x:.2f} S:%{y:.2f}<extra></extra>'
    ), row=1, col=2)
    
    # Q3: MVMT vs STRATA
    fig.add_trace(go.Scatter(
        x=df['mvmt_norm'], y=df['strata_norm'], mode='markers',
        marker=dict(size=6, color=colors, opacity=0.7),
        customdata=df['patient_id'], showlegend=False,
        hovertemplate='%{customdata}<br>M:%{x:.2f} S:%{y:.2f}<extra></extra>'
    ), row=2, col=1)
    
    # Q4: PE Distribution
    for level, color in colors_map.items():
        level_pe = df[df['pe_level'] == level]['pe_score']
        if len(level_pe) > 0:
            fig.add_trace(go.Histogram(
                x=level_pe, name=level, marker_color=color, opacity=0.7,
                nbinsx=20
            ), row=2, col=2)
    
    # Add threshold lines
    for row, col in [(1,1), (1,2), (2,1)]:
        fig.add_hline(y=0.5, line_dash="dot", line_color="rgba(255,255,255,0.3)", row=row, col=col)
        fig.add_vline(x=0.5, line_dash="dot", line_color="rgba(255,255,255,0.3)", row=row, col=col)
    
    fig.add_vline(x=0.70, line_dash="dash", line_color="#10b981", row=2, col=2)
    fig.add_vline(x=0.34, line_dash="dash", line_color="#ef4444", row=2, col=2)
    
    fig.update_layout(
        height=700, paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(15,23,42,0.9)',
        font=dict(color='white'), showlegend=True,
        legend=dict(yanchor="top", y=0.99, xanchor="right", x=0.99, bgcolor="rgba(0,0,0,0.7)"),
        title=dict(text="KYBOS Quadrant Analysis", x=0.5, font=dict(size=16))
    )
    
    # Update axes
    for i in range(1, 3):
        for j in range(1, 3):
            if not (i == 2 and j == 2):
                fig.update_xaxes(range=[0,1], gridcolor='rgba(255,255,255,0.1)', row=i, col=j)
                fig.update_yaxes(range=[0,1], gridcolor='rgba(255,255,255,0.1)', row=i, col=j)
    
    return fig


def create_kybos_1d(df, selected_patient=None):
    """1D BASE axis only"""
    fig = go.Figure()
    
    colors = {"Stability": "#10b981", "Transition": "#f59e0b", "Fragility": "#ef4444", "Critical": "#7f1d1d"}
    
    for level, color in colors.items():
        level_df = df[df['pe_level'] == level]
        if len(level_df) == 0: continue
        
        y_jitter = np.random.uniform(-0.1, 0.1, len(level_df))
        fig.add_trace(go.Scatter(
            x=level_df['base_norm'], y=y_jitter,
            mode='markers', name=f'{level} ({len(level_df)})',
            marker=dict(size=10, color=color, opacity=0.7),
            customdata=level_df['patient_id']
        ))
    
    # Zone regions
    fig.add_vrect(x0=0, x1=0.34, fillcolor="rgba(239,68,68,0.2)", line_width=0)
    fig.add_vrect(x0=0.34, x1=0.50, fillcolor="rgba(245,158,11,0.15)", line_width=0)
    fig.add_vrect(x0=0.50, x1=0.70, fillcolor="rgba(245,158,11,0.1)", line_width=0)
    fig.add_vrect(x0=0.70, x1=1.0, fillcolor="rgba(16,185,129,0.2)", line_width=0)
    
    fig.update_layout(
        xaxis=dict(title='BASE', range=[0,1]),
        yaxis=dict(visible=False, range=[-0.3, 0.3]),
        height=300, paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(15,23,42,0.9)',
        font=dict(color='white'),
        title=dict(text="KYBOS 1D: BASE Dimension", x=0.5)
    )
    return fig
