def export_uv_template(vertices, out_path="uv_template.png", texture_size=512):
    """
    Exports a UV layout template PNG for the current SMPL-X mesh.
    The template can be used as a guide for designing fashion overlays.
    """
    import numpy as np
    from PIL import Image, ImageDraw
    # Simple planar UV mapping (same as used in fit_smplx_to_landmarks)
    uv = np.zeros((vertices.shape[0], 2))
    uv[:, 0] = (vertices[:, 0] - vertices[:, 0].min()) / (vertices[:, 0].max() - vertices[:, 0].min())
    uv[:, 1] = (vertices[:, 1] - vertices[:, 1].min()) / (vertices[:, 1].max() - vertices[:, 1].min())
    # Draw UV points
    img = Image.new("RGBA", (texture_size, texture_size), (255,255,255,0))
    draw = ImageDraw.Draw(img)
    for u, v in uv:
        x = int(u * (texture_size-1))
        y = int((1-v) * (texture_size-1))  # Flip v for image coordinates
        draw.ellipse((x-2, y-2, x+2, y+2), fill=(0,0,0,255))
    img.save(out_path)
    print(f"[INFO] UV template exported to {out_path}")
import os
import numpy as np
import torch
import smplx
import trimesh
import cv2
from PIL import Image, ImageDraw
def fit_smplx_to_landmarks(landmarks, model_path, gender="neutral", out_path="avatar.obj", image_path=None, skin_color=None, eye_color=None, clothes_option=None):
    model = smplx.SMPLX(model_path,
        gender=gender,
        use_face_contour=True,
        ext='npz')
    betas = torch.zeros([1, 10])
    body_pose = torch.zeros([1, 21, 3])
    global_orient = torch.zeros([1, 3])
    transl = torch.zeros([1, 3])
    output = model(betas=betas, body_pose=body_pose, global_orient=global_orient, transl=transl)
    vertices = output.vertices.detach().cpu().numpy().squeeze()
    faces = model.faces
    mesh = trimesh.Trimesh(vertices, faces)
    # Automatically export UV template for user overlay design
    try:
        export_uv_template(vertices)
    except Exception as e:
        print(f"[WARN] Could not export UV template: {e}")
    # Remove previous outputs if they exist
    for ext in [".obj", ".mtl", ".png"]:
        out_file = os.path.join(os.path.dirname(out_path), f"{os.path.splitext(os.path.basename(out_path))[0]}{ext}")
        if os.path.exists(out_file):
            os.remove(out_file)

    texture_size = 512
    # 1. Fill with user's skin color (sampled from face)
    # TEST: Force a very dark color to check if texture changes
    fill_color = (10, 10, 10)  # almost black
    print(f"[DEBUG] TEST: Forcing fill_color for skin to {fill_color}")
    texture_img = Image.new('RGB', (texture_size, texture_size), fill_color)
    draw = ImageDraw.Draw(texture_img)

    # 2. Overlay user's face crop, aligned using face landmarks if possible
    if image_path is not None and os.path.exists(image_path):
        try:
            from image_utils import detect_faces, extract_face_landmarks, crop_face
            # Get face crop and landmarks
            boxes = detect_faces(image_path)
            if boxes:
                face_img = crop_face(image_path)
                face_landmarks = extract_face_landmarks(image_path)
                print(f"[DEBUG] Face crop found: {face_img is not None}, landmarks found: {face_landmarks is not None and len(face_landmarks) > 0}")
                if face_img is not None and face_landmarks is not None and len(face_landmarks) > 0:
                    xs, ys = zip(*face_landmarks)
                    # Place face crop at the average position of face landmarks (centered)
                    uv_x = int(texture_size * 0.5)
                    uv_y = int(texture_size * 0.32)
                    face_img = face_img.resize((int(texture_size*0.28), int(texture_size*0.28)))
                    face_x = uv_x - face_img.width//2
                    face_y = uv_y - face_img.height//2
                    print(f"[DEBUG] Pasting face at: ({face_x}, {face_y}) size: {face_img.size}")
                    texture_img.paste(face_img, (face_x, face_y))
        except Exception as e:
            print(f"Face crop/landmark alignment failed: {e}")

    # 3. Overlay outfit image (no body mask, just alpha blend on top)
    try:
        assets_dir = os.path.join(os.path.dirname(__file__), "fashion_assets")
        if gender == "male":
            outfit_base = os.path.join(assets_dir, "male_outfit")
        elif gender == "female":
            outfit_base = os.path.join(assets_dir, "female_outfit")
        else:
            outfit_base = None
        outfit_path = None
        for ext in [".png", ".jpg", ".jpeg"]:
            if outfit_base and os.path.exists(outfit_base + ext):
                outfit_path = outfit_base + ext
                break
        print(f"[DEBUG] Outfit path: {outfit_path}")
        if outfit_path:
            clothing = Image.open(outfit_path).convert("RGBA").resize((texture_size, texture_size))
            texture_img = texture_img.convert("RGBA")
            texture_img = Image.alpha_composite(texture_img, clothing)
            texture_img = texture_img.convert("RGB")
            print(f"[INFO] Fashion outfit overlaid (alpha blend): {outfit_path}")
        else:
            print(f"[INFO] No fashion outfit found for gender: {gender} (searched for male_outfit/female_outfit with .png/.jpg/.jpeg)")
    except Exception as e:
        print(f"[ERROR] Fashion outfit overlay failed: {e}")

    # 4. Paint eyes (smaller ellipses inside face)
    if eye_color is not None:
        left_eye_uv = (int(texture_size * 0.43), int(texture_size * 0.32))
        right_eye_uv = (int(texture_size * 0.57), int(texture_size * 0.32))
        eye_radius = int(texture_size * 0.03)
        draw.ellipse([left_eye_uv[0]-eye_radius, left_eye_uv[1]-eye_radius, left_eye_uv[0]+eye_radius, left_eye_uv[1]+eye_radius], fill=eye_color)
        draw.ellipse([right_eye_uv[0]-eye_radius, right_eye_uv[1]-eye_radius, right_eye_uv[0]+eye_radius, right_eye_uv[1]+eye_radius], fill=eye_color)

    # Save texture
    user_image_path = out_path.replace('_avatar.obj', '.png')
    print(f"[DEBUG] Saving texture image to: {user_image_path}")
    if os.path.exists(user_image_path):
        print(f"[DEBUG] Texture file exists, removing: {user_image_path}")
        os.remove(user_image_path)
    texture_img.save(user_image_path)
    # Write MTL file
    mtl_path = out_path.replace('.obj', '.mtl')
    mtl_name = os.path.basename(mtl_path)
    texture_name = os.path.basename(user_image_path)
    with open(mtl_path, 'w') as mtl:
        mtl.write(f"newmtl skin\nKa 1.0 1.0 1.0\nKd 1.0 1.0 1.0\nKs 0.0 0.0 0.0\nd 1.0\nillum 2\nmap_Kd {texture_name}\n")
    # Assign UVs to mesh (simple planar mapping)
    uv = np.zeros((vertices.shape[0], 2))
    uv[:, 0] = (vertices[:, 0] - vertices[:, 0].min()) / (vertices[:, 0].max() - vertices[:, 0].min())
    uv[:, 1] = (vertices[:, 1] - vertices[:, 1].min()) / (vertices[:, 1].max() - vertices[:, 1].min())
    # Set mesh vertex colors to skin color for all vertices
    if skin_color is not None:
        if len(skin_color) == 3:
            vertex_color = tuple(list(skin_color) + [255])
        else:
            vertex_color = skin_color
        mesh.visual.vertex_colors = np.tile(vertex_color, (vertices.shape[0], 1))
    # Assign texture as well
    mesh.visual = trimesh.visual.texture.TextureVisuals(uv=uv, image=np.array(texture_img))
    # Write OBJ with mtllib at the top and usemtl before faces
    try:
        with open(out_path, 'w') as obj_file:
            obj_file.write(f"mtllib {mtl_name}\nusemtl skin\n")
            mesh.export(obj_file, file_type='obj', include_texture=False)
    except Exception as e:
        print(f"[WARN] Failed to write OBJ: {e}")

    # Also export as GLB for web delivery (preferred)
    glb_path = os.path.splitext(out_path)[0] + '.glb'
    try:
        # trimesh can export GLB including textures when mesh.visual has TextureVisuals
        mesh.export(glb_path)
        print(f"[INFO] Exported GLB to {glb_path}")
        return glb_path
    except Exception as e:
        print(f"[WARN] GLB export failed: {e} - returning OBJ path")
        return out_path

