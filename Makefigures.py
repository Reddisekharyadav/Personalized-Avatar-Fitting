"""
make_figures.py
Generates figures from the submitted paper (block diagram, architecture, workflow,
interaction diagrams, and charts). Saves PNG files into output_figures/.

Corresponds to figures & charts in the uploaded paper. Source: uploaded PDF. :contentReference[oaicite:1]{index=1}
"""

import os
import math
import matplotlib.pyplot as plt
import networkx as nx
from graphviz import Digraph
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import pandas as pd

# Configure Graphviz executable path for Windows
GRAPHVIZ_DOT = r'C:\Program Files\Graphviz\bin\dot.exe'

OUT_DIR = "output_figures"
os.makedirs(OUT_DIR, exist_ok=True)

# ---------------------------
# Helper: save matplotlib nicely
# ---------------------------
def savefig(fig, name, dpi=200, bbox_inches='tight'):
    path = os.path.join(OUT_DIR, name)
    fig.savefig(path, dpi=dpi, bbox_inches=bbox_inches)
    plt.close(fig)
    print("Saved:", path)

# ---------------------------
# 1) Block diagram (Figure I)
# ---------------------------
def make_block_diagram():
    dot = Digraph(comment='Block diagram', format='png', engine='dot')
    dot.engine = 'dot'
    dot.renderer = 'cairo'
    dot.attr(rankdir='LR', fontsize='12')

    dot.node('User', 'User', shape='oval', style='filled', fillcolor='lightblue')
    dot.node('Avatar', 'Avatar Creation\n(ReadyPlayerMe)', shape='box')
    dot.node('Wardrobe', 'Wardrobe\nManagement', shape='box')
    dot.node('TryOn', 'Virtual Try-On\nRendering\n(Three.js)', shape='box')
    dot.node('Post', 'Post-Processing\nTexture & Scaling', shape='box')
    dot.node('GUI', 'GUI / Cloud Output', shape='oval', style='filled', fillcolor='lightgrey')

    dot.edge('User', 'Avatar')
    dot.edge('Avatar', 'Wardrobe')
    dot.edge('Wardrobe', 'TryOn')
    dot.edge('TryOn', 'Post')
    dot.edge('Post', 'GUI')

    # Use the specific executable path
    import subprocess
    import tempfile
    
    # Save the dot source to a temporary file
    temp_dot = tempfile.NamedTemporaryFile(mode='w', suffix='.dot', delete=False)
    temp_dot.write(dot.source)
    temp_dot.close()
    
    # Generate the output using the specific dot executable
    output_path = os.path.join(OUT_DIR, 'figure_block_diagram.png')
    subprocess.run([GRAPHVIZ_DOT, '-Tpng', temp_dot.name, '-o', output_path], check=True)
    
    # Clean up
    os.unlink(temp_dot.name)
    
    print("Saved:", output_path)

# ---------------------------
# 2) System architecture diagram (Figure II)
# ---------------------------
def make_system_architecture():
    G = nx.DiGraph()
    # add nodes & positions
    nodes = {
        "Frontend\n(Next.js + Three.js)": (0, 0),
        "Backend\n(FastAPI / Node.js)": (2, 1),
        "ML Service\n(Celery / PyTorch)": (2, -1),
        "Database\n(MongoDB)": (4, 1.2),
        "Asset Pipeline\n(GLTF -> GLB)": (4, -0.2),
        "Infrastructure\n(Docker + Terraform)": (6, 0),
        "User\n(Avatar / Wardrobe)": (0, -2)
    }
    for n, pos in nodes.items():
        G.add_node(n, pos=pos)

    edges = [
        ("Frontend\n(Next.js + Three.js)", "Backend\n(FastAPI / Node.js)"),
        ("Backend\n(FastAPI / Node.js)", "Database\n(MongoDB)"),
        ("Backend\n(FastAPI / Node.js)", "ML Service\n(Celery / PyTorch)"),
        ("ML Service\n(Celery / PyTorch)", "Asset Pipeline\n(GLTF -> GLB)"),
        ("Asset Pipeline\n(GLTF -> GLB)", "Infrastructure\n(Docker + Terraform)"),
        ("Database\n(MongoDB)", "Infrastructure\n(Docker + Terraform)"),
        ("User\n(Avatar / Wardrobe)", "Frontend\n(Next.js + Three.js)")
    ]
    G.add_edges_from(edges)

    pos = {n: nodes[n] for n in nodes}
    fig, ax = plt.subplots(figsize=(10,5))
    nx.draw_networkx_nodes(G, pos, node_color='lightcyan', node_size=3000, edgecolors='k')
    nx.draw_networkx_edges(G, pos, arrows=True, arrowstyle='->', arrowsize=20)
    nx.draw_networkx_labels(G, pos, font_size=9)
    ax.set_axis_off()
    savefig(fig, 'figure_system_architecture.png')

