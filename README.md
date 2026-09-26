# By Ear — 耳コピ・スタジオ

音声ファイルやマイク録音から**自動で耳コピ**して楽譜にし、flat.io のような UI で**編集・再生**、**PDF / MusicXML / MIDI に書き出し**できるブラウザアプリです。解析はすべてブラウザ内で行われ、音声がサーバーに送られることはありません。

## できること

| | |
|---|---|
| 🎧 **耳コピ** | mp3 / wav / m4a / ogg / webm などの音声、またはマイク録音から採譜 |
| ・単旋律モード | YIN 法のピッチ検出（Web Worker）。管楽器・歌のメロディ向け。高速・高精度 |
| ・和音モード（AI） | Spotify の [Basic Pitch](https://github.com/spotify/basic-pitch-ts) による多声採譜。ピアノ・ギター・スティールパンの和音など |
| ・自動推定 | テンポ（タップテンポ・手動指定も可）、拍の頭、調（Krumhansl–Schmuckler）、音部記号、チューニングのズレ |
| ・楽器プリセット | B♭トランペット、E♭アルトサックス、F ホルン、スティールパン、ヘ音記号 など（移調楽器は記譜音で表示） |
| ✏️ **編集** | クリック選択 / 範囲選択、音名キー（A〜G）入力、選択中の音をクリックした高さへ移動、音価・付点・休符・タイ・♯♭・オクターブ、挿入・削除、コピー＆ペースト、小節の追加削除、Undo / Redo、調・拍子・移調の変更 |
| ▶️ **再生** | 再生カーソル付き、選択位置から再生、メトロノーム、音色（ピアノ / トランペット / スティールパン / フルート / オルガン）、**原音と重ねて再生**（ズレた音の確認に） |
| 📄 **書き出し** | PDF（A4・複数ページ・楽譜はベクター）、MusicXML（flat.io / MuseScore に読み込み可）、MIDI、プロジェクト保存（.byear.json） |
| 💾 | 編集内容はブラウザに自動保存 |

キーボード操作の一覧はアプリ右上の「?」から見られます。スマホ（Android の Chrome など）ではツールバーの音名パッドで入力できます。

## 使い方（開発）

```bash
npm install        # Basic Pitch のモデルも public/models にコピーされます
npm run dev        # http://localhost:5173
npm test           # ユニットテスト（Vitest）
npm run e2e        # E2E テスト（Playwright）
npm run build      # dist/ に静的ファイルを出力
```

`dist/` は静的ファイルだけなので、GitHub Pages などにそのまま置けます。`main` への push で `.github/workflows/pages.yml` が GitHub Pages にデプロイします（リポジトリの Settings → Pages → Source を「GitHub Actions」にしてください）。

## 構成

```
src/
  audio/    解析（yin.ts, segment.ts, tempo.ts, quantize.ts, polyphonic.ts）と再生（player.ts）、録音
  model/    楽譜モデル（1声・和音可）、音楽理論（綴り・調・音価分解）、編集操作
  render/   VexFlow による描画（段組み・タイ・クリック判定）
  export/   PDF（jsPDF + svg2pdf.js）、MusicXML、MIDI
  components/  React UI
tests/      解析パイプラインや編集操作のユニットテスト（合成音で検証）
e2e/        ブラウザでの通しテスト
```

楽譜は「イベント（音符・和音・休符）の列」として持ち、小節線をまたぐ音は描画時にタイで自動分割されます。音価の変更は flat.io / MuseScore と同じく上書き方式です（長くすると後ろの音を食い、短くすると休符が入る）。

## 制限

- 1 パート 1 声部（和音は可）です。大譜表や複数パートは未対応です。
- 自動採譜は「下書き」です。伴奏入りの音源ではメロディ抽出が難しいので、和音モードや解析範囲の指定、手修正と組み合わせてください。
- 3 連符は未対応です（最小 32 分音符）。

## ライセンス表記

- 和音モードは [Basic Pitch](https://github.com/spotify/basic-pitch-ts)（Apache-2.0, Spotify）のモデルを使用しています。
- 楽譜描画は [VexFlow](https://github.com/0xfe/vexflow)（MIT）を使用しています。
