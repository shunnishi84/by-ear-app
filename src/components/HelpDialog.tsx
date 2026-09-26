const ROWS: [string, string][] = [
  ['クリック', '音符・休符を選択（Shift+クリックで範囲選択）'],
  ['選択中の音をもう一度クリック', 'クリックした高さに音を置く（休符なら音符になる）'],
  ['A〜G', '音名で入力して次へ進む（調号を反映、前の音に近いオクターブ）'],
  ['Shift + A〜G', '和音に音を追加'],
  ['2 / 3 / 4 / 5 / 6 / 7', '32分 / 16分 / 8分 / 4分 / 2分 / 全音符'],
  ['.', '付点'],
  ['0 / R / Delete', '休符にする'],
  ['Shift + Delete', '詰めて削除'],
  ['Insert / Ctrl+I', '選択位置の前に休符を挿入'],
  ['↑ / ↓', '半音上げ / 下げ'],
  ['Ctrl + ↑ / ↓', 'オクターブ上げ / 下げ'],
  ['← / →', '前 / 次の音へ（Shift で範囲選択）'],
  ['T', '次の音とタイ'],
  ['Ctrl + C / X / V', 'コピー / 切り取り / 貼り付け（上書き）'],
  ['Ctrl + Z / Y', '元に戻す / やり直し'],
  ['Ctrl + B', '小節を追加'],
  ['Space', '再生 / 一時停止（選択位置から）'],
  ['Home', '先頭に戻る'],
  ['Esc', '選択解除'],
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="操作ガイド" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>操作ガイド</h2>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <table className="keys">
          <tbody>
            {ROWS.map(([k, v]) => (
              <tr key={k}>
                <th><kbd>{k}</kbd></th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">
          耳コピのコツ: 解析後は「原音」スライダーを上げて楽譜と重ねて再生すると、ズレた音がすぐ分かります。
        </p>
      </div>
    </div>
  );
}
