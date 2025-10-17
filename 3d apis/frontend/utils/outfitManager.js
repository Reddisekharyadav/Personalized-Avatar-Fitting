/**
 * Enhanced OutfitManager utility for better outfit positioning and attachment
 * This handles the complex task of properly overlaying outfits on avatars from ReadyPlayer
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// Configuration for different outfit types
const OUTFIT_TYPES = {
  FULL_BODY: {
    targetBone: 'Hips', // Attach to hips for full body outfits
    yOffset: 0,         // No vertical offset
    scale: 1.0,         // Default scale
    positionBias: { x: 0, y: 0, z: 0 }
  },
  TOP: {
    targetBone: 'Spine',
    yOffset: 0.05,      // Slight upward adjustment
    scale: 0.95,        // Slightly smaller to avoid clipping
    positionBias: { x: 0, y: 0.1, z: 0 } // Move up slightly
  },
  BOTTOM: {
    targetBone: 'Hips',
    yOffset: -0.05,     // Slight downward adjustment
    scale: 0.97,
    positionBias: { x: 0, y: -0.1, z: 0 } // Move down slightly
  },
  SHOES: {
    targetBone: 'LeftFoot', // We'll handle right foot separately
    yOffset: -0.02,
    scale: 1.0,
    positionBias: { x: 0, y: -0.02, z: 0 }
  },
  ACCESSORY: {
    targetBone: 'Head',
    yOffset: 0.1,
    scale: 0.9,
    positionBias: { x: 0, y: 0.1, z: 0 }
  }
};

// Utility to find bones in avatar model
const findBoneByName = (root, name) => {
  let result = null;
  root.traverse((obj) => {
    if (obj.isBone && obj.name === name) {
      result = obj;
    }
  });
  return result;
};

// Detect outfit type based on its geometry and name
const detectOutfitType = (outfitRoot) => {
  // Get the model name (for models that follow naming conventions)
  const modelName = outfitRoot.name?.toLowerCase() || '';
  
  // Count vertices to estimate outfit size
  let vertexCount = 0;
  outfitRoot.traverse((obj) => {
    if (obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position) {
      vertexCount += obj.geometry.attributes.position.count;
    }
  });
  
  // Check for keywords in model name
  if (
    modelName.includes('shirt') || 
    modelName.includes('top') || 
    modelName.includes('jacket') || 
    modelName.includes('tshirt')
  ) {
    return 'TOP';
  } else if (
    modelName.includes('pant') || 
    modelName.includes('trouser') || 
    modelName.includes('shorts') || 
    modelName.includes('skirt')
  ) {
    return 'BOTTOM';
  } else if (
    modelName.includes('shoe') || 
    modelName.includes('boot') || 
    modelName.includes('sneaker')
  ) {
    return 'SHOES';
  } else if (
    modelName.includes('hat') || 
    modelName.includes('glass') || 
    modelName.includes('necklace') || 
    modelName.includes('watch')
  ) {
    return 'ACCESSORY';
  }
  
  // Use vertex count as fallback heuristic
  if (vertexCount < 5000) {
    return 'ACCESSORY';
  } else if (vertexCount < 15000) {
    return 'TOP';
  } else {
    return 'FULL_BODY'; // Default to full body for large models
  }
};

// Calculate appropriate scale based on avatar and outfit bounding boxes
const calculateAppropriateScale = (avatarRoot, outfitRoot, outfitType) => {
  const avatarBox = new THREE.Box3().setFromObject(avatarRoot);
  const outfitBox = new THREE.Box3().setFromObject(outfitRoot);
  
  const avatarSize = new THREE.Vector3();
  avatarBox.getSize(avatarSize);
  
  const outfitSize = new THREE.Vector3();
  outfitBox.getSize(outfitSize);
  
  // Base scale calculation depends on outfit type
  let baseScale;
  
  // Variables for scale calculations
  let avatarChestWidth, avatarWaistWidth, avatarFootLength, avatarHeadSize, outfitWidth;
  
  switch (outfitType) {
    case 'TOP':
      // For tops, use the chest width as reference
      avatarChestWidth = avatarSize.x * 0.8;
      outfitWidth = outfitSize.x;
      baseScale = avatarChestWidth / outfitWidth;
      break;
    case 'BOTTOM':
      // For bottoms, use waist/hip width
      avatarWaistWidth = avatarSize.x * 0.7;
      baseScale = avatarWaistWidth / outfitSize.x;
      break;
    case 'SHOES':
      // For shoes, use foot length
      avatarFootLength = avatarSize.z * 0.2;
      baseScale = avatarFootLength / (outfitSize.z * 0.8);
      break;
    case 'ACCESSORY':
      // For accessories, use head size
      avatarHeadSize = avatarSize.y * 0.2;
      baseScale = avatarHeadSize / outfitSize.y;
      break;
    default:
      // For full body outfits, use height
      baseScale = avatarSize.y / outfitSize.y;
  }
  
  // Apply config scale modifier
  baseScale *= OUTFIT_TYPES[outfitType].scale;
  
  // Clamp to reasonable range
  const MIN_SCALE = 0.2;
  const MAX_SCALE = 5.0;
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, baseScale));
};

// Fix rotation issues common in outfits
const correctOutfitRotation = (outfitRoot, outfitType) => {
  // Many models need to be rotated to face forward
  if (outfitType === 'FULL_BODY' || outfitType === 'TOP' || outfitType === 'BOTTOM') {
    outfitRoot.rotation.y = Math.PI; // Rotate 180 degrees
  }
};

// Main function to attach outfit to avatar
const attachOutfitToAvatar = (avatarRoot, outfitRoot, userScale = 1.0, yOffset = 0) => {
  if (!avatarRoot || !outfitRoot) {
    console.error('Cannot attach outfit: missing avatar or outfit root');
    return null;
  }
  
  try {
    // Create a container for the outfit
    const outfitContainer = new THREE.Object3D();
    outfitContainer.name = 'OutfitContainer';
    
    // Add the outfit to the container
    outfitContainer.add(outfitRoot);
    
    // Detect the outfit type
    const outfitType = detectOutfitType(outfitRoot);
    console.log(`Detected outfit type: ${outfitType}`);
    
    // Get config for this outfit type
    const config = OUTFIT_TYPES[outfitType];
    
    // Calculate appropriate scale
    const baseScale = calculateAppropriateScale(avatarRoot, outfitRoot, outfitType);
    const finalScale = baseScale * userScale;
    
    // Apply scale to the container
    outfitContainer.scale.set(finalScale, finalScale, finalScale);
    
    // Correct outfit rotation
    correctOutfitRotation(outfitRoot, outfitType);
    
    // Find attachment bone in avatar
    const targetBone = findBoneByName(avatarRoot, config.targetBone);
    
    if (targetBone) {
      console.log(`Found target bone: ${config.targetBone}`);
      
      // Attach the outfit container to the target bone
      targetBone.add(outfitContainer);
      
      // Apply position adjustments from config plus user offset
      outfitContainer.position.x = config.positionBias.x;
      outfitContainer.position.y = config.positionBias.y + config.yOffset + yOffset;
      outfitContainer.position.z = config.positionBias.z;
      
      // For special cases like shoes that need to be duplicated
      if (outfitType === 'SHOES') {
        // Find right foot
        const rightFootBone = findBoneByName(avatarRoot, 'RightFoot');
        if (rightFootBone) {
          // Clone for right foot
          const rightShoe = outfitContainer.clone();
          rightShoe.scale.x *= -1; // Mirror for right foot
          rightFootBone.add(rightShoe);
        }
      }
      
      return outfitContainer;
    } else {
      console.warn(`Target bone ${config.targetBone} not found, attaching to avatar root`);
      
      // Calculate avatar center
      const avatarBox = new THREE.Box3().setFromObject(avatarRoot);
      const avatarCenter = new THREE.Vector3();
      avatarBox.getCenter(avatarCenter);
      
      // Reset outfit position to avatar center
      outfitContainer.position.set(
        avatarCenter.x + config.positionBias.x,
        avatarCenter.y + config.positionBias.y + config.yOffset + yOffset,
        avatarCenter.z + config.positionBias.z
      );
      
      // Add to avatar root
      avatarRoot.add(outfitContainer);
      return outfitContainer;
    }
  } catch (error) {
    console.error('Error attaching outfit to avatar:', error);
    return null;
  }
};

// Export the main function for use in components
export { attachOutfitToAvatar, detectOutfitType };

// Export an enhanced outfit loading function
export const loadAndAttachOutfit = async (scene, avatarRoot, outfitUrl, userScale = 1.0, yOffset = 0) => {
  if (!scene || !avatarRoot) {
    console.error('Cannot load outfit: missing scene or avatar');
    return null;
  }
  
  try {
    // Load the outfit GLTF
    const loader = new GLTFLoader();
    
    return new Promise((resolve, reject) => {
      loader.load(outfitUrl, (gltf) => {
        try {
          const outfitRoot = gltf.scene || gltf.scenes[0];
          
          if (!outfitRoot) {
            console.error('Invalid outfit model: missing scene');
            reject(new Error('Invalid outfit model'));
            return;
          }
          
          // Center the outfit before attaching
          const box = new THREE.Box3().setFromObject(outfitRoot);
          const center = new THREE.Vector3();
          box.getCenter(center);
          
          // Offset the outfit to center it at origin
          outfitRoot.position.x -= center.x;
          outfitRoot.position.y -= center.y;
          outfitRoot.position.z -= center.z;
          
          // Attach the outfit to the avatar
          const outfitContainer = attachOutfitToAvatar(avatarRoot, outfitRoot, userScale, yOffset);
          
          resolve(outfitContainer);
        } catch (error) {
          console.error('Error processing outfit:', error);
          reject(error);
        }
      }, undefined, (error) => {
        console.error('Error loading outfit:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('Error in loadAndAttachOutfit:', error);
    return null;
  }
};