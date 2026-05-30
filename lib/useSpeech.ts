"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Browser read-aloud via the Web Speech API (SpeechSynthesis). No server cost,
// works offline (H3 "audio readable"). Degrades gracefully where unsupported.

export interface SpeechController {
  supported: boolean;
  speaking: boolean;
  paused: boolean;
  /** Index of the utterance currently being spoken in a queued playlist. */
  current: number | null;
  /** Speak one string, replacing anything in progress. */
  speak: (text: string) => void;
  /** Speak a list in order; `current` tracks progress. */
  speakQueue: (texts: string[]) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

function getSynth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;
}

export function useSpeech(): SpeechController {
  const synth = getSynth();
  const supported = synth !== null;

  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);

  // A run token invalidates stale onend callbacks when the user stops/restarts.
  const runRef = useRef(0);

  const reset = useCallback(() => {
    setSpeaking(false);
    setPaused(false);
    setCurrent(null);
  }, []);

  const stop = useCallback(() => {
    if (!synth) return;
    runRef.current++;
    synth.cancel();
    reset();
  }, [synth, reset]);

  const utter = useCallback(
    (text: string, onend: () => void): SpeechSynthesisUtterance => {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1;
      u.pitch = 1;
      u.lang = "en-IN";
      u.onend = onend;
      u.onerror = onend;
      return u;
    },
    []
  );

  const speakQueue = useCallback(
    (texts: string[]) => {
      if (!synth) return;
      const items = texts.map((t) => t.trim()).filter(Boolean);
      if (items.length === 0) return;

      synth.cancel();
      const run = ++runRef.current;
      setSpeaking(true);
      setPaused(false);

      const speakAt = (i: number) => {
        if (run !== runRef.current) return; // superseded by a newer run
        if (i >= items.length) {
          reset();
          return;
        }
        setCurrent(i);
        synth.speak(utter(items[i], () => speakAt(i + 1)));
      };
      speakAt(0);
    },
    [synth, utter, reset]
  );

  const speak = useCallback((text: string) => speakQueue([text]), [speakQueue]);

  const pause = useCallback(() => {
    if (!synth) return;
    synth.pause();
    setPaused(true);
  }, [synth]);

  const resume = useCallback(() => {
    if (!synth) return;
    synth.resume();
    setPaused(false);
  }, [synth]);

  // Stop any narration when the component unmounts (navigating away).
  useEffect(() => {
    return () => {
      if (synth) {
        runRef.current++;
        synth.cancel();
      }
    };
  }, [synth]);

  return { supported, speaking, paused, current, speak, speakQueue, pause, resume, stop };
}
