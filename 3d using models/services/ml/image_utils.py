def detect_faces(image_path):
    """
    Detect all face bounding boxes in the image using MediaPipe face detection.
    Returns a list of bounding boxes [(x1, y1, x2, y2), ...].
    """
    import mediapipe as mp
    from PIL import Image
    image = Image.open(image_path).convert('RGB')
    img_np = np.array(image)
    mp_face = mp.solutions.face_detection
    boxes = []
    with mp_face.FaceDetection(model_selection=1) as face_detection:
        results = face_detection.process(img_np)
        if results.detections:
            w, h = image.size
            for det in results.detections:
                box = det.location_data.relative_bounding_box
                x1 = int(box.xmin * w)
                y1 = int(box.ymin * h)
                x2 = int((box.xmin + box.width) * w)
                y2 = int((box.ymin + box.height) * h)
                boxes.append((x1, y1, x2, y2))
    return boxes
def analyze_face(image_path, box):
    """
    Given an image and a bounding box, crop the face and analyze skin and eye color.
    Returns dict with skin_color, eye_color, and cropped face image.
    """
    from PIL import Image
    import cv2
    image = Image.open(image_path).convert('RGB')
    face_img = image.crop(box)
    face_img_path = "_facecrop_temp.png"
    face_img.save(face_img_path)
    skin_color = extract_skin_color(face_img_path)
    eye_color = extract_eye_color(face_img_path)
    return {
        "skin_color": skin_color,
        "eye_color": eye_color,
        "face_img": face_img
    }
import mediapipe as mp
from PIL import Image
import numpy as np
import cv2

def extract_body_shape(image_path, save_intermediate=True):
    mp_pose = mp.solutions.pose
    mp_selfie_segmentation = mp.solutions.selfie_segmentation
    image = Image.open(image_path).convert('RGB')
    img_np = np.array(image)
    with mp_pose.Pose(static_image_mode=True) as pose, mp_selfie_segmentation.SelfieSegmentation(model_selection=1) as segmenter:
        results_pose = pose.process(img_np)
        results_seg = segmenter.process(img_np)
        if not results_pose.pose_landmarks:
            return None, None, None, None
        landmarks = results_pose.pose_landmarks.landmark
        mask = (results_seg.segmentation_mask > 0.5).astype(np.uint8) * 255
        mask_img = Image.fromarray(mask).resize(image.size)
        if save_intermediate:
            mask_img.save(image_path.replace('.jpg', '_bodymask.png').replace('.jpeg', '_bodymask.png').replace('.png', '_bodymask.png'))
        measurements = estimate_body_measurements(landmarks, image.size)
        with open(image_path.replace('.jpg', '_measurements.txt').replace('.jpeg', '_measurements.txt').replace('.png', '_measurements.txt'), 'w') as f:
            f.write(str(measurements))
        return landmarks, mask_img, measurements, image.size

def estimate_body_measurements(landmarks, image_size):
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
    l_shoulder = get_xy(idx['left_shoulder'])
    r_shoulder = get_xy(idx['right_shoulder'])
    shoulder_width = np.linalg.norm(np.array(l_shoulder) - np.array(r_shoulder))
    l_hip = get_xy(idx['left_hip'])
    r_hip = get_xy(idx['right_hip'])
    hip_width = np.linalg.norm(np.array(l_hip) - np.array(r_hip))
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
    try:
        image = Image.open(image_path).convert('RGB')
        img_np = np.array(image)
        mp_face = mp.solutions.face_detection
        with mp_face.FaceDetection(model_selection=1) as face_detection:
            results = face_detection.process(img_np)
            if results.detections:
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

def extract_face_landmarks(image_path):
    try:
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
        mp_face = mp.solutions.face_detection
        with mp_face.FaceDetection(model_selection=1) as face_detection:
            results = face_detection.process(img_np)
            if results.detections:
                box = results.detections[0].location_data.relative_bounding_box
                w, h = image.size
                x1 = int(box.xmin * w)
                y1 = int(box.ymin * h)
                x2 = int((box.xmin + box.width) * w)
                y2 = int((box.ymin + box.height) * h)
                return [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]
    except Exception as e:
        print(f"Face landmark extraction failed: {e}")
    return None

