# Claude 向け開発ガイド

このドキュメントは、このプロジェクトに初めて触れる Claude が迅速に開発作業を開始できるようにするためのガイドです。

## プロジェクト概要

**gamebook-script-editor** は、ゲームブック形式のノベルゲームシナリオを記述するための専用スクリプトエディタです。Monaco Editor をベースに、カスタム言語のシンタックスハイライト、補完、バリデーション、ホバードキュメントを実装しています。

### 主な特徴

- リアルタイムバリデーション（構文エラー、未定義参照の検出）
- インテリセンス（コマンド、ページ、フラグの自動補完）
- ホバードキュメント（コマンドの説明表示）
- カスタムシンタックスハイライト

---

## プロジェクト構成

```
gamebook-script-editor/
├── index.html              # エディタのメインHTML
├── package.json            # npm設定（ES modules、lintスクリプト）
├── executes.json           # エンジン側コマンド定義
├── REFERENCE.md            # シナリオライター向けリファレンス
├── GUIDE_FOR_CLAUDE.md     # このファイル（開発者向けガイド）
├── README.md               # プロジェクト概要
├── cli/
│   ├── validate.js         # CLI用バリデーションツール（CI/CD対応）
│   ├── parse.js            # CLI用パーサー
│   └── capture-syntax.js   # シンタックスハイライトのスナップショット取得ツール
├── spec/
│   ├── advance.gbs         # テストスクリプト（全機能網羅）
│   ├── basic.gbs           # 基本機能テストスクリプト
│   ├── test.gbs            # テストスクリプト
│   └── test2.gbs           # テストスクリプト
├── snapshot/               # シンタックスハイライトのスナップショット（.gitignore）
│   ├── advance.view        # advance.gbsのレンダリング結果
│   ├── basic.view          # basic.gbsのレンダリング結果
│   ├── test.view           # test.gbsのレンダリング結果
│   └── test2.view          # test2.gbsのレンダリング結果
└── src/
    ├── constants.js        # 定数・構文定義（★最重要）
    ├── language.js         # Monaco言語定義（シンタックスハイライト）
    ├── theme.js            # エディタテーマ定義
    ├── completion.js       # 補完プロバイダー
    ├── validation.js       # バリデーションロジック（Browser + CLI対応）
    ├── hover.js            # ホバープロバイダー
    └── parser.js           # パーサー
```

---

## 言語仕様について

**必読**: Gamebook スクリプト言語の詳細な仕様は [REFERENCE.md](REFERENCE.md) を参照してください。

### 簡易まとめ

- **DEFINE**: スクリプト開始宣言（1 行目必須）
- **FLAG**: フラグ変数の宣言
- **PAGE**: ページ（シーン）の定義
- **CHOICE**: 選択肢の提示
- **IS**: 選択肢の内容定義
- **TO**: 自動ページ遷移
- **EXEC**: エンジン側コマンド実行
- **RETURN/BACK**: ページ遷移制御

### 特殊記法

- `@page_name` - ページ参照
- `$flag_name` - フラグ参照
- `#COMMAND_NAME` - エンジンコマンド
- `/SAME`, `/CANCEL`, `/TIMEUP` - 特殊キーワード
- `@^HERE`, `@^BACK` - メタコード

詳細は [REFERENCE.md](REFERENCE.md) を参照。

---

## 重要ファイル解説

### 1. `src/constants.js` ★ 最重要 ★

**全ての構文定義、パターン、ドキュメントがここに集約されています。**

新しいコマンドを追加する場合、ほぼこのファイルだけを編集すれば OK です。

#### 主要な定数

##### `SYNTAX_RULES`

各コマンドの構文定義。引数の型、必須/任意、前行要件などを定義。

```javascript
export const SYNTAX_RULES = {
  COMMAND_NAME: {
    maxOccurrences: 1, // 最大出現回数（オプション）
    mustBeFirstLine: true, // 1行目必須か（オプション）
    requiresPrevious: ["CMD"], // 直前行の要件（オプション）
    args: [
      { type: "page", required: true },
      { type: "flag", required: false, multiple: true },
    ],
  },
};
```

**引数型**:

- `page` - ページ参照（`@name`）
- `flag` - フラグ参照（`$name`）
- `text` - テキスト（`"..."`）
- `time` - 時間指定（`time:short`など）
- `text_or_special` - テキストまたは特殊キーワード
- `conditions_effects` - 条件・効果指定

##### `ARG_TYPE_PATTERNS`

引数型の検証用正規表現パターン。

