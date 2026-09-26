import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player } from './audio/player';
import type { TranscribeResult } from './audio/transcribe';
import { HelpDialog } from './components/HelpDialog';
import { Icon } from './components/icons';
import { ImportDialog } from './components/ImportDialog';
import { ScoreView } from './components/ScoreView';
import { SettingsPanel } from './components/SettingsPanel';
import { Toolbar } from './components/Toolbar';
import type { ToolbarActions } from './components/Toolbar';
import { Transport } from './components/Transport';
import { download, safeName } from './export/download';
import { toMidi } from './export/midi';
import { toMusicXML } from './export/musicxml';
import {
  appendMeasure, deleteMeasureAt, eventAtTick, insertBefore, mapRange, normalize, pasteAt,
  rebar, removeRange, restRange, setDuration, transposeRange,
} from './model/edit';
import { DUR_TICKS, keyNameJa, letterNear, midiFromDiatonic, normalizeFifths, pitchName, valueForTicks, writtenFifths } from './model/theory';
import type { DurKey, Letter } from './model/theory';
import { emptyScore, eventStartTicks, measureTicks, rest, totalTicks, TPQ } from './model/types';
import type { NoteEvent, Score, TimeSig } from './model/types';
import { loadScore, saveScore, validateScore } from './ui/storage';
import { useHistory } from './ui/useHistory';

const DUR_JA: Record<DurKey, string> = { w: '全音符', h: '2分音符', q: '4分音符', '8': '8分音符', '16': '16分音符', '32': '32分音符' };
const DIGIT_DUR: Record<string, DurKey> = { '2': '32', '3': '16', '4': '8', '5': 'q', '6': 'h', '7': 'w' };

