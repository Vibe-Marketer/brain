# React Native Gesture Handler

Native gesture handling with the Gesture API. **Version: ~2.24.0**

FULL documentation: https://docs.swmansion.com/react-native-gesture-handler/

## Pan Gesture (Dragging)

```tsx
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

function Draggable() {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const pan = Gesture.Pan()
    .onChange((e) => {
      // e.changeX/changeY = delta since last event
      translateX.value += e.changeX;
      translateY.value += e.changeY;
    })
    .onEnd((e) => {
      // e.velocityX/velocityY available for physics
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.box, style]} />
    </GestureDetector>
  );
}
```

## Pinch + Rotation (Image Viewer)

```tsx
function ImageViewer() {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedRotation = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const rotate = Gesture.Rotation()
    .onUpdate((e) => {
      rotation.value = savedRotation.value + e.rotation;
    })
    .onEnd(() => {
      savedRotation.value = rotation.value;
    });

  // Run both gestures simultaneously
  const composed = Gesture.Simultaneous(pinch, rotate);

  const style = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}rad` },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.Image source={source} style={[styles.image, style]} />
    </GestureDetector>
  );
}
```

## Gesture Composition

```tsx
// Simultaneous - all gestures active at once
Gesture.Simultaneous(pinch, rotate, pan)

// Exclusive - priority order, first one wins
Gesture.Exclusive(doubleTap, singleTap)

// Race - first to activate cancels others  
Gesture.Race(pan, longPress)
```

## Common Modifiers

```tsx
Gesture.Pan()
  .enabled(isEnabled)
  .minDistance(10)              // Min movement before activation
  .activeOffsetX([-10, 10])     // Horizontal activation threshold
  .failOffsetY([-5, 5])         // Fail if vertical movement exceeds this
  .maxPointers(1)               // Single finger only
```