##### `HOVER_DOCS`

ホバー時に表示されるドキュメント。各コマンドの説明、構文、例を定義。

##### `KEYWORDS`, `TIME_OPTIONS`, `SPECIAL_CHOICES`

補完候補のリスト。

---

### 2. `src/validation.js`

バリデーションロジック。`SYNTAX_RULES` と `ARG_TYPE_PATTERNS` を使って構文検証を行います。

**重要**: CLI 環境（Node.js）とブラウザ環境の両方で動作するように設計されています。

#### 主要な機能

- コマンド引数の型チェック
- ページ/フラグの未定義参照チェック
- 重複宣言チェック
- 前行要件チェック
- 不正なコンマ連結検出（例: `true:$a,true:$b` → エラー）
- CLI/Browser 環境の自動判定

#### 重要な関数

- `validateScriptCore(text, options)` - コア検証関数（環境非依存）
- `validateScript(text)` - Monaco 形式ラッパー（Browser 用）
- `validateCommandArgs()` - 汎用引数検証
- `parseArgs()` - 引数パース（クォート考慮）

#### Severity 定数

Monaco Editor 互換の数値定数（マジックナンバー）:

- `Error: 8` - 構文エラー
- `Warning: 4` - 警告
- `Info: 2` - 情報
- `Hint: 1` - ヒント

---

### 3. `src/completion.js`

補完プロバイダー。入力に応じて候補を表示。

#### トリガー文字

- `@` - ページ参照補完
- `$` - フラグ参照補完
- `#` - EXEC コマンド補完
- `/` - 特殊キーワード補完
- スペース - 通常のキーワード補完

#### EXEC 引数補完

`executes.json` の定義に基づき、コマンド引数を補完します。

- `type: "text"` かつ `presets` がある場合 → プリセット候補を表示
- `type: "flag"` の場合 → 既存フラグを候補に表示

---

### 4. `src/hover.js`

ホバープロバイダー。カーソル位置の要素に応じてドキュメントを表示。

#### 対応要素

- コマンドキーワード（`HOVER_DOCS` から取得）
- 特殊キーワード（`/SAME`, `/CANCEL`, `/TIMEUP`）
- メタコード（`@^HERE`, `@^BACK`）
- 条件・効果キーワード（`true:`, `false:`, `true-or:`, `false-or:`, `to-true:`, `to-false:`）
- 時間指定（`time:short` など）
- EXEC コマンド（`executes.json` から引数情報を表示）
- ページ/フラグ参照

---

### 5. `src/language.js`

Monaco Editor の言語定義（トークナイザー）。シンタックスハイライトのためのトークン分類を定義。

---

### 6. `src/theme.js`

エディタのカラーテーマ定義。各トークンの色とスタイルを指定。

---

### 7. `executes.json`

エンジン側で実装されるコマンドの定義ファイル。

```json
[
  {
    "name": "COMMAND_NAME",
    "args": [
      {
        "name": "arg_name",
        "type": "text|flag|page",
        "require": true,
        "presets": ["option1", "option2"]
      }
    ]
  }
]
```

**重要**: このファイルは外部から動的に読み込まれます。変更すれば即座にエディタに反映されます。

---

### 8. `cli/validate.js`

Node.js 環境でスクリプトをバリデーションする CLI ツール。CI/CD 統合用。

```bash
# 使い方
npm run lint                    # spec/advance.gbs を検証
npm run lint path/to/file.gbs  # 指定ファイルを検証
node cli/validate.js *.gbs      # 複数ファイルを検証
```

#### 特徴

- カラー出力（エラー=赤、警告=黄、成功=緑）
- エラーがあれば終了コード 1 で終了（CI/CD 対応）
- `executes.json`を同期的に読み込み
- `validateScriptCore()`を使用（環境非依存）

---

### 9. `cli/parse.js`

Node.js 環境でスクリプトをパースする CLI ツール。

```bash
# 使い方
npm run parse                    # spec/advance.gbs をパース
npm run parse path/to/file.gbs  # 指定ファイルをパース
npm run parse path/to/file.gbs --json  # JSON 出力
node cli/parse.js *.gbs          # 複数ファイルをパース
```

#### 出力

パース結果を JSON 形式で標準出力に出力します。

---

### 10. `cli/capture-syntax.js`

Monaco Editor のシンタックスハイライトのレンダリング結果をスナップショットとして保存するツール。

```bash
# 使い方
npm run capture-syntax
```

#### 仕組み

