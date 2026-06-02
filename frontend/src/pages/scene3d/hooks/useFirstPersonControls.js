import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { CAMERA_MODE_FIRST_PERSON } from '../../../constants/constants_ship_scene';

// These vectors are kept outside to avoid re-creation
const interiorLookDirection = new THREE.Vector3();
const interiorLookTarget = new THREE.Vector3();
const forwardMovement = new THREE.Vector3();
const movement = new THREE.Vector3();

export function useFirstPersonControls(threeContext, canvasRef, modeRef) { // <-- Accepts canvasRef object
  const interiorPoseRef = useRef({
    position: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    keys: new Set(),
    dragging: false,
    lastX: 0,
    lastY: 0,
    cameraMode: CAMERA_MODE_FIRST_PERSON,
  });

  const interiorCamera = threeContext?.interiorCamera;

  const updateInteriorOrientation = useCallback(() => {
    if (!interiorCamera) return;
    const interiorPose = interiorPoseRef.current;

    interiorLookDirection.set(
      Math.sin(interiorPose.yaw) * Math.cos(interiorPose.pitch),
      Math.sin(interiorPose.pitch),
      Math.cos(interiorPose.yaw) * Math.cos(interiorPose.pitch)
    );
    interiorLookTarget.copy(interiorPose.position).add(interiorLookDirection);
    interiorCamera.position.copy(interiorPose.position);
    interiorCamera.lookAt(interiorLookTarget);
    interiorCamera.updateProjectionMatrix();
  }, [interiorCamera]);

  const updateFirstPersonMovement = useCallback((deltaSeconds) => {
    if (modeRef.current !== 'interior' || 
        interiorPoseRef.current.cameraMode !== CAMERA_MODE_FIRST_PERSON || 
        interiorPoseRef.current.keys.size === 0) 
    {
      return;
    }
    const interiorPose = interiorPoseRef.current;

    forwardMovement.set(Math.sin(interiorPose.yaw), 0, Math.cos(interiorPose.yaw)).normalize();
    movement.set(0, 0, 0);

    if (interiorPose.keys.has('KeyW') || interiorPose.keys.has('ArrowUp')) {
      movement.add(forwardMovement);
    }
    if (interiorPose.keys.has('KeyS') || interiorPose.keys.has('ArrowDown')) {
      movement.sub(forwardMovement);
    }
    if (movement.lengthSq() <= 0) {
      return;
    }

    movement.normalize().multiplyScalar(deltaSeconds * 1.8);
    interiorPose.position.add(movement);
    updateInteriorOrientation();
  }, [modeRef, updateInteriorOrientation]);

  useEffect(() => {
    const canvas = canvasRef.current; // <-- Get canvas element inside useEffect
    if (!threeContext || !canvas) 
      return;

    const interiorPose = interiorPoseRef.current;

    const onPointerDown = (event) => {
      if (modeRef.current !== 'interior' || interiorPose.cameraMode !== CAMERA_MODE_FIRST_PERSON) return;
      interiorPose.dragging = true;
      interiorPose.lastX = event.clientX;
      interiorPose.lastY = event.clientY;
    };

    const onPointerMove = (event) => {
      if (modeRef.current !== 'interior' || interiorPose.cameraMode !== CAMERA_MODE_FIRST_PERSON || !interiorPose.dragging) return;
      const deltaX = event.clientX - interiorPose.lastX;
      const deltaY = event.clientY - interiorPose.lastY;
      interiorPose.lastX = event.clientX;
      interiorPose.lastY = event.clientY;

      interiorPose.yaw -= deltaX * 0.004;
      interiorPose.pitch -= deltaY * 0.003;
      interiorPose.pitch = THREE.MathUtils.clamp(interiorPose.pitch, -1.25, 1.25);
      updateInteriorOrientation();
    };

    const onPointerUp = () => {
      interiorPose.dragging = false;
    };

    const onKeyDown = (event) => {
      if (modeRef.current !== 'interior' || interiorPose.cameraMode !== CAMERA_MODE_FIRST_PERSON || !['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown'].includes(event.code)) return;
      interiorPose.keys.add(event.code);
      event.preventDefault();
    };

    const onKeyUp = (event) => {
      interiorPose.keys.delete(event.code);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [threeContext, canvasRef, modeRef, updateInteriorOrientation]);

  return {
    updateFirstPersonMovement,
    interiorPoseRef,
    updateInteriorOrientation,
  };
}