"use client";

import { useCallback, useMemo, useRef, useState } from "react";

const WAVE_COUNT = 30;

function makeWaveBars(src: string, count: number): number[] {
  let seed = 1;

  for (let j = 0; j < src.length; j++) {
    seed = (seed * 31 + src.charCodeAt(j)) | 0;
  }

  const raw: number[] = [];
  for (let i = 0; i < count; i++) {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    raw.push(seed / 0x7fffffff);
  }

  let min = raw[0] ?? 0;
  let max = raw[0] ?? 1;
  for (const value of raw) {
    if (value < min) min = value;
    if (value > max) max = value;
  }

  const range = max - min || 1;
  return raw.map((value, index) => {
    const prev = raw[index - 1] ?? value;
    const next = raw[index + 1] ?? value;
    const smooth = prev * 0.25 + value * 0.5 + next * 0.25;
    return 0.15 + ((smooth - min) / range) * 0.85;
  });
}

type AudioMessageProps = {
  src: string;
  isMe: boolean;
};

const AudioMessage = ({ src, isMe }: AudioMessageProps) => {
  const bars = useMemo(() => makeWaveBars(src, WAVE_COUNT), [src]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState({
    playing: false,
    progress: 0,
    duration: 0,
    currentTime: 0,
  });

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (state.playing) {
      audio.pause();
    } else {
      void audio.play();
    }
  }, [state.playing]);

  const handleBarClick = useCallback(
    (index: number) => {
      const audio = audioRef.current;
      if (!audio || !state.duration) return;
      audio.currentTime = (index / WAVE_COUNT) * state.duration;
    },
    [state.duration],
  );

  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${secs}`;
  }, []);

  const accent = isMe ? "bg-white/60" : "bg-[var(--text-primary)/25]";
  const accentActive = isMe ? "bg-white" : "bg-[var(--text-primary)/80]";
  const btnBg = isMe
    ? "bg-white/20 hover:bg-white/30"
    : "bg-[var(--text-primary)/10] hover:bg-[var(--text-primary)/20]";
  const timeColor = isMe ? "text-white/40" : "text-[var(--text-primary)/30]";
  const filledBars = Math.round(state.progress * WAVE_COUNT);

  return (
    <div className="flex items-center gap-2.5 w-55">
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setState((current) => ({ ...current, playing: true }))}
        onPause={() => setState((current) => ({ ...current, playing: false }))}
        onEnded={() =>
          setState((current) => ({
            ...current,
            playing: false,
            progress: 0,
            currentTime: 0,
          }))
        }
        onLoadedMetadata={(event) =>
          setState((current) => ({
            ...current,
            duration: (event.target as HTMLAudioElement).duration,
          }))
        }
        onTimeUpdate={(event) => {
          const audio = event.target as HTMLAudioElement;
          setState((current) => ({
            ...current,
            currentTime: audio.currentTime,
            progress: audio.duration ? audio.currentTime / audio.duration : 0,
          }));
        }}
      />

      <button
        onClick={togglePlayback}
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${btnBg}`}
      >
        {state.playing ? (
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
            <rect x="5" y="4" width="4" height="16" rx="1" />
            <rect x="15" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current ml-0.5">
            <path d="M8 5.14v14l11-7-11-7z" />
          </svg>
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1.5">
        <div className="flex items-end gap-0.5 h-7">
          {bars.map((heightRatio, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleBarClick(index)}
              style={{ height: `${Math.round(heightRatio * 100)}%` }}
              className={`flex-1 rounded-full transition-colors cursor-pointer ${
                index < filledBars ? accentActive : accent
              }`}
            />
          ))}
        </div>
        <span className={`text-[10px] tabular-nums ${timeColor}`}>
          {state.playing || state.currentTime > 0
            ? formatTime(state.currentTime)
            : formatTime(state.duration)}
        </span>
      </div>
    </div>
  );
};

export default AudioMessage;
