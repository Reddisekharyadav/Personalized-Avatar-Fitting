#!/usr/bin/env python3
"""
FREE Image-to-3D Generator using Hugging Face
Uses state-of-the-art models to convert product images to GLB files
"""

import sys
import os
import requests
from pathlib import Path

# Check if required packages are installed
try:
    from PIL import Image
    import torch
except ImportError:
    print("ERROR: Required packages not installed")
    print("Please install: pip install pillow torch huggingface-hub")
    sys.exit(1)

def download_image(url, output_path="temp_input.jpg"):
    """Download image from URL"""
    print(f"📥 Downloading image from: {url}")
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    
    with open(output_path, 'wb') as f:
        f.write(response.content)
    
    print(f"✅ Image downloaded: {len(response.content)} bytes")
    return output_path

def generate_3d_triposr(image_path, output_path="output.glb"):
    """
    Generate 3D model using TripoSR (Stability AI)
    This is the most reliable FREE option
    """
    try:
        from huggingface_hub import hf_hub_download
        import trimesh
        
        print("🎨 Loading TripoSR model...")
        
        # This requires the actual TripoSR library
        # For now, we'll use the Hugging Face Inference API
        
        HF_TOKEN = os.getenv('HUGGINGFACE_API_TOKEN')
        if not HF_TOKEN:
            raise ValueError("HUGGINGFACE_API_TOKEN not found in environment")
        
        # Use Hugging Face Inference API
        API_URL = "https://router.huggingface.co/hf-inference/stabilityai/TripoSR"
        headers = {"Authorization": f"Bearer {HF_TOKEN}"}
        
        with open(image_path, "rb") as f:
            data = f.read()
        
        print("🚀 Sending request to TripoSR...")
        response = requests.post(API_URL, headers=headers, data=data, timeout=180)
        
        if response.status_code == 200:
            with open(output_path, 'wb') as f:
                f.write(response.content)
            print(f"✅ 3D model generated: {output_path}")
            return output_path
        else:
            raise Exception(f"API returned status {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f"❌ TripoSR failed: {e}")
        return None

def generate_3d_simple(image_url, output_glb="output.glb"):
    """
    Simple wrapper function that tries to generate 3D from image URL
    """
    # Download image
    temp_image = download_image(image_url)
    
    # Try TripoSR
    result = generate_3d_triposr(temp_image, output_glb)
    
    # Cleanup
    if os.path.exists(temp_image):
        os.remove(temp_image)
    
    return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python python-3d-generator.py <image_url> [output.glb]")
        sys.exit(1)
    
    image_url = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "output.glb"
    
    print("\n🎨 FREE Image-to-3D Generator")
    print("=" * 60)
    
    result = generate_3d_simple(image_url, output_path)
    
    if result:
        print(f"\n✅ SUCCESS! 3D model saved to: {result}")
        print(f"📦 File size: {os.path.getsize(result)} bytes")
        sys.exit(0)
    else:
        print("\n❌ FAILED to generate 3D model")
        sys.exit(1)