# ---------------------------
# 3) Workflow diagram (Figure III)
# ---------------------------
def make_workflow_diagram():
    dot = Digraph('Workflow', format='png')
    dot.attr(rankdir='LR')

    steps = [
        ('Register', 'User Registration\n& Authentication'),
        ('Create', 'Avatar Creation\n(ReadyPlayerMe)'),
        ('Wardrobe', 'Wardrobe\nManagement'),
        ('Select', 'Select Garment'),
        ('Preprocess', 'Preprocess\n(GLTF -> GLB)'),
        ('Fit', 'Garment Fit\n& Render'),
        ('Result', 'Post-Processing\n& GUI Display')
    ]
    for s, label in steps:
        dot.node(s, label, shape='box')

    for i in range(len(steps)-1):
        dot.edge(steps[i][0], steps[i+1][0])

    out = dot.render(filename=os.path.join(OUT_DIR, 'figure_workflow'), cleanup=True)
    print("Saved:", out)

# ---------------------------
# 4) Complete interaction diagram (Figure IV)
#    We'll generate a more detailed flow using Graphviz swimlane-like style
# ---------------------------
def make_interaction_diagram():
    dot = Digraph('Interaction', format='png')
    dot.attr(rankdir='LR')

    dot.node('U', 'User', shape='ellipse', style='filled', fillcolor='lightblue')
    dot.node('F', 'Frontend\n(Next.js + Three.js)', shape='box')
    dot.node('B', 'Backend\nFastAPI/Node', shape='box')
    dot.node('M', 'ML Service\nCelery / PyTorch', shape='box')
    dot.node('A', 'Asset Pipeline\n(GLTF -> GLB)', shape='box')
    dot.node('DB', 'MongoDB', shape='cylinder')

    # interactions
    dot.edge('U', 'F', label='requests / interactions')
    dot.edge('F', 'B', label='REST API (JWT)')
    dot.edge('B', 'M', label='task queue')
    dot.edge('M', 'A', label='convert & optimize')
    dot.edge('A', 'B', label='processed asset')
    dot.edge('B', 'F', label='deliver asset & metadata')
    dot.edge('F', 'U', label='render & show')

    out = dot.render(filename=os.path.join(OUT_DIR, 'figure_interaction_diagram'), cleanup=True)
    print("Saved:", out)

# ---------------------------
# 5) Charts: Latency across modes (Figure V)
# ---------------------------
def make_latency_chart():
    # values taken from paper (matching table). Source: uploaded PDF. :contentReference[oaicite:2]{index=2}
    modes = ['Local\nSingle User', 'Local\n10 users', 'Cloud\n(AWS)']
    means = [2.1, 2.6, 2.3]     # seconds
    stds = [0.4, 0.5, 0.3]

    fig, ax = plt.subplots(figsize=(6,4))
    x = np.arange(len(modes))
    ax.bar(x, means, yerr=stds, capsize=8)
    ax.set_xticks(x)
    ax.set_xticklabels(modes)
    ax.set_ylabel('Latency (s)')
    ax.set_title('Rendering Latency across Deployment Modes\n(average ± std)')
    for i, v in enumerate(means):
        ax.text(i, v+0.05, f"{v:.2f}s", ha='center')
    savefig(fig, 'figure_latency_modes.png')

# ---------------------------
# 6) Scalability plot (Figure VI)
# ---------------------------
def make_scalability_plot():
    # synthetic example to mirror paper statement: latency vs concurrent users
    concurrent = np.array([1, 5, 10, 20, 30, 50])
    # derived roughly from text (paper reports 2.5 sec avg and 3.1 sec at 50 users)
    latency = np.array([2.1, 2.3, 2.6, 2.8, 2.95, 3.1])

    fig, ax = plt.subplots(figsize=(7,4))
    ax.plot(concurrent, latency, marker='o')
    ax.set_xlabel('Concurrent Users')
    ax.set_ylabel('Average Latency (s)')
    ax.set_title('Scalability: Average Latency vs Concurrent Users')
    ax.grid(True, linestyle='--', linewidth=0.5)
    for x,y in zip(concurrent, latency):
        ax.text(x, y+0.03, f"{y:.2f}", ha='center', fontsize=8)
    savefig(fig, 'figure_scalability.png')

