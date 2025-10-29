import os
import sys
import requests
from PIL import Image
from io import BytesIO

def download_image_from_url(url, save_path):
    """Download an image from a URL and save it to the given path."""
    response = requests.get(url)
    response.raise_for_status()
    img = Image.open(BytesIO(response.content))
    img.save(save_path)
    print(f"[INFO] Downloaded image from {url} to {save_path}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        url = sys.argv[1]
    else:
        url = input("Enter clothing image URL: ").strip()
    if not url:
        print("No URL provided. Exiting.")
        sys.exit(1)
    save_path = "downloaded_clothing.jpg"
    download_image_from_url(url, save_path)
    print("Now run the U2Net segmentation step on this image.")