1. 簡易 HTTP サーバーを起動（ランダムポート）
2. Puppeteer で index.html を開く
3. Monaco Editor が初期化されるのを待つ
4. spec/\*.gbs ファイルを順に読み込み、Monaco Editor に設定
5. レンダリング結果の HTML（.view-lines）を取得
6. フォーマットして snapshot/\*.view ファイルとして保存
7. サーバーをクローズ

#### 出力

- `snapshot/advance.view` - advance.gbs のレンダリング結果
- `snapshot/basic.view` - basic.gbs のレンダリング結果
- `snapshot/test.view` - test.gbs のレンダリング結果
- `snapshot/test2.view` - test2.gbs のレンダリング結果

#### 用途

シンタックスハイライトの実装（`src/language.js`や`src/theme.js`）を変更した際に、実際のレンダリング結果を確認するために使用します。Claude Code にスナップショットファイルを見せることで、意図した通りにハイライトされているかをデバッグできます。

#### 依存関係

- puppeteer（Chromium ベースのヘッドレスブラウザ）

---

### 11. `spec/advance.gbs`

全言語機能を網羅したテストスクリプト。バリデーション機能の動作確認用。

```bash
npm run lint spec/advance.gbs
```

#### カバー範囲

- 全コマンド（DEFINE, PAGE, CHOICE, IS, TO, EXEC, RETURN, BACK, FLAG）
- 条件式（true:, false:, true-or:, false-or:）
- 効果（to-true:, to-false:）
- 特殊キーワード（/SAME, /CANCEL, /TIMEUP）
- メタコード（@^HERE, @^BACK）
- 時間制限（time:）
- 複数フラグ指定
- 複雑な条件組み合わせ

---

## 開発の基本フロー

### 新しいコマンドを追加する場合

1. **`src/constants.js` の `SYNTAX_RULES` に定義を追加**

   ```javascript
   NEWCOMMAND: {
     args: [{ type: "page", required: true }];
   }
   ```

2. **`src/constants.js` の `HOVER_DOCS` にドキュメントを追加**

   ```javascript
   NEWCOMMAND: {
     title: "NEWCOMMAND",
     description: "説明",
     syntax: "NEWCOMMAND @page",
     example: "NEWCOMMAND @example"
   }
   ```

3. **必要に応じて `src/constants.js` の `KEYWORDS` に追加**

   ```javascript
   export const KEYWORDS = [
     // ...
     "NEWCOMMAND",
   ];
   ```

4. **`src/language.js` のトークナイザーに追加（シンタックスハイライト用）**
   ```javascript
   [/PAGE|CHOICE|...|NEWCOMMAND/, "keyword"],
   ```

以上で完了です。バリデーション、補完、ホバーは自動的に対応します。

---

### 新しい引数型を追加する場合

1. **`src/constants.js` の `ARG_TYPE_PATTERNS` にパターンを追加**

   ```javascript
   export const ARG_TYPE_PATTERNS = {
     // ...
     newtype: /^pattern$/,
   };
   ```

2. **`src/validation.js` の `validateCommandArgs()` で特別な処理が必要な場合は追加**
   - 基本的には汎用処理で対応できます

---

### バグ修正の場合

1. **エラーメッセージやバリデーションロジックの問題**
   → `src/validation.js` を確認

2. **補完が表示されない**
   → `src/completion.js` のトリガー条件を確認

3. **ホバーが表示されない**
   → `src/hover.js` の検出ロジックと `src/constants.js` の `HOVER_DOCS` を確認

4. **色が正しく表示されない**
   → `src/language.js` のトークン分類と `src/theme.js` の色定義を確認
   → `npm run capture-syntax` を実行してスナップショットを確認

---

## よくある作業パターン

### 1. コマンドの引数仕様を変更する

`src/constants.js` の `SYNTAX_RULES` を編集するだけです。

**例**: IS コマンドの第 3 引数を必須にする

```javascript
IS: {
  requiresPrevious: ["CHOICE", "IS"],
  args: [
    { type: "text_or_special", required: true },
    { type: "page", required: true },
    { type: "conditions_effects", required: true, multiple: true } // requiredをtrueに変更
  ]
}
```

---

### 2. バリデーションエラーメッセージを変更する

`src/validation.js` 内の `addError()` 呼び出し箇所を検索して、メッセージを変更します。

**例**:

```javascript
addError(
  lineNum,
  startCol,
  endCol,
  `${command}の引数が多すぎます`, // ← このメッセージを変更
  monaco.MarkerSeverity.Error
);
```

