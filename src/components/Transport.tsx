import { INSTRUMENTS } from '../audio/player';
import type { InstrumentId } from '../model/types';
import { Icon } from './icons';

interface Props {
  playing: boolean;
  position: string;
  tempo: number;
  metronome: boolean;
  instrument: InstrumentId;
  scoreVolume: number;
  originalVolume: number;
  hasOriginal: boolean;
  onPlay: () => void;
  onStop: () => void;
  onRewind: () => void;
  onTempo: (bpm: number) => void;
  onMetronome: (on: boolean) => void;
  onInstrument: (i: InstrumentId) => void;
  onScoreVolume: (v: number) => void;
  onOriginalVolume: (v: number) => void;
}

export function Transport(p: Props) {
  return (
    <div className="transport" role="region" aria-label="再生">
      <div className="tp-main">
        <button className="tp-btn" onClick={p.onRewind} title="先頭へ (Home)" aria-label="先頭へ">{Icon.start}</button>
        <button className="tp-btn play" onClick={p.onPlay} title="再生 / 一時停止 (Space)" aria-label={p.playing ? '一時停止' : '再生'} data-testid="play">
          {p.playing ? Icon.pause : Icon.play}
        </button>
        <button className="tp-btn" onClick={p.onStop} title="停止" aria-label="停止">{Icon.stop}</button>
        <span className="tp-pos" aria-live="off">{p.position}</span>
      </div>
      <div className="tp-opts">
        <label className="tp-field" title="テンポ (BPM)">
          <span>♩=</span>
          <input type="number" min={20} max={300} value={p.tempo} onChange={(e) => p.onTempo(Number(e.target.value) || p.tempo)} aria-label="テンポ" />
        </label>
        <button className={`tp-btn small ${p.metronome ? 'on' : ''}`} onClick={() => p.onMetronome(!p.metronome)} title="メトロノーム" aria-pressed={p.metronome} aria-label="メトロノーム">
          {Icon.metronome}
        </button>
        <select value={p.instrument} onChange={(e) => p.onInstrument(e.target.value as InstrumentId)} aria-label="再生音色">
          {INSTRUMENTS.map((i) => (
            <option key={i.id} value={i.id}>{i.label}</option>
          ))}
        </select>
        <label className="tp-vol" title="楽譜の音量">
          <span>楽譜</span>
          <input type="range" min={0} max={1} step={0.05} value={p.scoreVolume} onChange={(e) => p.onScoreVolume(Number(e.target.value))} />
        </label>
        <label className={`tp-vol ${p.hasOriginal ? '' : 'disabled'}`} title={p.hasOriginal ? '原音の音量（楽譜と重ねて確認）' : '耳コピした音声がこのセッションにありません'}>
          <span>原音</span>
          <input type="range" min={0} max={1} step={0.05} value={p.originalVolume} disabled={!p.hasOriginal} onChange={(e) => p.onOriginalVolume(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}
