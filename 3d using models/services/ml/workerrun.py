import os
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
import mediapipe as mp
import numpy as np
from celery import Celery
from PIL import Image, ImageDraw

# 3D avatar imports
import torch
import smplx
import trimesh
from deepface import DeepFace

def extract_face_landmarks(image_path):
    """
    Extract facial landmarks using MediaPipe Face Mesh.
    Returns a list of (x, y) coordinates or None.
    """
    try:
        import mediapipe as mp
        image = Image.open(image_path).convert('RGB')
        img_np = np.array(image)
        mp_face_mesh = mp.solutions.face_mesh
        with mp_face_mesh.FaceMesh(static_image_mode=True) as face_mesh:
            results = face_mesh.process(img_np)
            if results.multi_face_landmarks:
                landmarks = results.multi_face_landmarks[0].landmark
                w, h = image.size
                coords = [(int(lm.x * w), int(lm.y * h)) for lm in landmarks]
                return coords
    except Exception as e:
        print(f"Face mesh extraction failed: {e}")
    return None
def estimate_body_measurements(landmarks, image_size):
    """
    Estimate basic body measurements from pose landmarks.
    Returns a dict of measurements in pixels.
    """
    # MediaPipe pose landmark indices
    # https://google.github.io/mediapipe/solutions/pose.html#pose-landmark-model-blazepose-ghum-3d
    idx = {
        'left_shoulder': 11,
        'right_shoulder': 12,
        'left_hip': 23,
        'right_hip': 24,
        'left_elbow': 13,
        'right_elbow': 14,
        'left_wrist': 15,
        'right_wrist': 16,
        'left_knee': 25,
        'right_knee': 26,
        'left_ankle': 27,
        'right_ankle': 28,
    }
    def get_xy(i):
        lm = landmarks[i]
        return (lm.x * image_size[0], lm.y * image_size[1])
    # Shoulders
    l_shoulder = get_xy(idx['left_shoulder'])
    r_shoulder = get_xy(idx['right_shoulder'])
    shoulder_width = np.linalg.norm(np.array(l_shoulder) - np.array(r_shoulder))
    # Hips
    l_hip = get_xy(idx['left_hip'])
    r_hip = get_xy(idx['right_hip'])
    hip_width = np.linalg.norm(np.array(l_hip) - np.array(r_hip))
    # Height (shoulder to ankle)
    mid_shoulder = ((l_shoulder[0] + r_shoulder[0]) / 2, (l_shoulder[1] + r_shoulder[1]) / 2)
    mid_ankle = ((get_xy(idx['left_ankle'])[0] + get_xy(idx['right_ankle'])[0]) / 2,
                 (get_xy(idx['left_ankle'])[1] + get_xy(idx['right_ankle'])[1]) / 2)
    height = np.linalg.norm(np.array(mid_shoulder) - np.array(mid_ankle))
    return {
        'shoulder_width': shoulder_width,
        'hip_width': hip_width,
        'height': height
    }
def crop_face(image_path):
    """
    Crop the face region from the image using MediaPipe face detection.
    Returns a PIL Image of the cropped face or None.
    """
    try:
        import mediapipe as mp
        image = Image.open(image_path).convert('RGB')
        img_np = np.array(image)
        mp_face = mp.solutions.face_detection
        with mp_face.FaceDetection(model_selection=1) as face_detection:
            results = face_detection.process(img_np)
            if results.detections:
                # Get bounding box of first detected face
                box = results.detections[0].location_data.relative_bounding_box
                w, h = image.size
                x1 = int(box.xmin * w)
                y1 = int(box.ymin * h)
                x2 = int((box.xmin + box.width) * w)
                y2 = int((box.ymin + box.height) * h)
                face_img = image.crop((x1, y1, x2, y2))
                return face_img
    except Exception as e:
        print(f"Face crop failed: {e}")
    return None


celery_app = Celery('worker', broker=os.getenv('REDIS_URL', 'redis://localhost:6379/0'))

def detect_gender(image_path):
    try:
        result = DeepFace.analyze(img_path=image_path, actions=['gender'], enforce_detection=False)
        gender = result['gender']
        # DeepFace returns 'Man' or 'Woman'
        if gender.lower().startswith('m'):
            return 'male'
        else:
            return 'female'
    except Exception as e:
        print(f"Gender detection failed: {e}")
        return 'neutral'

