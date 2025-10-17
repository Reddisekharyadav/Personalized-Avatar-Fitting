"""
display_diagrams.py
Generate and display system architecture, workflow, and interaction diagrams
without saving - just for viewing and testing
"""

import matplotlib.pyplot as plt
import networkx as nx
from graphviz import Digraph
import tempfile
import subprocess
import os

# Configure Graphviz executable path for Windows
GRAPHVIZ_DOT = r'C:\Program Files\Graphviz\bin\dot.exe'

def display_system_architecture():
    """Display enhanced large system architecture diagram using NetworkX and matplotlib"""
    print("Generating Enhanced System Architecture Diagram...")
    
    G = nx.DiGraph()
    # add nodes & positions with better spacing
    nodes = {
        "Frontend\n(Next.js + Three.js)": (0, 0),
        "Backend\n(FastAPI / Node.js)": (3, 1.5),
        "ML Service\n(Celery / PyTorch)": (3, -1.5),
        "Database\n(MongoDB)": (6, 2),
        "Asset Pipeline\n(GLTF -> GLB)": (6, -0.5),
        "Infrastructure\n(Docker + Terraform)": (9, 0),
        "User\n(Avatar / Wardrobe)": (0, -3)
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
    
    # Create much larger figure with enhanced styling
    fig, ax = plt.subplots(figsize=(18, 14))
    
    # Define different colors for different types of components
    node_colors = {
        "Frontend\n(Next.js + Three.js)": '#87CEEB',  # Sky Blue
        "Backend\n(FastAPI / Node.js)": '#98FB98',    # Pale Green
        "ML Service\n(Celery / PyTorch)": '#FFB6C1',  # Light Pink
        "Database\n(MongoDB)": '#DDA0DD',             # Plum
        "Asset Pipeline\n(GLTF -> GLB)": '#F0E68C',   # Khaki
        "Infrastructure\n(Docker + Terraform)": '#FFA07A',  # Light Salmon
        "User\n(Avatar / Wardrobe)": '#ADD8E6'        # Light Blue
    }
    
    colors = [node_colors[node] for node in G.nodes()]
    
    # Draw nodes with enhanced styling
    nx.draw_networkx_nodes(G, pos, 
                          node_color=colors, 
                          node_size=12000,  # Much larger nodes
                          edgecolors='black', 
                          linewidths=4,
                          alpha=0.9)
    
    # Draw edges with enhanced styling
    nx.draw_networkx_edges(G, pos, 
                          arrows=True, 
                          arrowstyle='->', 
                          arrowsize=35,  # Larger arrows
                          edge_color='darkblue',
                          width=4,
                          alpha=0.8)
    
    # Draw labels with larger font
    nx.draw_networkx_labels(G, pos, 
                           font_size=14, 
                           font_weight='bold',
                           font_family='serif')
    
    # Add title and styling
    ax.set_title('System Architecture Diagram\nPersonalized Avatar Virtual Dressing System', 
                fontsize=24, fontweight='bold', pad=40)
    ax.set_axis_off()
    
    # Add a subtle grid for better visual organization
    ax.grid(True, alpha=0.1, linestyle='--')
    
    # Set better margins
    plt.tight_layout()
    plt.show()

def display_workflow_diagram():
    """Display enhanced large workflow diagram using Graphviz"""
    print("Generating Enhanced Workflow Diagram...")
    
    dot = Digraph('Workflow', format='png')
    dot.attr(rankdir='TB', size='16,12', dpi='300')
    dot.attr('graph', bgcolor='white', fontsize='16', fontname='Arial Bold')
    dot.attr('node', fontsize='14', style='filled,rounded', fontname='Arial', 
             width='2.5', height='1.2', margin='0.2')
    dot.attr('edge', fontsize='12', fontname='Arial', penwidth='3', arrowsize='1.5')

    # Enhanced steps with better descriptions and colors (Windows compatible)
    steps = [
        ('Register', 'User Registration\n& Authentication\n[AUTH]', 'lightblue'),
        ('Create', 'Avatar Creation\n(ReadyPlayerMe)\n[AVATAR]', 'lightgreen'),
        ('Wardrobe', 'Wardrobe\nManagement\n[CLOTHES]', 'lightyellow'),
        ('Select', 'Select Garment\n& Style\n[CHOICE]', 'lightcoral'),
        ('Preprocess', 'Asset Preprocessing\n(GLTF -> GLB)\n[CONVERT]', 'lightpink'),
        ('Fit', 'Virtual Garment Fit\n& 3D Rendering\n[RENDER]', 'lavender'),
        ('Result', 'Post-Processing\n& GUI Display\n[OUTPUT]', 'lightcyan')
    ]
    
    for i, (s, label, color) in enumerate(steps):
        dot.node(s, label, shape='box', fillcolor=color, color='darkblue')

    # Add enhanced edges with labels
    edge_labels = [
        'Authenticate User',
        'Generate Avatar',
        'Browse Clothes',
        'Choose Item',
        'Process Assets',
        'Apply & Render',
        'Display Result'
    ]
    
    for i in range(len(steps)-1):
        dot.edge(steps[i][0], steps[i+1][0], label=edge_labels[i], color='darkblue')

    # Generate and display using subprocess
    temp_dot = tempfile.NamedTemporaryFile(mode='w', suffix='.dot', delete=False)
    temp_dot.write(dot.source)
    temp_dot.close()
    
    temp_png = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
    temp_png.close()
    
    try:
        subprocess.run([GRAPHVIZ_DOT, '-Tpng', temp_dot.name, '-o', temp_png.name], check=True)
        
        # Display the image
        from PIL import Image
        img = Image.open(temp_png.name)
        img.show()
        print("Enhanced Workflow diagram displayed!")
        
    finally:
        # Clean up temp files
        os.unlink(temp_dot.name)
        os.unlink(temp_png.name)

def display_interaction_diagram():
    """Display enhanced large interaction diagram using Graphviz"""
    print("Generating Enhanced Interaction Diagram...")
    
    dot = Digraph('Interaction', format='png')
    dot.attr(rankdir='LR', size='18,12', dpi='300')
    dot.attr('graph', bgcolor='white', fontsize='16', fontname='Arial Bold')
    dot.attr('node', fontsize='13', fontname='Arial', margin='0.3')
    dot.attr('edge', fontsize='11', fontname='Arial', penwidth='2.5', arrowsize='1.2')

    # Enhanced nodes with better styling (Windows compatible)
    dot.node('U', '[USER]\nUser\n(Client)', shape='ellipse', style='filled', fillcolor='lightblue', 
             width='2', height='1.5')
    dot.node('F', '[WEB]\nFrontend\n(Next.js + Three.js)\nUI/UX Layer', shape='box', style='filled,rounded', 
             fillcolor='lightgreen', width='3', height='2')
    dot.node('B', '[API]\nBackend API\n(FastAPI/Node.js)\nBusiness Logic', shape='box', style='filled,rounded', 
             fillcolor='lightyellow', width='3', height='2')
    dot.node('M', '[AI]\nML Service\n(Celery + PyTorch)\nAI Processing', shape='box', style='filled,rounded', 
             fillcolor='lightcoral', width='3', height='2')
    dot.node('A', '[3D]\nAsset Pipeline\n(GLTF -> GLB)\n3D Processing', shape='box', style='filled,rounded', 
             fillcolor='lightpink', width='3', height='2')
    dot.node('DB', '[DATA]\nMongoDB\nDatabase\nData Storage', shape='cylinder', style='filled', 
             fillcolor='lightgray', width='2.5', height='2')

    # Enhanced interactions with detailed labels and colors (Windows compatible)
    dot.edge('U', 'F', label='[INPUT] User Interactions\n(clicks, uploads, selections)', 
             color='darkblue', style='bold')
    dot.edge('F', 'B', label='[API] REST API Calls\n(JWT Authentication)\nHTTPS Requests', 
             color='darkgreen', style='bold')
    dot.edge('B', 'M', label='[QUEUE] Task Queue\n(Celery Workers)\nAsync Processing', 
             color='darkorange', style='bold')
    dot.edge('M', 'A', label='[PROCESS] Asset Conversion\n& Optimization\n3D Model Processing', 
             color='darkred', style='bold')
    dot.edge('A', 'B', label='[RESULT] Processed Assets\n(GLB Files)\nMetadata & URLs', 
             color='darkmagenta', style='bold')
    dot.edge('B', 'F', label='[DELIVER] Asset Delivery\n& Metadata\nJSON Response', 
             color='darkcyan', style='bold')
    dot.edge('F', 'U', label='[DISPLAY] 3D Visualization\n& Rendering\nInteractive Display', 
             color='darkslateblue', style='bold')
    dot.edge('B', 'DB', label='[SAVE] Data Operations\n(CRUD)\nUser & Asset Data', 
             color='chocolate', style='bold')
    dot.edge('DB', 'B', label='[LOAD] Query Results\n& Stored Data\nDatabase Response', 
             color='chocolate', style='bold')

    # Generate and display using subprocess
    temp_dot = tempfile.NamedTemporaryFile(mode='w', suffix='.dot', delete=False)
    temp_dot.write(dot.source)
    temp_dot.close()
    
    temp_png = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
    temp_png.close()
    
    try:
        subprocess.run([GRAPHVIZ_DOT, '-Tpng', temp_dot.name, '-o', temp_png.name], check=True)
        
        # Display the image
        from PIL import Image
        img = Image.open(temp_png.name)
        img.show()
        print("Enhanced Interaction diagram displayed!")
        
    finally:
        # Clean up temp files
        os.unlink(temp_dot.name)
        os.unlink(temp_png.name)

def display_all_diagrams():
    """Display all three enhanced diagrams"""
    print("=" * 60)
    print("DISPLAYING ALL ENHANCED DIAGRAMS")
    print("=" * 60)
    
    print("[1/3] - System Architecture Diagram")
    display_system_architecture()
    input("\nPress Enter to continue to workflow diagram...")
    
    print("\n[2/3] - Workflow Diagram") 
    display_workflow_diagram()
    input("\nPress Enter to continue to interaction diagram...")
    
    print("\n[3/3] - Interaction Diagram")
    display_interaction_diagram()
    
    print("\n" + "=" * 60)
    print("All enhanced diagrams displayed successfully!")
    print("=" * 60)

if __name__ == "__main__":
    print("=" * 60)
    print("   ENHANCED VIRTUAL DRESSING DIAGRAM GENERATOR")
    print("=" * 60)
    print("\nSelect an option:")
    print("1. Display Enhanced System Architecture Diagram")
    print("2. Display Enhanced Workflow Diagram") 
    print("3. Display Enhanced Interaction Diagram")
    print("4. Display All Enhanced Diagrams")
    print("\n" + "-" * 60)
    
    choice = input("Enter your choice (1-4): ").strip()
    
    print("\n" + "=" * 60)
    if choice == '1':
        print("Generating System Architecture...")
        display_system_architecture()
    elif choice == '2':
        print("Generating Workflow...")
        display_workflow_diagram()
    elif choice == '3':
        print("Generating Interaction...")
        display_interaction_diagram()
    elif choice == '4':
        print("Generating All Diagrams...")
        display_all_diagrams()
    else:
        print("Invalid choice. Displaying all diagrams...")
        display_all_diagrams()
        
    print("\nThank you for using the Enhanced Diagram Generator!")