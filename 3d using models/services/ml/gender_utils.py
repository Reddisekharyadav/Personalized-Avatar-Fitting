import cv2
import numpy as np
import os

def detect_gender(image_path, proto_path=None, model_path=None):
    """
    Detect gender using OpenCV DNN. Returns 'male', 'female', or 'neutral'.
    """
    # Use provided paths or default to models/ directory
    if proto_path is None:
        proto_path = os.path.join(os.path.dirname(__file__), "models", "deploy_gender.prototxt")
    if model_path is None:
        model_path = os.path.join(os.path.dirname(__file__), "models", "gender_net.caffemodel")
    if not os.path.exists(proto_path) or not os.path.exists(model_path):
        print(f"Gender model files not found at:\n{proto_path}\n{model_path}")
        return 'neutral'

    net = cv2.dnn.readNetFromCaffe(proto_path, model_path)
    gender_list = ['male', 'female']

    img = cv2.imread(image_path)
    if img is None:
        print("Image not found or cannot be read.")
        return 'neutral'

    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)

    if len(faces) == 0:
        print("No face detected. Using full image.")
        face_img = img.copy()
    else:
        # Use the largest detected face (main face)
        largest_face = max(faces, key=lambda rect: rect[2] * rect[3])
        (x, y, w, h) = largest_face
        face_img = img[y:y+h, x:x+w].copy()

    blob = cv2.dnn.blobFromImage(face_img, 1.0, (227, 227), (78.4263377603, 87.7689143744, 114.895847746), swapRB=False)
    net.setInput(blob)
    gender_preds = net.forward()
    print(f"Gender confidence scores: Male={gender_preds[0][0]:.4f}, Female={gender_preds[0][1]:.4f}")
    gender = gender_list[gender_preds[0].argmax()]
    return gender

def main():
    # Specify your exact model paths here
    sample_image = r"C:\Users\reddi\mango\project\game for internship\virtualdressing\services\ml\avatars\peakyblinders.jpg"
    proto_path = r"C:\Users\reddi\mango\project\game for internship\virtualdressing\services\ml\models\deploy_gender.prototxt"
    model_path = r"C:\Users\reddi\mango\project\game for internship\virtualdressing\services\ml\models\gender_net.caffemodel"
    gender = detect_gender(sample_image, proto_path=proto_path, model_path=model_path)
    print(f"Detected gender: {gender}")

if __name__ == "__main__":
    main()