export default function App() {
  const hist = useHistory<Score>(loadScore);
  const score = hist.value;
  const [sel, setSel] = useState<{ a: number; f: number } | null>(null);
  const range = useMemo<[number, number] | null>(
    () => (sel ? [Math.min(sel.a, sel.f), Math.max(sel.a, sel.f)] : null),
    [sel],
  );
  const [inputDur, setInputDur] = useState<DurKey>('q');
  const clip = useRef<NoteEvent[] | null>(null);
  const player = useRef<Player>(new Player());
  const [playing, setPlaying] = useState(false);
  const [playTick, setPlayTick] = useState<number | null>(null);
  const [resumeTick, setResumeTick] = useState(0);
  const [metronome, setMetronome] = useState(false);
  const [scoreVol, setScoreVol] = useState(0.8);
  const [origVol, setOrigVol] = useState(0);
  const [original, setOriginal] = useState<AudioBuffer | null>(null);
  const [dialog, setDialog] = useState<'import' | 'help' | null>(null);
  const [panel, setPanel] = useState(() => window.innerWidth > 1180);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const openFile = useRef<HTMLInputElement>(null);

  const ts = score.timeSig;
  const starts = useMemo(() => eventStartTicks(score.events), [score.events]);
  const cur = range ? score.events[range[0]] : undefined;
  const wFifths = writtenFifths(score.keyFifths, score.transpose);

  useEffect(() => saveScore(score), [score]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  // Keep selection valid after edits / undo.
  useEffect(() => {
    if (sel && (sel.a >= score.events.length || sel.f >= score.events.length)) {
      const last = score.events.length - 1;
      setSel({ a: Math.min(sel.a, last), f: Math.min(sel.f, last) });
    }
  }, [score.events.length, sel]);

  const commitEvents = useCallback(
    (events: NoteEvent[], select?: number) => {
      hist.commit({ ...score, events });
      if (select !== undefined) setSel({ a: select, f: select });
    },
    [hist, score],
  );
  const patch = useCallback((p: Partial<Score>) => hist.commit({ ...score, ...p }), [hist, score]);
  const preview = useCallback(
    (pitches: number[]) => {
      if (!player.current.playing) player.current.preview(pitches, score.instrument);
    },
    [score.instrument],
  );

  // ------------------------------------------------------------ editing

  const prevPitch = (i: number): number => {
    for (let k = i; k >= 0; k--) {
      const e = score.events[k];
      if (e?.pitches.length) return Math.max(...e.pitches);
    }
    return (score.clef === 'bass' ? 50 : 71) - score.transpose;
  };

  const actions: ToolbarActions = {
    undo: hist.undo,
    redo: hist.redo,
    setDur: (d) => {
      setInputDur(d);
      if (!range) return;
      commitEvents(setDuration(score.events, range[0], DUR_TICKS[d], ts), range[0]);
    },
    toggleDot: () => {
      if (!range || !cur) return;
      const v = valueForTicks(cur.ticks);
      let ticks: number | null = null;
      if (v?.dots) ticks = DUR_TICKS[v.dur];
      else if (v && DUR_TICKS[v.dur] % 2 === 0) ticks = (DUR_TICKS[v.dur] * 3) / 2;
      if (ticks) commitEvents(setDuration(score.events, range[0], ticks, ts), range[0]);
    },
    toRest: () => range && commitEvents(restRange(score.events, range[0], range[1], ts)),
    toggleTie: () => {
      if (!range || !cur) return;
      commitEvents(normalize(mapRange(score.events, range[0], range[0], (e) => ({ ...e, tieNext: !e.tieNext })), ts));
    },
    semitone: (d) => {
      if (!range) return;
      const ev = transposeRange(score.events, range[0], range[1], d);
      commitEvents(ev);
      if (range[0] === range[1]) preview(ev[range[0]].pitches);
    },
    octave: (d) => actions.semitone(12 * d),
    letter: (l: Letter, chord: boolean) => {
      if (!range) return;
      const i = range[0];
      const e = score.events[i];
      const nearW = (chord && e.pitches.length ? Math.max(...e.pitches) : prevPitch(i - 1 >= 0 && !e.pitches.length ? i - 1 : i)) + score.transpose;
      const m = letterNear(l, wFifths, chord && e.pitches.length ? nearW + 4 : nearW) - score.transpose;
      if (chord && e.pitches.length) {
        if (e.pitches.includes(m)) return;
        const ev = mapRange(score.events, i, i, (x) => ({ ...x, pitches: [...x.pitches, m].sort((a, b) => a - b) }));
        commitEvents(ev, i);
        preview(ev[i].pitches);
        return;
      }
      let ev = mapRange(score.events, i, i, (x) => ({ ...x, pitches: [m] }));
      if (!e.pitches.length && e.ticks !== DUR_TICKS[inputDur]) ev = setDuration(ev, i, DUR_TICKS[inputDur], ts);
      if (i + 1 >= ev.length) ev = appendMeasure(ev, ts);
      commitEvents(ev, i + 1);
      preview([m]);
    },
    insert: () => {
      if (!range) return;
      commitEvents(insertBefore(score.events, range[0], rest(DUR_TICKS[inputDur]), ts), range[0]);
    },
    remove: () => {
      if (!range) return;
      const ev = removeRange(score.events, range[0], range[1], ts);
      commitEvents(ev, Math.min(range[0], ev.length - 1));
    },
    addMeasure: () => commitEvents(appendMeasure(score.events, ts)),
    deleteMeasure: () => {
      if (!range) return;
      const ev = deleteMeasureAt(score.events, range[0], ts);
      commitEvents(ev, Math.min(range[0], ev.length - 1));
    },
  };

  const staffClick = (i: number, step: number) => {
    const m = midiFromDiatonic(step, wFifths) - score.transpose;
    if (m < 21 || m > 108) return;
    const e = score.events[i];
    let pitches = [m];
    if (e.pitches.length > 1) {
      const nearest = e.pitches.reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a));
      pitches = [...new Set(e.pitches.map((p) => (p === nearest ? m : p)))].sort((a, b) => a - b);
    }
    if (pitches.join() === e.pitches.join()) return;
    commitEvents(mapRange(score.events, i, i, (x) => ({ ...x, pitches })), i);
    preview([m]);
  };

  const copy = () => {
    if (range) clip.current = score.events.slice(range[0], range[1] + 1);
  };
  const paste = () => {
    if (!range || !clip.current) return;
    const ev = pasteAt(score.events, range[0], clip.current, ts);
    commitEvents(ev, Math.min(range[0] + clip.current.length, ev.length - 1));
  };

  const changeTimeSig = (t: TimeSig) => hist.commit({ ...score, timeSig: t, events: rebar(score.events, t) });
  const transposeScore = (semis: number) =>
    hist.commit({
      ...score,
      keyFifths: semis % 12 === 0 ? score.keyFifths : normalizeFifths(score.keyFifths + 7 * semis),
      events: transposeRange(score.events, 0, score.events.length - 1, semis),
    });

  // ------------------------------------------------------------ playback

  const stopPlayback = useCallback(() => {
    player.current.stop();
    setPlaying(false);
    setPlayTick(null);
  }, []);

  const togglePlay = () => {
    if (playing) {
      const t = playTick ?? 0;
      stopPlayback();
      setResumeTick(t);
      return;
    }
    const from = range ? starts[range[0]] : resumeTick < totalTicks(score.events) ? resumeTick : 0;
    setPlaying(true);
    player.current.play(score, {
      fromTick: from,
      metronome,
      scoreVolume: scoreVol,
      original,
      originalVolume: origVol,
      onTick: (t) => setPlayTick(t),
      onEnd: () => {
        setPlaying(false);
        setPlayTick(null);
        setResumeTick(0);
      },
    });
    if (range) setSel(null);
  };
  const rewind = () => {
    stopPlayback();
    setResumeTick(0);
    setSel(null);
  };

  useEffect(() => () => player.current.stop(), []);

  // ------------------------------------------------------------ files

  const onTranscribed = (r: TranscribeResult, buf: AudioBuffer, fileName: string) => {
    stopPlayback();
    const title = fileName.replace(/\.[^.]+$/, '');
    hist.commit({
      ...emptyScore(),
      ...r.score,
      title,
      composer: '',
      audio: r.score.audio ? { ...r.score.audio, fileName } : undefined,
    });
    setOriginal(buf);
    setOrigVol(0.6);
    setSel(null);
    setResumeTick(0);
    setDialog(null);
    setToast(`${r.noteCount} 音を検出 — ♩=${r.score.tempo}、${keyNameJa(r.score.keyFifths, r.score.keyMode)}。原音と重ねて再生して確認しましょう`);
  };

  const newScore = () => {
    if (!confirm('新しい楽譜を作成しますか？（今の楽譜は「元に戻す」で戻せます）')) return;
    stopPlayback();
    hist.commit(emptyScore());
    setOriginal(null);
    setSel({ a: 0, f: 0 });
  };

  const saveProject = () =>
    download(JSON.stringify({ app: 'by-ear', version: 1, score }, null, 1), `${safeName(score.title)}.byear.json`, 'application/json');

  const openProject = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      stopPlayback();
      hist.commit(validateScore(data.score ?? data));
      setOriginal(null);
      setSel(null);
      setToast(`「${f.name}」を開きました`);
    } catch {
      setToast('プロジェクトファイルを読み込めませんでした');
    }
  };

  const exportPdf = async () => {
    setBusy('PDF を作成中…');
    try {
      const { exportPdf: make } = await import('./export/pdf');
      download(await make(score), `${safeName(score.title)}.pdf`, 'application/pdf');
    } catch (e) {
      console.error(e);
      setToast('PDF の作成に失敗しました');
    } finally {
      setBusy(null);
    }
  };

  // ------------------------------------------------------------ keyboard

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (dialog || t.closest('input, select, textarea, [contenteditable="true"]')) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key;
      const handled = () => e.preventDefault();
      if (mod) {
        const lk = k.toLowerCase();
        if (lk === 'z' && !e.shiftKey) { hist.undo(); handled(); }
        else if (lk === 'y' || (lk === 'z' && e.shiftKey)) { hist.redo(); handled(); }
        else if (lk === 'c') { copy(); handled(); }
        else if (lk === 'x') { copy(); actions.toRest(); handled(); }
        else if (lk === 'v') { paste(); handled(); }
        else if (lk === 'b') { actions.addMeasure(); handled(); }
        else if (lk === 'i') { actions.insert(); handled(); }
        else if (lk === 's') { saveProject(); handled(); }
        else if (k === 'ArrowUp') { actions.octave(1); handled(); }
        else if (k === 'ArrowDown') { actions.octave(-1); handled(); }
        return;
      }
      if (k === ' ') { togglePlay(); handled(); return; }
      if (k === 'Home') { rewind(); handled(); return; }
      if (k === '?') { setDialog('help'); handled(); return; }
      if (k === 'Escape') { setSel(null); return; }
      const n = score.events.length;
      if (k === 'ArrowRight' || k === 'ArrowLeft') {
        const d = k === 'ArrowRight' ? 1 : -1;
        if (!sel) setSel({ a: 0, f: 0 });
        else {
          const f = Math.max(0, Math.min(n - 1, sel.f + d));
          setSel(e.shiftKey ? { a: sel.a, f } : { a: f, f });
          if (!e.shiftKey) preview(score.events[f].pitches);
        }
        handled();
        return;
      }
      if (!range) return;
      if (/^[a-g]$/i.test(k)) { actions.letter(k.toUpperCase() as Letter, e.shiftKey); handled(); }
      else if (DIGIT_DUR[k]) { actions.setDur(DIGIT_DUR[k]); handled(); }
      else if (k === '.') { actions.toggleDot(); handled(); }
      else if (k === '0' || k.toLowerCase() === 'r') { actions.toRest(); handled(); }
      else if (k === 'Delete' || k === 'Backspace') { (e.shiftKey ? actions.remove : actions.toRest)(); handled(); }
      else if (k === 'Insert') { actions.insert(); handled(); }
      else if (k === 'ArrowUp') { actions.semitone(1); handled(); }
      else if (k === 'ArrowDown') { actions.semitone(-1); handled(); }
      else if (k.toLowerCase() === 't') { actions.toggleTie(); handled(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ------------------------------------------------------------ view

  const playingEvent = playTick !== null ? eventAtTick(score.events, playTick) : null;
  const mt = measureTicks(ts);
  const posTick = playTick ?? (range ? starts[range[0]] : resumeTick);
  const beatTicks = (TPQ * 4) / ts.den;
  const secs = (posTick / TPQ) * (60 / score.tempo);
  const position = `${Math.floor(posTick / mt) + 1}小節 ${Math.floor((posTick % mt) / beatTicks) + 1}拍 · ${Math.floor(secs / 60)}:${(secs % 60).toFixed(1).padStart(4, '0')}`;
  const curValue = cur ? valueForTicks(cur.ticks) : undefined;
  const hasNotes = score.events.some((e) => e.pitches.length);

  const selInfo = cur
    ? [
        `${Math.floor(starts[range![0]] / mt) + 1}小節目`,
        cur.pitches.length ? cur.pitches.map((p) => pitchName(p + score.transpose, wFifths)).join('・') : '休符',
        curValue ? `${curValue.dots ? '付点' : ''}${DUR_JA[curValue.dur]}` : `${cur.ticks / TPQ}拍`,
        range![1] > range![0] ? `（${range![1] - range![0] + 1}個選択）` : '',
      ].join(' · ')
    : 'クリックで音符を選択';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">𝄞</span>
          <span className="brand-name">By Ear</span>
          <span className="brand-sub">耳コピ・スタジオ</span>
        </div>
        <div className="top-actions">
          <button className="btn primary" onClick={() => setDialog('import')} data-testid="open-import">
            {Icon.wave} <span className="hide-sm">音声から</span>耳コピ
          </button>
          <details className="menu">
            <summary className="btn">ファイル</summary>
            <div className="menu-list" onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).removeAttribute('open')}>
              <button onClick={newScore}>新規作成</button>
              <button onClick={() => openFile.current?.click()}>開く（.byear.json）</button>
              <button onClick={saveProject}>保存（.byear.json）</button>
            </div>
          </details>
          <details className="menu">
            <summary className="btn" data-testid="export-menu">書き出し</summary>
            <div className="menu-list" onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).removeAttribute('open')}>
              <button onClick={exportPdf} data-testid="export-pdf">PDF（印刷用）</button>
              <button onClick={() => download(toMusicXML(score), `${safeName(score.title)}.musicxml`, 'application/vnd.recordare.musicxml+xml')}>
                MusicXML（flat.io / MuseScore 用）
              </button>
              <button onClick={() => download(toMidi(score), `${safeName(score.title)}.mid`, 'audio/midi')}>MIDI</button>
            </div>
          </details>
          <button className={`btn icon ${panel ? 'on' : ''}`} onClick={() => setPanel(!panel)} title="スコア設定" aria-label="スコア設定">
            {Icon.settings}
          </button>
          <button className="btn icon" onClick={() => setDialog('help')} title="操作ガイド (?)" aria-label="操作ガイド">?</button>
          <input
            ref={openFile}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void openProject(f);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      <Toolbar
        s={{
          dur: curValue?.dur ?? inputDur,
          dotted: !!curValue?.dots,
          isRest: !!cur && cur.pitches.length === 0,
          tied: !!cur?.tieNext,
          hasSelection: !!range,
          canUndo: hist.canUndo,
          canRedo: hist.canRedo,
        }}
        a={actions}
      />
      <div className="statusbar">
        <span data-testid="selection-info">{selInfo}</span>
        <span className="muted">
          {keyNameJa(score.keyFifths, score.keyMode)} · {ts.num}/{ts.den}
          {score.transpose ? ` · 記譜 ${score.transpose > 0 ? '+' : ''}${score.transpose}半音` : ''}
        </span>
      </div>

      <div className="workspace">
        <main className="main">
          {!hasNotes && (
            <div className="empty">
              <p><b>耳コピを始めましょう。</b>音声ファイルかマイク録音から自動で楽譜を起こせます。</p>
              <div className="btn-row">
                <button className="btn primary" onClick={() => setDialog('import')}>{Icon.wave} 音声から耳コピ</button>
                <button className="btn" onClick={() => setSel({ a: 0, f: 0 })}>手で入力する</button>
              </div>
              <small className="hint">手入力: 小節をクリック → 音価（5=4分音符 など）→ A〜G キーで入力</small>
            </div>
          )}
          <ScoreView
            score={score}
            selection={range}
            playingEvent={playingEvent}
            onSelect={(i, extend) => {
              if (i === null) return setSel(null);
              setSel(extend && sel ? { a: sel.a, f: i } : { a: i, f: i });
              if (!extend) preview(score.events[i].pitches);
            }}
            onStaffClick={staffClick}
            onEditTitle={(field, value) => patch({ [field]: value })}
          />
        </main>
        {panel && (
          <SettingsPanel
            score={score}
            onChange={patch}
            onTimeSig={changeTimeSig}
            onTransposeScore={transposeScore}
            onClose={() => setPanel(false)}
          />
        )}
      </div>

      <Transport
        playing={playing}
        position={position}
        tempo={score.tempo}
        metronome={metronome}
        instrument={score.instrument}
        scoreVolume={scoreVol}
        originalVolume={origVol}
        hasOriginal={!!original && !!score.audio}
        onPlay={togglePlay}
        onStop={() => { stopPlayback(); setResumeTick(0); }}
        onRewind={rewind}
        onTempo={(bpm) => patch({ tempo: Math.max(20, Math.min(300, bpm)) })}
        onMetronome={setMetronome}
        onInstrument={(instrument) => patch({ instrument })}
        onScoreVolume={setScoreVol}
        onOriginalVolume={setOrigVol}
      />

      {dialog === 'import' && <ImportDialog onClose={() => setDialog(null)} onDone={onTranscribed} />}
      {dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
      {busy && <div className="toast busy" role="status">{busy}</div>}
    </div>
  );
}
