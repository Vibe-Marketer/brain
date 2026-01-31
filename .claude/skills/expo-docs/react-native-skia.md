# React Native Skia

High-performance 2D graphics using Skia. **Version: 2.0.3**

FULL documentation: https://shopify.github.io/react-native-skia/

## Canvas & Shapes

```tsx
import { Canvas, Circle, Rect, RoundedRect, Path, Skia } from '@shopify/react-native-skia';

function Shapes() {
  return (
    <Canvas style={{ width: 256, height: 256 }}>
      <Circle cx={50} cy={50} r={40} color="blue" />
      <Rect x={100} y={10} width={80} height={80} color="red" />
      <RoundedRect x={10} y={100} width={80} height={80} r={12} color="green" />
      <Path
        path="M 100 100 L 150 150 L 100 200 Z"
        color="purple"
        style="stroke"
        strokeWidth={3}
      />
    </Canvas>
  );
}
```

## Gradients & Effects

```tsx
import { Circle, LinearGradient, Shadow, Blur } from '@shopify/react-native-skia';

<Circle cx={100} cy={100} r={80}>
  <LinearGradient
    start={{ x: 0, y: 0 }}
    end={{ x: 200, y: 200 }}
    colors={['#ff0000', '#0000ff']}
  />
  <Shadow dx={5} dy={5} blur={10} color="rgba(0,0,0,0.5)" />
</Circle>

// Blur effect
<Circle cx={100} cy={100} r={50} color="blue">
  <Blur blur={5} />
</Circle>
```

## Images

```tsx
import { Canvas, Image, useImage } from '@shopify/react-native-skia';

function SkiaImage() {
  const image = useImage(require('./photo.png'));
  if (!image) return null;

  return (
    <Canvas style={{ flex: 1 }}>
      <Image
        image={image}
        x={0} y={0}
        width={200} height={200}
        fit="cover"
      />
    </Canvas>
  );
}
```

## Animations with Reanimated

Skia props accept shared values directly:

```tsx
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { Canvas, Circle } from '@shopify/react-native-skia';

function AnimatedCircle() {
  const cx = useSharedValue(50);
  const r = useSharedValue(30);

  const animate = () => {
    cx.value = withSpring(cx.value === 50 ? 150 : 50);
    r.value = withSpring(r.value === 30 ? 50 : 30);
  };

  return (
    <Pressable onPress={animate}>
      <Canvas style={{ width: 200, height: 100 }}>
        <Circle cx={cx} cy={50} r={r} color="blue" />
      </Canvas>
    </Pressable>
  );
}
```

## Gestures

Use `react-native-gesture-handler` (onTouch is deprecated in v2):

```tsx
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Canvas, Circle } from '@shopify/react-native-skia';

function DrawableCanvas() {
  const cx = useSharedValue(100);
  const cy = useSharedValue(100);

  const pan = Gesture.Pan().onChange((e) => {
    cx.value += e.changeX;
    cy.value += e.changeY;
  });

  return (
    <GestureDetector gesture={pan}>
      <Canvas style={{ flex: 1 }}>
        <Circle cx={cx} cy={cy} r={30} color="blue" />
      </Canvas>
    </GestureDetector>
  );
}
```

## Shaders (SKSL)

```tsx
import { Canvas, Fill, Shader, Skia, vec } from '@shopify/react-native-skia';

const source = Skia.RuntimeEffect.Make(`
  uniform vec2 center;
  uniform float radius;
  
  vec4 main(vec2 pos) {
    float d = distance(pos, center);
    float t = clamp(d / radius, 0.0, 1.0);
    return mix(vec4(1, 0, 0, 1), vec4(0, 0, 1, 1), t);
  }
`)!;

function GradientShader() {
  return (
    <Canvas style={{ width: 256, height: 256 }}>
      <Fill>
        <Shader
          source={source}
          uniforms={{ center: vec(128, 128), radius: 128 }}
        />
      </Fill>
    </Canvas>
  );
}
```

## Backdrop Filter (Frosted Glass)

```tsx
import { Canvas, Fill, BackdropFilter, Blur, RoundedRect } from '@shopify/react-native-skia';

<Canvas style={{ flex: 1 }}>
  <Fill color="lightblue" />
  <BackdropFilter
    clip={{ x: 20, y: 20, width: 200, height: 100 }}
    filter={<Blur blur={10} />}
  >
    <RoundedRect x={20} y={20} width={200} height={100} r={10} color="rgba(255,255,255,0.3)" />
  </BackdropFilter>
</Canvas>
```