---

### 3. 新しい EXEC コマンドを追加する

`executes.json` を編集するだけです。エディタを再読み込みすれば反映されます。

```json
{
  "name": "NEW_COMMAND",
  "args": [
    {
      "name": "target",
      "type": "page",
      "require": true
    }
  ]
}
```

---

### 4. ホバードキュメントの内容を充実させる

`src/constants.js` の `HOVER_DOCS` を編集します。

```javascript
COMMAND: {
  title: "COMMAND",
  description: "より詳しい説明を追加",
  syntax: "COMMAND @page [options]",
  example: "COMMAND @example true:$flag to-true:$result"
}
```

---

### 5. シンタックスハイライトのデバッグ

`src/language.js`や`src/theme.js`を変更した後、実際のレンダリング結果を確認します。

```bash
npm run capture-syntax
```

`snapshot/`ディレクトリに生成された`.view`ファイルを Claude Code に見せて、意図した通りにハイライトされているか確認します。

#### デバッグフロー

1. `src/language.js`または`src/theme.js`を修正
2. `npm run capture-syntax`を実行
3. `snapshot/*.view`ファイルを確認
4. 問題があれば修正して再度実行

---

## デバッグのコツ

### 1. コンソールを確認する

ブラウザの開発者ツールでコンソールエラーを確認。特に：

- `fetch` の失敗（`executes.json` が読み込めない）
- モジュールのインポートエラー
- 正規表現のエラー

### 2. バリデーションロジックのデバッグ

`src/validation.js` の `validateScript()` 内で `console.log()` を追加して、
パースされた引数や検証結果を確認します。

```javascript
const args = parseArgs(argsText);
console.log("Parsed args:", args); // デバッグ用
```

### 3. 補完が動作しない場合

`src/completion.js` の `provideCompletionItems()` で、
条件分岐のどこに入っているか確認します。

```javascript
console.log("lastChar:", lastChar);
console.log("textBeforeCursor:", textBeforeCursor);
```

---

## アーキテクチャの設計思想

### データ駆動設計

すべての構文定義を `src/constants.js` に集約することで、メンテナンス性を向上。
コマンドを追加する際、複数ファイルを編集する必要がありません。

### 汎用検証関数

`validateCommandArgs()` は `SYNTAX_RULES` と `ARG_TYPE_PATTERNS` を使って、
どのコマンドでも同じロジックで検証できるように設計されています。

### モジュール分離

各機能（補完、バリデーション、ホバー）を独立したモジュールに分離し、
ES6 モジュールとして `index.html` でインポートしています。

---

## 注意事項

### 1. Monaco Editor のグローバル変数

`monaco` オブジェクトはグローバルに存在します。モジュール内で `monaco.languages.CompletionItemKind` などを直接使用できます。

### 2. executes.json の相対パス

`src/` ディレクトリ内のファイルから `executes.json` を読み込む際は、
相対パス `../executes.json` を使用します。

### 3. コメント除去処理

バリデーション時、引数をパースする前にコメント（`//` 以降）を除去しています。
クォート内の `//` は除去されません。

### 4. EXEC 引数の特殊処理

`EXEC` コマンドは `executes.json` から動的に引数定義を取得するため、
`src/validation.js` 内で特別な処理が実装されています。

---

## トラブルシューティング

### 問題: エディタが真っ白で何も表示されない

- **原因**: モジュールのインポートエラー
- **解決**: ブラウザコンソールでエラーを確認。パスが正しいか確認。

### 問題: バリデーションエラーが表示されない

- **原因**: `validateScript()` が正しく呼ばれていない
- **解決**: `index.html` の `editor.onDidChangeModelContent()` が登録されているか確認

### 問題: 補完候補が表示されない

- **原因**: トリガー文字が正しく設定されていない、または条件分岐に入っていない
- **解決**: `triggerCharacters` と条件分岐ロジックを確認

### 問題: ホバーが表示されない

- **原因**: 範囲計算が間違っている、または `HOVER_DOCS` に定義がない
- **解決**: カーソル位置の検出ロジックと `HOVER_DOCS` の定義を確認

---

## 参考リソース

- **Monaco Editor API**: https://microsoft.github.io/monaco-editor/api/index.html
- **言語仕様**: [REFERENCE.md](REFERENCE.md)
- **開発メモ**: [README.md](README.md)

---

このガイドで不明点があれば、既存コードを読みながら理解を深めてください。
特に `src/constants.js` と `src/validation.js` がコアロジックです。
