def extract_face_landmarks(image_path):
    """
    Extract facial landmarks using MediaPipe Face Mesh.
    Returns a list of (x, y) coordinates or None.
    """
    try:
        import mediapipe as mp
        image = Image.open(image_path).convert('RGB')
        img_np = np.array(image)
        # Obtain face_mesh module with compatibility fallbacks across mediapipe versions
        mp_face_mesh = None
        try:
            # Try the public API first (mediapipe.solutions.face_mesh)
            if hasattr(mp, 'solutions') and hasattr(mp.solutions, 'face_mesh'):
                mp_face_mesh = mp.solutions.face_mesh
            else:
                # Fallback to direct import which can exist in some installations
                from mediapipe.python.solutions import face_mesh as mp_face_mesh  # type: ignore
        except Exception:
            # Final fallback to top-level attribute on mediapipe (older versions)
            if hasattr(mp, 'face_mesh'):
                mp_face_mesh = mp.face_mesh
        if mp_face_mesh is None:
            raise ImportError("mediapipe face_mesh module not found")
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

import os
import mediapipe as mp
import numpy as np
from celery import Celery
from PIL import Image, ImageDraw

# 3D avatar imports
import torch
import smplx
import trimesh
from deepface import DeepFace

celery_app = Celery('worker', broker=os.getenv('REDIS_URL', 'redis://localhost:6379/0'))