def extract_skin_color(image_path):
    coords = extract_face_landmarks(image_path)
    if coords is None:
        return (198, 134, 66)  # Default skin tone (light brown)
    image = cv2.imread(image_path)
    h, w, _ = image.shape
    left_cheek_idx = 234
    right_cheek_idx = 454
    sample_points = [coords[left_cheek_idx], coords[right_cheek_idx]]
    region_size = 10
    colors = []
    for x, y in sample_points:
        for dx in range(-region_size, region_size):
            for dy in range(-region_size, region_size):
                nx, ny = int(x + dx), int(y + dy)
                if 0 <= nx < w and 0 <= ny < h:
                    colors.append(image[ny, nx])
    if colors:
        avg_color = np.mean(colors, axis=0)
        return tuple(int(c) for c in avg_color)
    return None

def extract_eye_color(image_path):
    coords = extract_face_landmarks(image_path)
    image = cv2.imread(image_path)
    if coords is None:
        print("No face landmarks found for eye color extraction.")
        return None
    h, w, _ = image.shape
    left_iris_idx = 474
    right_iris_idx = 469
    sample_points = []
    # Try iris landmarks first
    if len(coords) > max(left_iris_idx, right_iris_idx):
        sample_points = [coords[left_iris_idx], coords[right_iris_idx]]
    else:
        print(f"Not enough landmarks for iris detection (found {len(coords)}) - using fallback eye region.")
        # Fallback: use eye mesh landmarks (left: 33, 133; right: 362, 263)
        fallback_indices = [33, 133, 362, 263]
        for idx in fallback_indices:
            if idx < len(coords):
                sample_points.append(coords[idx])
    colors = []
    region_size = 5
    for x, y in sample_points:
        for dx in range(-region_size, region_size):
            for dy in range(-region_size, region_size):
                nx, ny = int(x + dx), int(y + dy)
                if 0 <= nx < w and 0 <= ny < h:
                    colors.append(image[ny, nx])
    if colors:
        avg_color = np.mean(colors, axis=0)
        print(f"Eye color (sampled): {tuple(int(c) for c in avg_color)}")
        return tuple(int(c) for c in avg_color)
    print("No valid eye region found for color extraction.")
    return None

if __name__ == "__main__":
    sample_image = r"C:\Users\reddi\mango\project\game for internship\virtualdressing\services\ml\avatars\download.jpg"  # Change to your test image path
    print("Detecting all faces in image...")
    boxes = detect_faces(sample_image)
    print(f"Found {len(boxes)} face(s):", boxes)
    for i, box in enumerate(boxes):
        print(f"Analyzing face {i+1} at box {box}...")
        result = analyze_face(sample_image, box)
        print(f"Face {i+1} skin color: {result['skin_color']}")
        print(f"Face {i+1} eye color: {result['eye_color']}")
    print("Testing body shape and measurements...")
    body_result = extract_body_shape(sample_image)
    print("Body shape result:", body_result)
    if body_result and body_result[0] is not None:
        measurements = estimate_body_measurements(body_result[0], body_result[3])
        print("Body measurements:", measurements)
import mediapipe as mp
from PIL import Image
def extract_body_shape(image_path, save_intermediate=True):
    mp_pose = mp.solutions.pose
    mp_selfie_segmentation = mp.solutions.selfie_segmentation
    image = Image.open(image_path).convert('RGB')
    img_np = np.array(image)
    with mp_pose.Pose(static_image_mode=True) as pose, mp_selfie_segmentation.SelfieSegmentation(model_selection=1) as segmenter:
        results_pose = pose.process(img_np)
        results_seg = segmenter.process(img_np)
        if not results_pose.pose_landmarks:
            return None, None, None, None
        landmarks = results_pose.pose_landmarks.landmark
        mask = (results_seg.segmentation_mask > 0.5).astype(np.uint8) * 255
        mask_img = Image.fromarray(mask).resize(image.size)
        if save_intermediate:
            mask_img.save(image_path.replace('.jpg', '_bodymask.png').replace('.jpeg', '_bodymask.png').replace('.png', '_bodymask.png'))
        measurements = estimate_body_measurements(landmarks, image.size)
        with open(image_path.replace('.jpg', '_measurements.txt').replace('.jpeg', '_measurements.txt').replace('.png', '_measurements.txt'), 'w') as f:
            f.write(str(measurements))
        return landmarks, mask_img, measurements, image.size
