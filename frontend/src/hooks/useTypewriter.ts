import { useEffect, useRef, useState } from "react";

/** Reveal `text` one character at a time. Returns `displayed` (partial string) and `done` flag. */
export function useTypewriter(text: string, speed = 100) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const idx = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function tick() {
      idx.current++;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) {
        setDone(true);
      } else {
        timer = setTimeout(tick, speed);
      }
    }
    timer = setTimeout(tick, speed);
    return () => clearTimeout(timer);
  }, [text, speed]);

  return { displayed, done };
}
