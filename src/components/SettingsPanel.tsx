import { TRANSPOSE_OPTIONS } from '../model/instruments';
import { keyNameJa } from '../model/theory';
import type { Clef, KeyMode, Score, TimeSig } from '../model/types';

interface Props {
  score: Score;
  onChange: (patch: Partial<Score>) => void;
  onTimeSig: (ts: TimeSig) => void;
  onTransposeScore: (semis: number) => void;
  onClose: () => void;
}

export const TIME_SIGS: TimeSig[] = [
  { num: 4, den: 4 }, { num: 3, den: 4 }, { num: 2, den: 4 }, { num: 2, den: 2 },
  { num: 6, den: 8 }, { num: 9, den: 8 }, { num: 12, den: 8 }, { num: 5, den: 4 },
];
const FIFTHS = Array.from({ length: 15 }, (_, i) => i - 7);

export function SettingsPanel({ score, onChange, onTimeSig, onTransposeScore, onClose }: Props) {
  return (
    <aside className="panel" aria-label="スコア設定">
      <div className="panel-head">
        <h2>スコア設定</h2>
        <button className="icon-btn" onClick={onClose} aria-label="閉じる">×</button>
      </div>
      <label className="field">
        <span>タイトル</span>
        <input value={score.title} onChange={(e) => onChange({ title: e.target.value })} />
      </label>
      <label className="field">
        <span>作曲者</span>
        <input value={score.composer} onChange={(e) => onChange({ composer: e.target.value })} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>テンポ</span>
          <input type="number" min={20} max={300} value={score.tempo} onChange={(e) => onChange({ tempo: Number(e.target.value) || score.tempo })} />
        </label>
        <label className="field">
          <span>拍子</span>
          <select
            value={`${score.timeSig.num}/${score.timeSig.den}`}
            onChange={(e) => {
              const [num, den] = e.target.value.split('/').map(Number);
              onTimeSig({ num, den });
            }}
          >
            {TIME_SIGS.map((t) => (
              <option key={`${t.num}/${t.den}`}>{`${t.num}/${t.den}`}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>調号（実音）</span>
          <select value={score.keyFifths} onChange={(e) => onChange({ keyFifths: Number(e.target.value) })}>
            {FIFTHS.map((f) => (
              <option key={f} value={f}>
                {keyNameJa(f, score.keyMode)}（{f === 0 ? '♮' : f > 0 ? `♯×${f}` : `♭×${-f}`}）
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>長短</span>
          <select value={score.keyMode} onChange={(e) => onChange({ keyMode: e.target.value as KeyMode })}>
            <option value="major">長調</option>
            <option value="minor">短調</option>
          </select>
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>音部記号</span>
          <select value={score.clef} onChange={(e) => onChange({ clef: e.target.value as Clef })}>
            <option value="treble">ト音記号</option>
            <option value="bass">ヘ音記号</option>
          </select>
        </label>
        <label className="field">
          <span>記譜（移調楽器）</span>
          <select value={score.transpose} onChange={(e) => onChange({ transpose: Number(e.target.value) })}>
            {TRANSPOSE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="field">
        <span>曲全体を移調（実音を変更）</span>
        <div className="btn-row">
          <button className="btn" onClick={() => onTransposeScore(-1)}>−半音</button>
          <button className="btn" onClick={() => onTransposeScore(1)}>＋半音</button>
          <button className="btn" onClick={() => onTransposeScore(-12)}>−1oct</button>
          <button className="btn" onClick={() => onTransposeScore(12)}>＋1oct</button>
        </div>
        <small className="hint">調号も一緒に動きます。記譜だけ変えたいときは「記譜（移調楽器）」を使ってください。</small>
      </div>
      {score.audio && (
        <p className="hint">
          原音との同期: {score.audio.fileName ?? '音声'} の {score.audio.offsetSec.toFixed(2)} 秒が曲頭（解析テンポ {score.audio.tempo.toFixed(1)}）
        </p>
      )}
    </aside>
  );
}