def extract_body_shape(image_path, save_intermediate=True):
    mp_pose = mp.solutions.pose
    mp_selfie_segmentation = mp.solutions.selfie_segmentation
    image = Image.open(image_path).convert('RGB')
    img_np = np.array(image)
    with mp_pose.Pose(static_image_mode=True) as pose, mp_selfie_segmentation.SelfieSegmentation(model_selection=1) as segmenter:
        results_pose = pose.process(img_np)
        results_seg = segmenter.process(img_np)
        # Get landmarks
        if not results_pose.pose_landmarks:
            return None, None, None, None
        landmarks = results_pose.pose_landmarks.landmark
        # Get segmentation mask
        mask = (results_seg.segmentation_mask > 0.5).astype(np.uint8) * 255
        mask_img = Image.fromarray(mask).resize(image.size)
        # Save intermediate results for testing
        if save_intermediate:
            mask_img.save(image_path.replace('.jpg', '_bodymask.png').replace('.jpeg', '_bodymask.png').replace('.png', '_bodymask.png'))
        # Estimate body measurements
        measurements = estimate_body_measurements(landmarks, image.size)
        # Save measurements
        with open(image_path.replace('.jpg', '_measurements.txt').replace('.jpeg', '_measurements.txt').replace('.png', '_measurements.txt'), 'w') as f:
            f.write(str(measurements))
        return landmarks, mask_img, measurements, image.size

# --- 3D Avatar Generation ---
def fit_smplx_to_landmarks(landmarks, model_path, gender="neutral", out_path="avatar.obj"):
    """
    Fit SMPL-X model to pose landmarks and export as OBJ.
    Requires SMPL-X model file at model_path.
    """
    # Prepare SMPL-X model
    model = smplx.SMPLX(model_path=os.path.dirname(model_path),
        model_type='smplx',
        gender=gender,
        use_face_contour=False,
        ext='npz')
    # Estimate body pose from landmarks (simple heuristic)
    # For demo: use T-pose, set shape params to zero
    betas = torch.zeros([1, 10])
    body_pose = torch.zeros([1, 21, 3])
    global_orient = torch.zeros([1, 3])
    transl = torch.zeros([1, 3])
    output = model(betas=betas, body_pose=body_pose, global_orient=global_orient, transl=transl)
    vertices = output.vertices.detach().cpu().numpy().squeeze()
    faces = model.faces
    # Export mesh as OBJ
    mesh = trimesh.Trimesh(vertices, faces, process=False)
    mesh.export(out_path)
    return out_path

def generate_avatar_silhouette(landmarks, mask_img, out_path):
    # Draw a simple silhouette based on mask and landmarks
    avatar = Image.new('RGBA', mask_img.size, (255,255,255,0))
    draw = ImageDraw.Draw(avatar)
    # Paste mask as silhouette
    avatar.paste(mask_img, (0,0), mask_img)
    # Optionally draw keypoints
    for lm in landmarks:
        x = int(lm.x * mask_img.width)
        y = int(lm.y * mask_img.height)
        draw.ellipse((x-3, y-3, x+3, y+3), fill=(0,255,0,128))
    avatar.save(out_path)
    return out_path

@celery_app.task
def process_user_image(image_path):
    """
    1. Takes image from user (local path)
    2. Extracts body shape (pose + segmentation)
    3. Generates a stylized avatar silhouette PNG
    """
    AVATAR_SUFFIX = '_avatar.png'
    landmarks, mask_img, measurements, img_size = extract_body_shape(image_path)
    if landmarks is None:
        return {"error": "No person detected"}
    out_path = image_path.replace('.jpg', AVATAR_SUFFIX).replace('.jpeg', AVATAR_SUFFIX).replace('.png', AVATAR_SUFFIX)
    avatar_path = generate_avatar_silhouette(landmarks, mask_img, out_path)
    return {"avatar_path": avatar_path}

