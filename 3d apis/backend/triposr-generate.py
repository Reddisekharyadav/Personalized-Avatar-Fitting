"""
TripoSR Local Inference Wrapper
Runs TripoSR model locally (100% FREE, no API needed)
"""

import sys
import os
import torch
from pathlib import Path

# Add TripoSR to path
triposr_path = Path(__file__).parent / 'triposr-local' / 'TripoSR'
sys.path.insert(0, str(triposr_path))

try:
    from tsr.system import TSR
    from tsr.utils import resize_foreground
    import numpy as np
    from PIL import Image
    
    # Try to import rembg (optional - for background removal)
    try:
        import rembg
        from tsr.utils import remove_background
        HAS_REMBG = True
    except ImportError:
        HAS_REMBG = False
        print("Note: Background removal (rembg) not available - using images as-is")
    
    # Try to import torchmcubes (optional - for faster mesh extraction)
    try:
        import torchmcubes
        HAS_TORCHMCUBES = True
    except ImportError:
        HAS_TORCHMCUBES = False
        print("Note: torchmcubes not available - using slower mesh extraction")
        
except ImportError as e:
    print(f"ERROR: TripoSR not installed. Run setup-triposr-simple.bat first.")
    print(f"Details: {e}")
    sys.exit(1)


def generate_3d(image_path, output_path, remove_bg=True, foreground_ratio=0.85):
    """
    Generate 3D model from image using TripoSR
    
    Args:
        image_path: Path to input image
        output_path: Path to save GLB file
        remove_bg: Whether to remove background (requires rembg)
        foreground_ratio: How much of the image the object takes (0.0-1.0)
    
    Returns:
        Path to generated GLB file
    """
    print(f"Loading image: {image_path}")
    
    # Load image
    image = Image.open(image_path)
    
    # Preprocess
    if remove_bg and HAS_REMBG:
        print("Removing background...")
        image = remove_background(image, rembg.new_session())
    elif remove_bg and not HAS_REMBG:
        print("Note: Background removal not available - using image as-is")
    
    image = resize_foreground(image, foreground_ratio)
    
    # Convert RGBA to RGB (TripoSR expects 3-channel RGB images)
    if image.mode == 'RGBA':
        # Create white background
        rgb_image = Image.new('RGB', image.size, (255, 255, 255))
        rgb_image.paste(image, mask=image.split()[3])  # Use alpha channel as mask
        image = rgb_image
    elif image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Initialize model (happens once, cached after)
    print("Loading TripoSR model (first time may take a minute)...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")
    
    model = TSR.from_pretrained(
        "stabilityai/TripoSR",
        config_name="config.yaml",
        weight_name="model.ckpt",
    )
    model.to(device)
    
    # Generate 3D
    print("Generating 3D model...")
    with torch.no_grad():
        scene_codes = model([image], device=device)
    
    print(f"DEBUG: scene_codes shape: {scene_codes.shape}, type: {type(scene_codes)}")
    
    # Export GLB
    print(f"Saving GLB to: {output_path}")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Extract mesh and save (extract_mesh returns a list, take first mesh)
    meshes = model.extract_mesh(scene_codes, has_vertex_color=False)
    meshes[0].export(output_path)
    
    print(f"Success! Generated: {output_path}")
    return output_path


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python triposr-generate.py <input_image> <output_glb>")
        print("Example: python triposr-generate.py test.jpg output.glb")
        sys.exit(1)
    
    input_image = sys.argv[1]
    output_glb = sys.argv[2]
    
    if not os.path.exists(input_image):
        print(f"ERROR: Input image not found: {input_image}")
        sys.exit(1)
    
    try:
        result = generate_3d(input_image, output_glb)
        print(f"RESULT_PATH:{result}")  # For Node.js to parse
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
