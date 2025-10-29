import os
from image_utils import detect_faces, analyze_face, extract_body_shape
from avatar_utils import fit_smplx_to_landmarks, estimate_body_measurements
from gender_utils import detect_gender

def main(image_path):
    print(f"Processing image: {image_path}")
    # Detect faces
    boxes = detect_faces(image_path)
    print(f"Found {len(boxes)} face(s): {boxes}")
    face_results = []
    for i, box in enumerate(boxes):
        print(f"Analyzing face {i+1} at box {box}...")
        result = analyze_face(image_path, box)
        print(f"Face {i+1} skin color: {result['skin_color']}")
        print(f"Face {i+1} eye color: {result['eye_color']}")
        face_results.append(result)
    # Detect gender
    gender = detect_gender(image_path)
    print(f"Detected gender: {gender}")
    # Body shape and measurements
    print("Testing body shape and measurements...")
    body_result = extract_body_shape(image_path)
    print("Body shape result:", body_result)
    if body_result and body_result[0] is not None:
        measurements = estimate_body_measurements(body_result[0], body_result[3])
        print("Body measurements:", measurements)
    # Optionally fit SMPL-X avatar (stub, requires model path)
    # model_path = 'path/to/smplx/model.npz'
    # fit_smplx_to_landmarks(body_result[0], model_path, gender=gender, out_path='avatar.obj', image_path=image_path, skin_color=face_results[0]['skin_color'], eye_color=face_results[0]['eye_color'])

if __name__ == "__main__":
    # Change to your test image path
    sample_image = r"C:\Users\reddi\mango\project\game for internship\virtualdressing\services\ml\avatars\download.jpg"
    main(sample_image)