# --- 3D Avatar Celery Task ---
@celery_app.task
def process_user_image_3d_auto_gender(image_path, model_paths, formal_dress_asset=None):
    """
    1. Takes image from user (local path)
    2. Detects gender from photo
    3. Extracts body shape (pose landmarks)
    4. Crops face region (for future face mapping)
    5. Fits SMPL-X model and exports 3D avatar OBJ
    6. Overlays default formal dress asset (if provided)
    """
    detected_gender = detect_gender(image_path)
    print(f"Detected gender: {detected_gender}")
    model_path = model_paths.get(detected_gender, model_paths['neutral'])
    print(f"Using SMPL-X model path: {model_path}")
    landmarks, mask_img, measurements, img_size = extract_body_shape(image_path)
    print(f"Body shape extraction: landmarks={landmarks is not None}, mask_img={mask_img is not None}, measurements={measurements}, img_size={img_size}")
    if landmarks is None:
        print("No person detected in image.")
        return {"error": "No person detected"}
    face_img = crop_face(image_path)
    print(f"Face crop: {face_img is not None}")
    face_landmarks = extract_face_landmarks(image_path)
    print(f"Face landmarks: {face_landmarks is not None}")
    out_path = image_path.replace('.jpg', f'_{detected_gender}_avatar.obj').replace('.jpeg', f'_{detected_gender}_avatar.obj').replace('.png', f'_{detected_gender}_avatar.obj')
    obj_path = fit_smplx_to_landmarks(landmarks, model_path=model_path, gender=detected_gender, out_path=out_path)
    # Overlay default formal dress asset (placeholder)
    if formal_dress_asset and os.path.exists(formal_dress_asset):
        print(f"Overlaying formal dress asset: {formal_dress_asset}")
        # TODO: Implement mesh overlay logic (e.g., using trimesh or Blender)
    # Save face crop and face landmarks for testing
    if face_img:
        face_img.save(image_path.replace('.jpg', '_facecrop.png').replace('.jpeg', '_facecrop.png').replace('.png', '_facecrop.png'))
    return {"avatar_obj": obj_path, "gender": detected_gender, "measurements": measurements}

if __name__ == "__main__":
    sample_image = r"C:\Users\reddi\mango\project\game for internship\virtualdressing\services\ml\avatars\peakyblinders.jpg"  # Place a test image in the same directory
    if os.path.exists(sample_image):
        print("--- 2D Avatar ---")
        result2d = process_user_image(sample_image)
        print("Avatar generation result:", result2d)
        print("--- 3D Avatar (Auto Gender, Face Crop, Formal Dress) ---")
        model_paths = {
            "male": r"C:\Users\reddi\mango\project\game for internship\virtualdressing\services\ml\models\SMPLX_MALE.npz",
            "female": r"C:\Users\reddi\mango\project\game for internship\virtualdressing\services\ml\models\SMPLX_FEMALE.npz",
            "neutral": r"C:\Users\reddi\mango\project\game for internship\virtualdressing\services\ml\models\SMPLX_NEUTRAL.npz"
        }
        formal_dress_asset = None
        result3d = process_user_image_3d_auto_gender(sample_image, model_paths, formal_dress_asset=formal_dress_asset)
        print("3D avatar OBJ result:", result3d)
        # Visualize the generated OBJ file if available
        import trimesh
        from PIL import Image
        import numpy as np
        # --- Visualization ---
        if result3d and "avatar_obj" in result3d:
            obj_path = result3d["avatar_obj"]
            if obj_path and os.path.exists(obj_path):
                print(f"Visualizing generated OBJ file: {obj_path}")
                try:
                    mesh = trimesh.load(obj_path)
                    # --- Realistic Face and Dress Texture Mapping ---
                    from PIL import Image
                    import numpy as np
                    texture_size = (512, 512)
                    texture = Image.new('RGB', texture_size, color=(224, 172, 150)) # skin base

                    # Overlay cropped face (if available)
                    base, _ = os.path.splitext(sample_image)
                    face_crop_path = f"{base}_facecrop.png"
                    if os.path.exists(face_crop_path):
                        face_img = Image.open(face_crop_path).resize((180, 180))
                        # Paste face onto upper center (head region)
                        texture.paste(face_img, (166, 20))

                    # Overlay dress image (if provided)
                    dress_img_path = os.path.join(os.path.dirname(sample_image), "dress_image.jpeg") # User should upload this
                    if os.path.exists(dress_img_path):
                        dress_img = Image.open(dress_img_path).convert("RGBA").resize((300, 400))
                        # Paste dress onto body region (roughly center)
                        texture.paste(dress_img, (106, 112), dress_img)

                    texture_np = np.array(texture)
                    if texture_np.dtype != np.uint8:
                        texture_np = texture_np.astype(np.uint8)
                    mesh.visual = trimesh.visual.texture.TextureVisuals(image=texture_np)
                    mesh.show()
                except Exception as e:
                    print(f"Failed to show mesh. Trimesh may require a display environment. Error: {e}")
            else:
                print("OBJ file not found for visualization.")
        else:
            print("3D avatar generation failed or returned None.")
    else:
        print("Test image not found. Please add a user photo named 'mamitha_10.jpg' to test.")