def detect_gender(image_path):
    try:
        result = DeepFace.analyze(img_path=image_path, actions=['gender'], enforce_detection=False)
        # DeepFace can return dict or list depending on version
        if isinstance(result, list):
            result = result[0]
        
        # Try different possible keys
        gender = result.get('dominant_gender') or result.get('gender')
        
        # DeepFace returns 'Man'/'Woman' or 'male'/'female' depending on version
        if gender:
            gender_lower = str(gender).lower()
            if 'man' in gender_lower or 'male' in gender_lower:
                print(f"Detected gender: male (from {gender})")
                return 'male'
            else:
                print(f"Detected gender: female (from {gender})")
                return 'female'
        
        print("Gender detection: no gender in result, using female as default")
        return 'female'
    except Exception as e:
        print(f"Gender detection failed: {e}")
        print("Using female as fallback")
        return 'female'

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
    Create a simple 3D mesh from pose landmarks using trimesh.
    This bypasses SMPLX hand component issues by generating a basic body mesh directly.
    """
    import numpy as np
    
    # MediaPipe pose landmark indices for body keypoints
    # https://google.github.io/mediapipe/solutions/pose.html
    keypoint_indices = {
        'nose': 0,
        'left_eye_inner': 1, 'left_eye': 2, 'left_eye_outer': 3,
        'right_eye_inner': 4, 'right_eye': 5, 'right_eye_outer': 6,
        'left_ear': 7, 'right_ear': 8,
        'mouth_left': 9, 'mouth_right': 10,
        'left_shoulder': 11, 'right_shoulder': 12,
        'left_elbow': 13, 'right_elbow': 14,
        'left_wrist': 15, 'right_wrist': 16,
        'left_pinky': 17, 'right_pinky': 18,
        'left_index': 19, 'right_index': 20,
        'left_thumb': 21, 'right_thumb': 22,
        'left_hip': 23, 'right_hip': 24,
        'left_knee': 25, 'right_knee': 26,
        'left_ankle': 27, 'right_ankle': 28,
        'left_heel': 29, 'right_heel': 30,
        'left_foot_index': 31, 'right_foot_index': 32
    }
    
    # Extract 3D coordinates from landmarks
    # MediaPipe gives normalized coords (0-1), we need to scale them properly
    vertices = []
    for lm in landmarks:
        # Scale to world coordinates: multiply by 2 and center around origin
        # Y is inverted (MediaPipe Y goes down, we want Y up)
        x = (lm.x - 0.5) * 2.0  # -1 to 1
        y = -(lm.y - 0.5) * 2.0  # -1 to 1, inverted
        z = lm.z * 2.0           # depth
        vertices.append([x, y, z])
    
    vertices = np.array(vertices, dtype=np.float32)
    
        # Triangulate all pose landmarks in 2D (x, y) to create a solid mesh
        from scipy.spatial import Delaunay
        points2d = vertices[:, :2]  # use x, y for triangulation
        tri = Delaunay(points2d)
        faces = tri.simplices
    
    # Create mesh
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)

    # Center mesh at origin
    mesh.vertices -= mesh.centroid

    # Normalize mesh to fit within [-1, 1] in all axes
    bounds = mesh.bounds
    max_range = max(bounds[1] - bounds[0])
    if max_range > 0:
        mesh.vertices /= max_range / 2.0  # scale so largest dimension is 2 units

    # Optional: scale to 1.7 units tall (human height)
    bounds = mesh.bounds
    height = bounds[1][1] - bounds[0][1]
    if height > 0:
        mesh.vertices *= (1.7 / height)

    mesh.fix_normals()
    mesh.export(out_path)
    print(f"Generated 3D mesh: {len(vertices)} vertices, {len(faces)} faces")
    print(f"Final mesh bounds: {mesh.bounds}")
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
    # extract_body_shape returns (landmarks, mask_img, measurements, image_size)
    landmarks, mask_img, _measurements, _image_size = extract_body_shape(image_path)
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
    landmarks, mask_img, measurements, img_size = extract_body_shape(image_path)
    face_img = crop_face(image_path)
    face_landmarks = extract_face_landmarks(image_path)
    if landmarks is None:
        return {"error": "No person detected"}
    out_path = image_path.replace('.jpg', f'_{detected_gender}_avatar.obj').replace('.jpeg', f'_{detected_gender}_avatar.obj').replace('.png', f'_{detected_gender}_avatar.obj')
    obj_path = fit_smplx_to_landmarks(landmarks, model_path=model_path, gender=detected_gender, out_path=out_path)
    # Overlay default formal dress asset (placeholder)
    if formal_dress_asset and os.path.exists(formal_dress_asset):
        print(f"Overlaying formal dress asset: {formal_dress_asset}")
        # TODO: Implement mesh overlay logic (e.g., using trimesh or Blender)
    # Save face crop and face landmarks for testing
    if face_img:
        face_img.save(image_path.replace('.jpg', '_facecrop.png').replace('.jpeg', '_facecrop.png').replace('.png', '_facecrop.png'))
    if face_landmarks:
        import cv2
        img = cv2.imread(image_path)
        if img is None:
            print(f"Could not read image for drawing face landmarks: {image_path}")
        else:
            # Draw landmarks directly on the numpy image (avoids cv2.UMat typing/runtime issues)
            for (x, y) in face_landmarks:
                cv2.circle(img, (int(x), int(y)), 2, (0, 255, 0), -1)
            out_img = img
            cv2.imwrite(image_path.replace('.jpg', '_facelandmarks.png').replace('.jpeg', '_facelandmarks.png').replace('.png', '_facelandmarks.png'), out_img)
    return {
        "avatar_obj": obj_path,
        "gender": detected_gender,
        "face_crop": bool(face_img),
        "body_measurements": measurements,
        "face_landmarks": bool(face_landmarks)
    }

# Test block to run when script is executed directly
if __name__ == "__main__":
    sample_image = r"C:\Users\reddi\mango\project\game for internship\virtualdressing\services\ml\mrs.jpg"  # Place a test image in the same directory
    formal_dress_asset = r"C:\Users\reddi\mango\project\game for internship\virtualdressing\services\ml\assets\formal_dress.obj"  # Example asset path
    if os.path.exists(sample_image):
        print("--- 2D Avatar ---")
        result2d = process_user_image(sample_image)
        print("Avatar generation result:", result2d)
        print("--- 3D Avatar (Auto Gender, Face Crop, Formal Dress) ---")
        model_paths = {
            "male": r"C:\Users\reddi\mango\project\game for internship\virtualdressing\services\ml\models\models_lockedhead\smplx\SMPLX_MALE.npz",
            "female": r"C:\Users\reddi\mango\project\game for internship\virtualdressing\services\ml\models\models_lockedhead\smplx\SMPLX_FEMALE.npz",
            "neutral": r"C:\Users\reddi\mango\project\game for internship\virtualdressing\services\ml\models\models_lockedhead\smplx\SMPLX_NEUTRAL.npz"
        }
        result3d = process_user_image_3d_auto_gender(sample_image, model_paths, formal_dress_asset=formal_dress_asset)
        print("3D avatar OBJ result:", result3d)
    else:
        print(f"Test image '{sample_image}' not found. Please add a user photo named 'mrs.jpg' to test.")