def generate_avatar_silhouette(landmarks, mask_img, out_path):
    avatar = Image.new('RGBA', mask_img.size, (255,255,255,0))
    draw = ImageDraw.Draw(avatar)
    avatar.paste(mask_img, (0,0), mask_img)
    img_np = np.array(mask_img.convert('RGB'))
    avg_color = tuple(np.mean(img_np[img_np[:,:,0]>0], axis=0).astype(int)) if np.any(img_np[:,:,0]>0) else (200, 180, 160)
    overlay = Image.new('RGBA', mask_img.size, avg_color + (80,))
    avatar = Image.alpha_composite(avatar, overlay)
    highlight_indices = [11,12,23,24,25,26,27,28]
    for i in highlight_indices:
        if i < len(landmarks):
            x = int(landmarks[i].x * mask_img.width)
            y = int(landmarks[i].y * mask_img.height)
            draw.ellipse((x-8, y-8, x+8, y+8), fill=(255,0,0,128))
    for lm in landmarks:
        x = int(lm.x * mask_img.width)
        y = int(lm.y * mask_img.height)
        draw.ellipse((x-3, y-3, x+3, y+3), fill=(0,255,0,128))
    font = None
    try:
        from PIL import ImageFont
        font = ImageFont.truetype("arial.ttf", 18)
    except:
        font = None
    draw.text((10,10), "Body Shape & Structure", fill=(0,0,0,255), font=font)
    avatar.save(out_path)
    return out_path