import numpy as np
from PIL import Image
def estimate_body_measurements(landmarks, image_size):
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
    l_shoulder = get_xy(idx['left_shoulder'])
    r_shoulder = get_xy(idx['right_shoulder'])
    shoulder_width = np.linalg.norm(np.array(l_shoulder) - np.array(r_shoulder))
    l_hip = get_xy(idx['left_hip'])
    r_hip = get_xy(idx['right_hip'])
    hip_width = np.linalg.norm(np.array(l_hip) - np.array(r_hip))
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
    try:
        import mediapipe as mp
        image = Image.open(image_path).convert('RGB')
        img_np = np.array(image)
        mp_face = mp.solutions.face_detection
        with mp_face.FaceDetection(model_selection=1) as face_detection:
            results = face_detection.process(img_np)
            if results.detections:
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
import cv2
import numpy as np
from PIL import Image
import mediapipe as mp
import cv2
import numpy as np
from PIL import Image
def extract_face_landmarks(image_path):
    try:
       
        image = Image.open(image_path).convert('RGB')
        img_np = np.array(image)
        # Try Face Mesh
        mp_face_mesh = mp.solutions.face_mesh
        with mp_face_mesh.FaceMesh(static_image_mode=True) as face_mesh:
            results = face_mesh.process(img_np)
            if results.multi_face_landmarks:
                landmarks = results.multi_face_landmarks[0].landmark
                w, h = image.size
                coords = [(int(lm.x * w), int(lm.y * h)) for lm in landmarks]
                return coords
        # Try Face Detection
        mp_face = mp.solutions.face_detection
        with mp_face.FaceDetection(model_selection=1) as face_detection:
            results = face_detection.process(img_np)
            if results.detections:
                box = results.detections[0].location_data.relative_bounding_box
                w, h = image.size
                x1 = int(box.xmin * w)
                y1 = int(box.ymin * h)
                x2 = int((box.xmin + box.width) * w)
                y2 = int((box.ymin + box.height) * h)
                # Return corners of bounding box as pseudo-landmarks
                return [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]
    except Exception as e:
        print(f"Face landmark extraction failed: {e}")
    return None

def extract_skin_color(image_path):
    coords = extract_face_landmarks(image_path)
    if coords is None:
        return (198, 134, 66)  # Default skin tone (light brown)
    image = cv2.imread(image_path)
    h, w, _ = image.shape
    left_cheek_idx = 234
    right_cheek_idx = 454
    sample_points = [coords[left_cheek_idx], coords[right_cheek_idx]]
    region_size = 10
    colors = []
    for x, y in sample_points:
        for dx in range(-region_size, region_size):
            for dy in range(-region_size, region_size):
                nx, ny = int(x + dx), int(y + dy)
                if 0 <= nx < w and 0 <= ny < h:
                    colors.append(image[ny, nx])
    if colors:
        avg_color = np.mean(colors, axis=0)
        return tuple(int(c) for c in avg_color)
    return None

def extract_eye_color(image_path):
    coords = extract_face_landmarks(image_path)
    image = cv2.imread(image_path)
    if coords is None:
        print("No face landmarks found for eye color extraction.")
        return None
    h, w, _ = image.shape
    left_iris_idx = 474
    right_iris_idx = 469
    sample_points = []
    # Try iris landmarks first
    if len(coords) > max(left_iris_idx, right_iris_idx):
        sample_points = [coords[left_iris_idx], coords[right_iris_idx]]
    else:
        print(f"Not enough landmarks for iris detection (found {len(coords)}) - using fallback eye region.")
        # Fallback: use eye mesh landmarks (left: 33, 133; right: 362, 263)
        fallback_indices = [33, 133, 362, 263]
        for idx in fallback_indices:
            if idx < len(coords):
                sample_points.append(coords[idx])
    colors = []
    region_size = 5
    for x, y in sample_points:
        for dx in range(-region_size, region_size):
            for dy in range(-region_size, region_size):
                nx, ny = int(x + dx), int(y + dy)
                if 0 <= nx < w and 0 <= ny < h:
                    colors.append(image[ny, nx])
    if colors:
        avg_color = np.mean(colors, axis=0)
        print(f"Eye color (sampled): {tuple(int(c) for c in avg_color)}")
        return tuple(int(c) for c in avg_color)
    print("No valid eye region found for color extraction.")
    return None

def crop_face(image_path):
    try:
        import mediapipe as mp
        image = Image.open(image_path).convert('RGB')
        img_np = np.array(image)
        mp_face = mp.solutions.face_detection
        with mp_face.FaceDetection(model_selection=1) as face_detection:
            results = face_detection.process(img_np)
            if results.detections:
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


