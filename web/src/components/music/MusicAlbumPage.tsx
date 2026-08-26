import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import type { MusicAlbum } from "@/types";
import { musicCoverUrl, musicTrackUrl } from "@/lib/music";

function parseLrc(text: string) {
  return text
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
      return match
        ? [
            {
              time: Number(match[1]) * 60 + Number(match[2]),
              text: match[3].trim(),
            },
          ]
        : [];
    })
    .sort((a, b) => a.time - b.time);
}

export function MusicAlbumPage({
  album,
  onOpenSettings,
}: {
  album: MusicAlbum;
  onOpenSettings: () => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const track = album.tracks[index];
  const lines = useMemo(() => parseLrc(track?.lyrics ?? ""), [track?.lyrics]);
  const current = lines.reduce((active, line, lineIndex) => (line.time <= time ? lineIndex : active), -1);

  useEffect(() => {
    if (!audio.current) return;
    audio.current.src = track ? musicTrackUrl(album.id, track.id) : "";
    audio.current.load();
    if (playing) audio.current.play().catch(() => {});
  }, [album.id, track?.id]);

  if (!track) {
    return (
      <main className="flex min-h-[80dvh] items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <h1 className="font-serif text-3xl">{album.title}</h1>
          <p className="mt-3 text-white/60">专辑还没有音乐</p>
          <button className="mt-6 underline" onClick={onOpenSettings}>
            打开设置上传音乐
          </button>
        </div>
      </main>
    );
  }

  const previous = () => setIndex((index - 1 + album.tracks.length) % album.tracks.length);
  const next = () => setIndex((index + 1) % album.tracks.length);

  return (
    <main className="music-player-page relative h-[100dvh] overflow-hidden bg-zinc-950 text-white">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-70"
        style={{ backgroundImage: `url(${musicCoverUrl(album.id)})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/85 to-transparent" />

      <div className="music-player-layout relative grid h-full items-center gap-8 p-8 md:grid-cols-[minmax(260px,380px)_1fr] md:p-16">
        <section className="music-player-panel z-10 space-y-7">
          <p className="music-player-eyebrow text-xs uppercase tracking-[.35em] text-white/50">
            Now playing / {album.title}
          </p>
          <div>
            <h1 className="music-player-title font-serif text-4xl md:text-6xl">{track.title}</h1>
            <p className="music-player-filename mt-2 text-sm text-white/50">{track.original_name}</p>
          </div>
          <div className="music-player-lyrics h-28 overflow-hidden text-sm leading-8 text-white/70">
            {lines.length ? (
              lines.map((line, lineIndex) => (
                <p
                  key={`${line.time}-${lineIndex}`}
                  className={lineIndex === current ? "text-white" : "opacity-60"}
                >
                  {line.text}
                </p>
              ))
            ) : (
              <p>{track.lyrics || "暂无歌词"}</p>
            )}
          </div>
          <input
            className="music-player-progress w-full accent-white"
            type="range"
            min={0}
            max={audio.current?.duration || 0}
            value={time}
            aria-label="播放进度"
            onChange={(event) => {
              const value = Number(event.target.value);
              if (audio.current) audio.current.currentTime = value;
              setTime(value);
            }}
          />
          <div className="music-player-controls flex items-center gap-4">
            <button aria-label="上一首" onClick={previous}>
              <SkipBack />
            </button>
            <button
              className="music-player-toggle rounded-full bg-white p-4 text-black"
              aria-label={playing ? "暂停" : "播放"}
              onClick={() => {
                if (!audio.current) return;
                if (playing) audio.current.pause();
                else audio.current.play().catch(() => {});
                setPlaying(!playing);
              }}
            >
              {playing ? <Pause /> : <Play />}
            </button>
            <button aria-label="下一首" onClick={next}>
              <SkipForward />
            </button>
          </div>
        </section>

        <div className="music-record-stage flex items-center justify-center md:justify-start">
          <div className={`music-record ${playing ? "music-record-playing" : ""}`}>
            <img src={musicCoverUrl(album.id)} alt={`${album.title} 封面`} />
            <span />
          </div>
        </div>
      </div>

      <audio
        ref={audio}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={next}
      />
    </main>
  );
}
