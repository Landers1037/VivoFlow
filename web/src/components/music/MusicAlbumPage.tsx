import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import type { MusicAlbum } from "@/types";
import { musicCoverUrl, musicTrackUrl } from "@/lib/music";
import { useAppearance } from "@/hooks/useAppearance";
import { MusicRecordEffects } from "@/components/music/MusicRecordEffects";

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
  const recordRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const { config } = useAppearance();
  const recordEffect = config.music_album_effect;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => Boolean(album.loop_playback));
  const [time, setTime] = useState(0);
  const [progressWidth, setProgressWidth] = useState<number>();
  const track = album.tracks[index];
  const lines = useMemo(() => parseLrc(track?.lyrics ?? ""), [track?.lyrics]);
  const current = lines.reduce((active, line, lineIndex) => (line.time <= time ? lineIndex : active), -1);
  const loopPlayback = Boolean(album.loop_playback);
  const defaultMuted = Boolean(album.default_muted);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    el.muted = defaultMuted;
  }, [defaultMuted]);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    el.src = track ? musicTrackUrl(album.id, track.id) : "";
    el.load();
    if (playing) {
      void el.play().catch(() => setPlaying(false));
    }
    // Reload only when the track changes; play/pause is handled by controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [album.id, track?.id]);

  useLayoutEffect(() => {
    const el = controlsRef.current;
    if (!el) return;
    const sync = () => setProgressWidth(el.getBoundingClientRect().width * 1.2);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [track?.id]);

  const previous = () => setIndex((currentIndex) => (currentIndex - 1 + album.tracks.length) % album.tracks.length);
  const next = () => setIndex((currentIndex) => (currentIndex + 1) % album.tracks.length);

  const onEnded = () => {
    const last = index >= album.tracks.length - 1;
    if (last && !loopPlayback) {
      setPlaying(false);
      return;
    }
    if (album.tracks.length <= 1) {
      const el = audio.current;
      if (el) {
        el.currentTime = 0;
        void el.play().catch(() => setPlaying(false));
      }
      setPlaying(true);
      return;
    }
    setPlaying(true);
    next();
  };

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

  return (
    <main className="music-player-page relative h-[100dvh] overflow-hidden bg-zinc-950 text-white">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-70"
        style={{ backgroundImage: `url(${musicCoverUrl(album.id)})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/85 to-transparent" />

      <div className="music-player-layout relative grid h-full items-center gap-6 p-8 md:grid-cols-[max-content_minmax(0,1fr)] md:gap-8 md:p-16">
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
          <div className="music-player-transport">
            <input
              className="music-player-progress accent-white"
              type="range"
              min={0}
              max={audio.current?.duration || 0}
              value={time}
              aria-label="播放进度"
              style={progressWidth ? { width: progressWidth } : undefined}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (audio.current) audio.current.currentTime = value;
                setTime(value);
              }}
            />
            <div ref={controlsRef} className="music-player-controls">
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
          </div>
        </section>

        <div
          className={`music-record-stage flex items-center${recordEffect === "off" ? " justify-center md:justify-start" : " justify-center"}${recordEffect !== "off" ? " music-record-stage-fx" : ""}${recordEffect === "turntable" ? " music-record-stage-turntable" : ""}`}
        >
          <MusicRecordEffects
            effect={recordEffect}
            playing={playing}
            audioRef={audio}
            recordRef={recordRef}
          />
          <div ref={recordRef} className={`music-record ${playing ? "music-record-playing" : ""}`}>
            <img src={musicCoverUrl(album.id)} alt={`${album.title} 封面`} />
            <span />
          </div>
        </div>
      </div>

      <audio
        ref={audio}
        crossOrigin="anonymous"
        muted={defaultMuted}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          if (audio.current?.ended) return;
          setPlaying(false);
        }}
        onEnded={onEnded}
      />
    </main>
  );
}
