import { useEffect, useRef, useState } from "react";
import "./pixel-cat.css";
import {
  CAT_HEIGHT,
  CAT_PIXEL_UNIT,
  CAT_WIDTH,
  FRAME_A_SHADOW,
  FRAME_B_SHADOW,
} from "./pixelCatSprite";

const JOKES = [
  "Why do programmers prefer dark mode? Because light attracts bugs.",
  "There are only 10 types of people: those who understand binary and those who don't.",
  "A SQL query walks into a bar, walks up to two tables and asks: 'Can I join you?'",
  "Why do Java developers wear glasses? Because they don't see sharp.",
  "I'd tell you a UDP joke, but you might not get it.",
  "!false — it's funny because it's true.",
  "How many programmers does it take to change a light bulb? None, that's a hardware problem.",
  "99 little bugs in the code, 99 little bugs. Take one down, patch it around — 127 little bugs in the code.",
  "I have a joke about recursion, but to understand it you need to understand recursion first.",
] as const;

const BUBBLE_INTERVAL_MS = 9000;
const BUBBLE_VISIBLE_MS = 4200;
const FIRST_BUBBLE_DELAY_MS = 3000;

export function PixelCat() {
  const [joke, setJoke] = useState<string>(JOKES[0]);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const lastIndexRef = useRef(0);

  useEffect(() => {
    let hideTimeout: ReturnType<typeof setTimeout>;

    const showJoke = () => {
      let next = Math.floor(Math.random() * JOKES.length);
      if (JOKES.length > 1) {
        while (next === lastIndexRef.current) {
          next = Math.floor(Math.random() * JOKES.length);
        }
      }
      lastIndexRef.current = next;
      setJoke(JOKES[next]);
      setBubbleVisible(true);
      hideTimeout = setTimeout(() => setBubbleVisible(false), BUBBLE_VISIBLE_MS);
    };

    const initialDelay = setTimeout(showJoke, FIRST_BUBBLE_DELAY_MS);
    const interval = setInterval(showJoke, BUBBLE_INTERVAL_MS);

    return () => {
      clearTimeout(initialDelay);
      clearTimeout(hideTimeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="cv-cat-stage" aria-hidden="true">
      <style>{`
        @keyframes cv-leg-cycle {
          0% { box-shadow: ${FRAME_A_SHADOW}; }
          49.9% { box-shadow: ${FRAME_A_SHADOW}; }
          50% { box-shadow: ${FRAME_B_SHADOW}; }
          99.9% { box-shadow: ${FRAME_B_SHADOW}; }
          100% { box-shadow: ${FRAME_A_SHADOW}; }
        }
      `}</style>
      <div className="cv-cat-mover">
        <div className={`cv-speech-bubble${bubbleVisible ? " cv-bubble-visible" : ""}`}>
          {joke}
        </div>
        <div className="cv-cat-flip">
          <div className="cv-cat-sprite-bounds" style={{ width: CAT_WIDTH, height: CAT_HEIGHT }}>
            <div
              className="cv-cat-pixel"
              style={{
                width: CAT_PIXEL_UNIT,
                height: CAT_PIXEL_UNIT,
                boxShadow: FRAME_A_SHADOW,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
