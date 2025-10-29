from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, JSON, ARRAY
from sqlalchemy.ext.declarative import declarative_base
import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    auth_provider = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Profile(Base):
    __tablename__ = 'profiles'
    user_id = Column(String, ForeignKey('users.id'), primary_key=True)
    height_cm = Column(Float)
    weight_kg = Column(Float)
    gender = Column(String)
    skin_tone = Column(String)
    measurement_bundle_id = Column(String)

class Photo(Base):
    __tablename__ = 'photos'
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey('users.id'))
    s3_key_raw = Column(String)
    s3_key_proc = Column(String)
    width = Column(Integer)
    height = Column(Integer)
    pose_score = Column(Float)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Measurement(Base):
    __tablename__ = 'measurements'
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey('users.id'))
    jsonb = Column(JSON)
    model_version = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Avatar(Base):
    __tablename__ = 'avatars'
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey('users.id'))
    type = Column(String)
    style = Column(String)
    s3_key_preview = Column(String)
    s3_key_source = Column(String)
    smpl_params = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Garment(Base):
    __tablename__ = 'garments'
    id = Column(String, primary_key=True)
    sku = Column(String)
    title = Column(String)
    brand = Column(String)
    category = Column(String)
    gender = Column(String)
    size_map = Column(JSON)
    colorways = Column(JSON)
    images = Column(JSON)
    segmentation_masks = Column(JSON)
    three_d_asset = Column(String)
    affiliate_link = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class TryonSession(Base):
    __tablename__ = 'tryon_sessions'
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey('users.id'))
    avatar_id = Column(String, ForeignKey('avatars.id'))
    garment_ids = Column(ARRAY(String))
    result_previews = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Event(Base):
    __tablename__ = 'events'
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey('users.id'))
    type = Column(String)
    payload = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
