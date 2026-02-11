# React Native Reanimated

Performant animations running on the UI thread. **Version: 3.17.4**

FULL documentation: https://docs.swmansion.com/react-native-reanimated/

## Basic Animation

```tsx
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

function AnimatedBox() {
  // useSharedValue creates a value that lives on the UI thread.
  // Unlike useState, changing it does NOT cause re-renders.
  const offset = useSharedValue(0);
  const scale = useSharedValue(1);

  // useAnimatedStyle returns styles that update automatically when shared values change.
  // The callback is a "worklet" - it runs on the UI thread, not JS thread.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offset.value },
      { scale: scale.value },
    ],
  }));

  const handlePress = () => {
    // withSpring/withTiming animate the value change
    offset.value = withSpring(100, { damping: 10, stiffness: 100 });
    scale.value = withTiming(1.5, { duration: 300 });
  };

  // Must use Animated.View (not regular View) to apply animated styles
  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.box, animatedStyle]} />
    </Pressable>
  );
}
```

## Worklets and runOnJS

Worklets are functions that run on the UI thread. Most Reanimated callbacks are automatically worklets. But if you need to call regular JS code (like showing an alert or updating React state), use `runOnJS`:

```tsx
function DraggableWithFeedback() {
  const translateX = useSharedValue(0);
  const [dragCount, setDragCount] = useState(0);

  const pan = Gesture.Pan()
    .onChange((e) => {
      // This runs on UI thread (worklet) - can access shared values directly
      translateX.value += e.changeX;
    })
    .onEnd(() => {
      // Can't call setDragCount directly here - it's a JS function
      // runOnJS bridges back to the JS thread
      runOnJS(setDragCount)(dragCount + 1);
      translateX.value = withSpring(0);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style} />
    </GestureDetector>
  );
}
```

You can also write custom worklets with the `'worklet'` directive:

```tsx
const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

// Now usable inside useAnimatedStyle, gesture callbacks, etc.
const style = useAnimatedStyle(() => ({
  opacity: clamp(offset.value / 100, 0, 1),
}));
```

## Derived Values

When you need a value computed from other shared values, use `useDerivedValue`. It recalculates on the UI thread whenever dependencies change:

```tsx
function ZoomableImage() {
  const scale = useSharedValue(1);
  
  // Automatically updates when scale changes
  const borderRadius = useDerivedValue(() => 20 / scale.value);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderRadius: borderRadius.value,
  }));

  return <Animated.Image style={style} source={source} />;
}
```

## Animating Non-Style Props

For props that aren't styles (like SVG attributes or TextInput value), use `useAnimatedProps`:

```tsx
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function PulsatingCircle() {
  const radius = useSharedValue(50);

  useEffect(() => {
    radius.value = withRepeat(withTiming(80, { duration: 1000 }), -1, true);
  }, []);

  // animatedProps for non-style attributes
  const animatedProps = useAnimatedProps(() => ({
    r: radius.value,
  }));

  return (
    <Svg>
      <AnimatedCircle cx={100} cy={100} fill="blue" animatedProps={animatedProps} />
    </Svg>
  );
}
```

## Animation Functions

```tsx
// Spring physics (bouncy)
offset.value = withSpring(100, { damping: 10, stiffness: 100 });

// Timed with optional easing
offset.value = withTiming(100, { duration: 300 });

// Decay (momentum, useful after gestures)
offset.value = withDecay({ velocity: gestureVelocity, deceleration: 0.998 });

// Repeat: -1 = infinite, third param = reverse
rotation.value = withRepeat(withTiming(360, { duration: 1000 }), -1);

// Sequence multiple animations
offset.value = withSequence(
  withTiming(100, { duration: 200 }),
  withTiming(0, { duration: 200 }),
);

// Delay
offset.value = withDelay(500, withSpring(100));
```

## Layout Animations

Layout animations allow you to animate entering or exiting of a component which can be super useful. Example: Fade in/out a component when it is added to or removed from a list.

```tsx
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';

function TodoList({ items, onRemove }) {
  return (
    <View>
      {items.map((item) => (
        <Animated.View
          key={item.id}
          entering={FadeIn}           // Animates when added to list
          exiting={FadeOut}           // Animates when removed
          layout={Layout.springify()} // Animates position changes
        >
          <Text>{item.text}</Text>
        </Animated.View>
      ))}
    </View>
  );
}
```
