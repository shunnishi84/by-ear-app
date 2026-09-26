import { DUR_ORDER } from '../model/theory';
import type { DurKey, Letter } from '../model/theory';
import { Icon, NoteIcon } from './icons';

export interface ToolbarState {
  dur: DurKey;
  dotted: boolean;
  isRest: boolean;
  tied: boolean;
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export interface ToolbarActions {
  undo: () => void;
  redo: () => void;
  setDur: (d: DurKey) => void;
  toggleDot: () => void;
  toRest: () => void;
  toggleTie: () => void;
  semitone: (d: number) => void;
  octave: (d: number) => void;
  letter: (l: Letter, chord: boolean) => void;
  insert: () => void;
  remove: () => void;
  addMeasure: () => void;
  deleteMeasure: () => void;
}

const DUR_LABEL: Record<DurKey, string> = {
  w: '全音符 (7)', h: '2分音符 (6)', q: '4分音符 (5)', '8': '8分音符 (4)', '16': '16分音符 (3)', '32': '32分音符 (2)',
};
const LETTER_JA: Record<Letter, string> = { C: 'ド', D: 'レ', E: 'ミ', F: 'ファ', G: 'ソ', A: 'ラ', B: 'シ' };

export function Toolbar({ s, a }: { s: ToolbarState; a: ToolbarActions }) {
  const dis = !s.hasSelection;
  return (
    <div className="toolbar" role="toolbar" aria-label="編集ツール">
      <div className="tb-group">
        <button className="tb" onClick={a.undo} disabled={!s.canUndo} title="元に戻す (Ctrl+Z)" aria-label="元に戻す">{Icon.undo}</button>
        <button className="tb" onClick={a.redo} disabled={!s.canRedo} title="やり直し (Ctrl+Y)" aria-label="やり直し">{Icon.redo}</button>
      </div>
      <div className="tb-group">
        {[...DUR_ORDER].reverse().map((d) => (
          <button key={d} className={`tb ${s.dur === d ? 'on' : ''}`} onClick={() => a.setDur(d)} title={DUR_LABEL[d]} aria-label={DUR_LABEL[d]} aria-pressed={s.dur === d}>
            <NoteIcon dur={d} />
          </button>
        ))}
        <button className={`tb txt ${s.dotted ? 'on' : ''}`} onClick={a.toggleDot} disabled={dis} title="付点 (.)" aria-pressed={s.dotted}>
          •
        </button>
      </div>
      <div className="tb-group">
        <button className={`tb ${s.isRest ? 'on' : ''}`} onClick={a.toRest} disabled={dis} title="休符にする (0 / R)" aria-label="休符">
          <NoteIcon dur="q" rest />
        </button>
        <button className={`tb txt ${s.tied ? 'on' : ''}`} onClick={a.toggleTie} disabled={dis} title="次の音とタイ (T)">
          ⁀
        </button>
      </div>
      <div className="tb-group">
        <button className="tb txt" onClick={() => a.semitone(-1)} disabled={dis} title="半音下げ (↓)">♭</button>
        <button className="tb txt" onClick={() => a.semitone(1)} disabled={dis} title="半音上げ (↑)">♯</button>
        <button className="tb txt small" onClick={() => a.octave(-1)} disabled={dis} title="1オクターブ下げ (Ctrl+↓)">8vb</button>
        <button className="tb txt small" onClick={() => a.octave(1)} disabled={dis} title="1オクターブ上げ (Ctrl+↑)">8va</button>
      </div>
      <div className="tb-group letters" aria-label="音名パッド">
        {(['C', 'D', 'E', 'F', 'G', 'A', 'B'] as Letter[]).map((l) => (
          <button
            key={l}
            className="tb letter"
            disabled={dis}
            onClick={(e) => a.letter(l, e.shiftKey)}
            title={`${l}（${LETTER_JA[l]}）を入力 — Shift で和音に追加`}
          >
            <span>{l}</span>
            <small>{LETTER_JA[l]}</small>
          </button>
        ))}
      </div>
      <div className="tb-group">
        <button className="tb txt small" onClick={a.insert} disabled={dis} title="選択位置の前に挿入 (Ins / Ctrl+I)">挿入</button>
        <button className="tb txt small" onClick={a.remove} disabled={dis} title="詰めて削除 (Shift+Del)">削除</button>
        <button className="tb txt small" onClick={a.addMeasure} title="末尾に小節を追加 (Ctrl+B)">＋小節</button>
        <button className="tb txt small" onClick={a.deleteMeasure} disabled={dis} title="選択中の小節を削除">−小節</button>
      </div>
    </div>
  );
}
