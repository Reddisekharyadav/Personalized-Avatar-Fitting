from fastapi import APIRouter

router = APIRouter(prefix="/garments")

@router.get("")
def list_garments():
    # ...existing code...
    return [{"id": "sku1", "title": "Tee", "brand": "BrandA", "category": "top", "size_map": {}, "colorways": {}, "images": [], "segmentation_masks": [], "affiliate_link": ""}]