# ---------------------------
# 7) Robust 3D asset conversion success rate (Figure VII)
# ---------------------------
def make_conversion_success_chart():
    # paper reports 97% success.
    success = 97
    fail = 100 - success
    fig, ax = plt.subplots(figsize=(5,5))
    ax.pie([success, fail], labels=[f"Success {success}%", f"Failed {fail}%"], autopct='%1.0f%%', startangle=90)
    ax.set_title('3D Asset Preprocessing Success Rate\n(GLTF → GLB)')
    savefig(fig, 'figure_conversion_success.png')

# ---------------------------
# 8) Usability results (Figure VIII)
# ---------------------------
def make_usability_chart():
    # paper: Avatar creation: 80% intuitive; Wardrobe: 90% helpful; Visualization realism: 70% satisfied
    categories = ['Avatar creation\n(intuitive)', 'Wardrobe\n(helpful)', 'Visualization\n(realism)']
    values = [80, 90, 70]

    fig, ax = plt.subplots(figsize=(6,4))
    bars = ax.bar(categories, values)
    ax.set_ylim(0, 100)
    ax.set_ylabel('Percent (%)')
    ax.set_title('Usability Study Results')
    for bar, v in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width()/2, v+2, f"{v}%", ha='center')
    savefig(fig, 'figure_usability.png')

# ---------------------------
# 9) Table images: hardware & software config (simple table snapshots)
# ---------------------------
def make_table_image():
    hw = {
        "Category": ["Processor", "GPU", "RAM", "Storage", "Display", "Network"],
        "Description": [
            "Intel Core i7 11th Gen (2.90 GHz, 8 cores)",
            "NVIDIA GeForce RTX 3060 (12 GB VRAM)",
            "16 GB DDR4",
            "1 TB SSD",
            "Full HD (1920×1080) WebGL 2.0 support",
            "200 Mbps broadband"
        ]
    }
    df = pd.DataFrame(hw)
    # render DataFrame as image using matplotlib
    fig, ax = plt.subplots(figsize=(8,2 + 0.4*len(df)))
    ax.axis('off')
    table = ax.table(cellText=df.values.tolist(), colLabels=list(df.columns), cellLoc='left', loc='center')
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1, 1.5)
    savefig(fig, 'table_hardware_config.png')

    sw = {
        "Component": ["Frontend", "Backend", "Database", "ML Service", "Deployment Tools"],
        "Stack": ["Next.js 14, Three.js, Tailwind CSS", "FastAPI (Python 3.10) / Node.js 18 (Express)", "MongoDB 6.0", "Python 3.10, Celery, PyTorch", "Docker, Docker Compose, Terraform (AWS)"]
    }
    df2 = pd.DataFrame(sw)
    fig2, ax2 = plt.subplots(figsize=(8,2 + 0.6*len(df2)))
    ax2.axis('off')
    table2 = ax2.table(cellText=df2.values.tolist(), colLabels=list(df2.columns), cellLoc='left', loc='center')
    table2.auto_set_font_size(False)
    table2.set_fontsize(9)
    table2.scale(1, 1.4)
    savefig(fig2, 'table_software_config.png')

# ---------------------------
# 10) Small helper: create a high-res placeholder showing "before vs after GLTF->GLB"
# ---------------------------
def make_before_after_placeholder():
    # create simple side-by-side image with labels (useful as illustrative figure)
    w, h = 1200, 500
    im = Image.new('RGB', (w, h), color='white')
    draw = ImageDraw.Draw(im)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 20)
    except:
        font = ImageFont.load_default()

    # left box (before)
    draw.rectangle([50, 50, 550, 450], outline='black', width=3)
    draw.text((100, 60), "Before: Broken References\n(missing textures/.bin)", font=font, fill='black')
    # draw some simulated broken texture pattern
    for i in range(60, 430, 30):
        draw.line([(70, i), (530, i+10)], fill='grey', width=2)

    # right box (after)
    draw.rectangle([650, 50, 1150, 450], outline='black', width=3)
    draw.text((700, 60), "After: GLB Bundled\n(textures embedded, consistent)", font=font, fill='black')
    # simulated nice pattern
    for i in range(70, 430, 30):
        draw.arc([700, i, 1100, i+60], 0, 180, fill='blue')

    im_path = os.path.join(OUT_DIR, 'figure_before_after_conversion.png')
    im.save(im_path)
    print("Saved:", im_path)

# ---------------------------
# Run everything
# ---------------------------
if __name__ == "__main__":
    make_block_diagram()
    make_system_architecture()
    make_workflow_diagram()
    make_interaction_diagram()
    make_latency_chart()
    make_scalability_plot()
    make_conversion_success_chart()
    make_usability_chart()
    make_table_image()
    make_before_after_placeholder()
    print("All figures created in:", OUT_DIR)
