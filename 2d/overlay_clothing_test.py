from PIL import Image
import os

def overlay_clothing_on_avatar(avatar_path, clothing_path, output_path):
    """
    Overlays the segmented clothing PNG onto the avatar image (same size, RGBA).
    The avatar image should be a PNG with transparency or a white background.
    """
    avatar = Image.open(avatar_path).convert("RGBA")
    clothing = Image.open(clothing_path).convert("RGBA")
    # Resize clothing to match avatar if needed
    if clothing.size != avatar.size:
        clothing = clothing.resize(avatar.size, Image.BILINEAR)
    result = Image.alpha_composite(avatar, clothing)
    result.save(output_path)
    print(f"[INFO] Saved overlay result to {output_path}")

if __name__ == "__main__":
    # Example usage: overlay segmented clothing on a sample avatar
    avatar_path = r"C:\Users\reddi\mango\project\game for internship\virtualdressing\services\ml\avatars\download.jpg"  # Place a test avatar PNG here
    clothing_path = "segmented_clothing.png"
    output_path = "avatar_with_clothes.png"
    overlay_clothing_on_avatar(avatar_path, clothing_path, output_path)
