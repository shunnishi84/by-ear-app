import { useEffect, useRef, useState } from 'react';
import { decodeFile } from '../audio/decode';
import { Recorder } from '../audio/recorder';
import { tapTempo } from '../audio/tempo';
import { GRID_OPTIONS, transcribe } from '../audio/transcribe';
import type { Mode, Stage, TranscribeResult } from '../audio/transcribe';
import { PRESETS } from '../model/instruments';
import { keyNameJa } from '../model/theory';
import { TPQ } from '../model/types';
import { Icon } from './icons';
import { TIME_SIGS } from './SettingsPanel';

interface Props {
  onClose: () => void;
  onDone: (r: TranscribeResult, audio: AudioBuffer, fileName: string) => void;
}

const STAGE_LABEL: Record<Stage, string> = {
  decode: '音声を準備中…',
  pitch: '音の高さを解析中…',
  rhythm: 'リズムと調を推定中…',
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function ImportDialog({ onClose, onDone }: Props) {
  const [file, setFile] = useState<{ blob: Blob; name: string } | null>(null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [level, setLevel] = useState(0);
  const recorder = useRef<Recorder | null>(null);
  const [drag, setDrag] = useState(false);

  const [mode, setMode] = useState<Mode>('mono');
  const [presetId, setPresetId] = useState('concert');
  const [autoTempo, setAutoTempo] = useState(true);
  const [bpm, setBpm] = useState(120);
  const [ts, setTs] = useState('4/4');
  const [grid, setGrid] = useState(TPQ / 4);
  const [key, setKey] = useState<'auto' | number>('auto');
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState<number | ''>('');
  const taps = useRef<number[]>([]);

  const [busy, setBusy] = useState<{ stage: Stage; ratio: number } | null>(null);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => recorder.current?.cancel(), []);

  const load = async (blob: Blob, name: string) => {
    setError(null);
    try {
      const buf = await decodeFile(blob);
      setFile({ blob, name });
      setBuffer(buf);
      setUrl(URL.createObjectURL(blob));
      setStart(0);
      setEnd('');
    } catch (e) {
      console.error(e);
      setError('この音声ファイルは読み込めませんでした（mp3 / wav / m4a / ogg / webm などに対応）。');
    }
  };

  const startRec = async () => {
    setError(null);
    try {
      const r = new Recorder();
      await r.start();
      recorder.current = r;
      setRecording(true);
      const t0 = performance.now();
      const tick = () => {
        if (!recorder.current) return;
        setRecTime((performance.now() - t0) / 1000);
        setLevel(recorder.current.level());
        requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setError('マイクを使えませんでした。ブラウザのマイク権限を確認してください。');
    }
  };
  const stopRec = async () => {
    const r = recorder.current;
    recorder.current = null;
    setRecording(false);
    if (!r) return;
    const blob = await r.stop();
    const d = new Date();
    await load(blob, `録音 ${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}${String(d.getMinutes()).padStart(2, '0')}`);
  };

  const tap = () => {
    const now = performance.now() / 1000;
    taps.current = [...taps.current.filter((t) => now - t < 4), now];
    const t = tapTempo(taps.current);
    if (t) {
      setBpm(t);
      setAutoTempo(false);
    }
  };

  const run = async () => {
    if (!buffer || !file) return;
    const preset = PRESETS.find((p) => p.id === presetId)!;
    const [num, den] = ts.split('/').map(Number);
    setBusy({ stage: 'decode', ratio: 0 });
    setError(null);
    try {
      const r = await transcribe(
        buffer,
        {
          mode,
          bpm: autoTempo ? null : bpm,
          timeSig: { num, den },
          grid,
          keyFifths: key === 'auto' ? null : key,
          clef: preset.clef,
          transpose: preset.transpose,
          instrument: preset.sound,
          startSec: start,
          endSec: end === '' ? null : end,
          minMidi: preset.minMidi,
          maxMidi: preset.maxMidi,
        },
        (stage, ratio) => setBusy({ stage, ratio }),
      );
      onDone(r, buffer, file.name);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) void load(f, f.name);
  };

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="音声から耳コピ">
      <div className="modal">
        <div className="modal-head">
          <h2>音声から耳コピ</h2>
          <button className="icon-btn" onClick={onClose} disabled={!!busy} aria-label="閉じる">×</button>
        </div>

        {!buffer && (
          <div
            className={`drop ${drag ? 'drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
          >
            {recording ? (
              <div className="rec">
                <div className="rec-level"><div style={{ width: `${Math.min(100, level * 140)}%` }} /></div>
                <div className="rec-time">● {fmt(recTime)}</div>
                <button className="btn primary" onClick={stopRec}>録音を終了して使う</button>
              </div>
            ) : (
              <>
                <div className="drop-icon">{Icon.wave}</div>
                <p>音声ファイルをここにドロップ</p>
                <div className="btn-row center">
                  <label className="btn primary">
                    ファイルを選ぶ
                    <input
                      type="file"
                      accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm"
                      hidden
                      data-testid="audio-input"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void load(f, f.name);
                      }}
                    />
                  </label>
                  <button className="btn" onClick={startRec}>{Icon.mic} マイクで録音</button>
                </div>
                <small className="hint">ソロ楽器や歌のメロディが一番きれいに取れます。伴奏入りの曲は「和音あり（AI）」も試してみてください。</small>
              </>
            )}
          </div>
        )}

        {buffer && file && (
          <>
            <div className="file-info">
              <div>
                <strong>{file.name}</strong>
                <span className="muted"> — {fmt(buffer.duration)}</span>
              </div>
              {!busy && <button className="link" onClick={() => { setBuffer(null); setFile(null); }}>別の音声にする</button>}
            </div>
            {url && <audio className="preview" src={url} controls preload="auto" />}

            <div className="form-grid">
              <fieldset className="field wide">
                <legend>解析モード</legend>
                <label className="radio">
                  <input type="radio" checked={mode === 'mono'} onChange={() => setMode('mono')} />
                  <span><b>単旋律</b> — メロディ・管楽器・歌（高速・高精度）</span>
                </label>
                <label className="radio">
                  <input type="radio" checked={mode === 'poly'} onChange={() => setMode('poly')} />
                  <span><b>和音あり（AI）</b> — ピアノ・ギター・スティールパンの和音など（Basic Pitch、初回はモデル読込あり）</span>
                </label>
              </fieldset>
              <label className="field">
                <span>楽器・記譜</span>
                <select value={presetId} onChange={(e) => setPresetId(e.target.value)}>
                  {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
              <div className="field">
                <span>テンポ</span>
                <div className="inline">
                  <label className="check"><input type="checkbox" checked={autoTempo} onChange={(e) => setAutoTempo(e.target.checked)} /> 自動</label>
                  <input type="number" min={30} max={260} value={bpm} disabled={autoTempo} onChange={(e) => setBpm(Number(e.target.value) || 120)} aria-label="BPM" />
                  <button className="btn small" onClick={tap} title="音声を聴きながら拍に合わせて4回以上タップ">タップ</button>
                </div>
              </div>
              <label className="field">
                <span>拍子</span>
                <select value={ts} onChange={(e) => setTs(e.target.value)}>
                  {TIME_SIGS.map((t) => <option key={`${t.num}/${t.den}`}>{`${t.num}/${t.den}`}</option>)}
                </select>
              </label>
              <label className="field">
                <span>最小音符</span>
                <select value={grid} onChange={(e) => setGrid(Number(e.target.value))}>
                  {GRID_OPTIONS.map((g) => <option key={g.ticks} value={g.ticks}>{g.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>調</span>
                <select value={key} onChange={(e) => setKey(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}>
                  <option value="auto">自動判定</option>
                  {Array.from({ length: 15 }, (_, i) => i - 7).map((f) => (
                    <option key={f} value={f}>{keyNameJa(f, 'major')}</option>
                  ))}
                </select>
              </label>
              <div className="field">
                <span>解析範囲（秒）</span>
                <div className="inline">
                  <input type="number" min={0} step={0.1} value={start} onChange={(e) => setStart(Math.max(0, Number(e.target.value)))} aria-label="開始秒" />
                  <span>〜</span>
                  <input type="number" min={0} step={0.1} value={end} placeholder={buffer.duration.toFixed(1)} onChange={(e) => setEnd(e.target.value === '' ? '' : Number(e.target.value))} aria-label="終了秒" />
                </div>
              </div>
            </div>

            {busy ? (
              <div className="progress" aria-live="polite">
                <div className="progress-label">{STAGE_LABEL[busy.stage]}</div>
                <div className="bar"><div style={{ width: `${Math.round(({ decode: 0, pitch: 0.1, rhythm: 0.9 }[busy.stage] + busy.ratio * { decode: 0.1, pitch: 0.8, rhythm: 0.1 }[busy.stage]) * 100)}%` }} /></div>
              </div>
            ) : (
              <div className="btn-row end">
                <button className="btn" onClick={onClose}>キャンセル</button>
                <button className="btn primary" onClick={run} data-testid="run-transcribe">耳コピ開始</button>
              </div>
            )}
          </>
        )}
        {error && <div className="error" role="alert">{error}</div>}
      </div>
    </div>
  );
}
