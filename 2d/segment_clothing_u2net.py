import os
import torch
from PIL import Image
import numpy as np
from torchvision import transforms

from u2net.model import U2NET  # This import works if you run from 2d folder

def norm_pred(d):
    ma = torch.max(d)
    mi = torch.min(d)
    dn = (d - mi) / (ma - mi)
    return dn

def segment_clothing_with_u2net(input_path, output_path, model_path):
    net = U2NET(3, 1)
    net.load_state_dict(torch.load(model_path, map_location='cpu'))
    net.eval()

    image = Image.open(input_path).convert('RGB')
    transform = transforms.Compose([
        transforms.Resize((320, 320)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    image_tensor = transform(image).unsqueeze(0)

    with torch.no_grad():
        d1, _, _, _, _, _, _ = net(image_tensor)
        pred = d1[:, 0, :, :]
        pred = norm_pred(pred)
        pred = pred.squeeze().cpu().numpy()

    # Resize mask to original image size
    mask = Image.fromarray((pred * 255).astype(np.uint8)).resize(image.size, resample=Image.BILINEAR)
    # Post-process: binarize mask to remove faint edges
    mask_np = np.array(mask)
    threshold = 128
    binary_mask = (mask_np > threshold).astype(np.uint8) * 255
    # Optionally, dilate/erode to clean up mask (requires cv2)
    try:
        import cv2
        kernel = np.ones((5,5), np.uint8)
        binary_mask = cv2.morphologyEx(binary_mask, cv2.MORPH_CLOSE, kernel)
    except ImportError:
        pass
    image_np = np.array(image)
    rgba = np.dstack((image_np, binary_mask))
    result = Image.fromarray(rgba, 'RGBA')
    result.save(output_path)
    print(f"[INFO] Saved segmented clothing to {output_path}")

if __name__ == "__main__":
    # Use the image downloaded by download_clothing_image.py
    input_path = "downloaded_clothing.jpg"
    output_path = "segmented_clothing.png"
    # Use standard U2Net weights (not portrait)
    model_path = r"C:\\Users\\reddi\\mango\\project\\game for internship\\virtualdressing\\2d\\model\\u2net.pth"
    segment_clothing_with_u2net(input_path, output_path, model_path)
