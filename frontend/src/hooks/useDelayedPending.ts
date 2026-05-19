import { useEffect, useState } from "react";

/** Avoid flashing spinners on fast cache hits. */
export function useDelayedPending(pending: boolean, delayMs: number): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!pending) {
      setShow(false);
      return;
    }
    const id = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(id);
  }, [pending, delayMs]);

  return show;
}
