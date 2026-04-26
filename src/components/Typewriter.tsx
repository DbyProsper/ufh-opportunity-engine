import { useEffect, useState } from "react";

interface TypewriterProps {
  text: string;
  speed?: number;
  startDelay?: number;
  className?: string;
}

export const Typewriter = ({ text, speed = 22, startDelay = 250, className }: TypewriterProps) => {
  const [shown, setShown] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), startDelay);
    return () => clearTimeout(t);
  }, [startDelay]);

  useEffect(() => {
    if (!started) return;
    if (shown.length >= text.length) return;
    const t = setTimeout(() => setShown(text.slice(0, shown.length + 1)), speed);
    return () => clearTimeout(t);
  }, [shown, started, text, speed]);

  const done = shown.length >= text.length;

  return (
    <span className={className} aria-label={text}>
      {shown}
      <span
        className={`inline-block w-[2px] h-[1em] align-[-0.15em] ml-0.5 bg-current ${
          done ? "opacity-0" : "animate-pulse"
        }`}
        aria-hidden="true"
      />
    </span>
  );
};