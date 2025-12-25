# Gamebook Script Compiler 設計書

このドキュメントは、Gamebookスクリプト言語からJSONへのコンパイラの設計仕様を定義します。

## 目次

1. [概要](#概要)
2. [出力JSON構造](#出力json構造)
3. [コンパイラアーキテクチャ](#コンパイラアーキテクチャ)
4. [実装の優先順位](#実装の優先順位)
5. [C#側の実装例](#c側の実装例)

---

## 概要

### 目的

- Unity (C#) でシンプルに実装できるJSON形式を出力する
- 将来的なMarkdown出力にも対応できる構造を維持する
- コンパイル時に可能な限り展開・最適化を行い、ランタイム処理を軽量化する

### 設計方針

1. **シンプル第一**: C#で複雑な処理を書かなくて済む構造
2. **配列ベース**: 条件やフラグは配列で表現し、LINQで処理しやすく
3. **型安全**: JSONの各フィールドがC#のクラスに直接マッピング可能
4. **コンパイル時展開**: `/SAME` などの構文糖衣はコンパイル時に展開

---

## 出力JSON構造

### トップレベル

```json
{
  "name": "main",
  "flags": ["key", "wasHighScore"],
  "startPage": "cave",
  "pages": {
    "cave": { /* Page構造 */ },
    "forest": { /* Page構造 */ }
  }
}
```

**フィールド:**
- `name` (string): スクリプト名（DEFINE の引数）
- `flags` (string[]): 宣言された全フラグのリスト
- `startPage` (string): 開始ページ名（最初のPAGE）
- `pages` (object): ページ名をキーとしたページオブジェクトのマップ

---

### Page構造

```json
{
  "lines": [
    { "type": "exec", "command": "SET_BG", "args": ["cave"] },
    { "type": "text", "content": "暗い洞窟。" },
    {
      "type": "text",
      "content": "地面に小さな鍵。",
      "conditions": [{ "type": "all_false", "flags": ["key"] }]
    }
  ],
  "choice": {
    "time": "short",
    "options": [
      {
        "text": "森へ出る",
        "target": "forest",
        "conditions": [],
        "effects": []
      }
    ]
  },
  "next": { "type": "return" }
}
```

**フィールド:**
- `lines` (Line[]): ページ内の実行される行（テキスト、EXECコマンド）
- `choice` (Choice | null): 選択肢（ない場合はnull）
- `next` (Next): ページ終了後の動作（RETURN, BACK, TO, またはnull）

---

### Line構造

#### テキスト行

```json
{
  "type": "text",
  "content": "暗い洞窟。",
  "conditions": []
}
```

**フィールド:**
- `type` (string): `"text"`
- `content` (string): 表示するテキスト
- `conditions` (Condition[]): 表示条件（オプション、空配列の場合は無条件）

#### EXEC行

```json
{
  "type": "exec",
  "command": "SET_BG",
  "args": ["cave"],
  "conditions": []
}
```

**フィールド:**
- `type` (string): `"exec"`
- `command` (string): コマンド名（`#` なし）
- `args` (string[]): 引数リスト（`"` や `$`, `@` はそのまま文字列として保持）
- `conditions` (Condition[]): 実行条件（オプション）

---

### Condition構造

```json
{ "type": "all_true", "flags": ["key", "torch"] }
```

**フィールド:**
- `type` (string): 条件タイプ
  - `"all_true"` - 全フラグが真（`true:$flag1,$flag2`）
  - `"all_false"` - 全フラグが偽（`false:$flag1,$flag2`）
  - `"any_true"` - いずれかが真（`true-or:$flag1,$flag2`）
  - `"any_false"` - いずれかが偽（`false-or:$flag1,$flag2`）
  - `"not"` - 条件を反転（`mode:not`）
- `flags` (string[]): 対象フラグのリスト（`$` なし）

**`mode:not` の処理:**

スクリプト:
```
mode:not true:$hasKey> 鍵を持っていない
```

JSON出力:
```json
{
  "type": "text",
  "content": "鍵を持っていない",
  "conditions": [
    { "type": "not" },
    { "type": "all_true", "flags": ["hasKey"] }
  ]
}
```

**C#での評価:**
```csharp
// conditions配列の全てがtrueの場合に表示
// "not"の場合は次の条件を反転
```

---

### Choice構造

```json
{
  "time": "short",
  "options": [
    {
      "text": "鍵を拾う",
      "target": "^HERE",
      "conditions": [{ "type": "all_false", "flags": ["key"] }],
      "effects": [{ "type": "set_true", "flags": ["key"] }]
    },
    {
      "text": "洞窟へ戻る",
      "target": "^BACK",
      "conditions": [],
      "effects": []
    }
  ]
}
```

**フィールド:**
- `time` (string | null): 制限時間（`"too_short"`, `"short"`, `"normal"`, `"long"`, `"too_long"` または null）
- `options` (Option[]): 選択肢のリスト

---

### Option構造

```json
{
  "text": "鍵を拾う",
  "target": "forest",
  "conditions": [{ "type": "all_true", "flags": ["hasKey"] }],
  "effects": [{ "type": "set_true", "flags": ["gotKey"] }]
}
```

**フィールド:**
- `text` (string): 選択肢のテキスト（`/SAME`, `/CANCEL`, `/TIMEUP` はコンパイル時に展開される）
- `target` (string): 遷移先ページ名、または特殊値（`"^HERE"`, `"^BACK"`）
- `conditions` (Condition[]): 選択肢の表示条件
- `effects` (Effect[]): 選択時の効果

**特殊キーワードの展開:**

スクリプト:
```
IS "扉を開ける" @win true:$key
IS /SAME @locked false:$key
```

コンパイル後:
```json
[
  { "text": "扉を開ける", "target": "win", ... },
  { "text": "扉を開ける", "target": "locked", ... }
]
```

`/CANCEL` と `/TIMEUP` も同様に展開され、`text` フィールドに特殊な値（`"__CANCEL__"`, `"__TIMEUP__"`）を設定する。

---

### Effect構造

```json
{ "type": "set_true", "flags": ["key", "hasItem"] }
```

**フィールド:**
- `type` (string): 効果タイプ
  - `"set_true"` - フラグを真にする（`to-true:$flag1,$flag2`）
  - `"set_false"` - フラグを偽にする（`to-false:$flag1,$flag2`）
- `flags` (string[]): 対象フラグのリスト（`$` なし）

---

### Next構造

```json
{ "type": "return" }
```

または

```json
{
  "type": "to",
  "target": "gameover",
  "conditions": [{ "type": "all_false", "flags": ["hasKey"] }],
  "effects": []
}
```

**フィールド:**
- `type` (string): 遷移タイプ
  - `"return"` - 現在のページの先頭に戻る（RETURN）
  - `"back"` - 直前のページに戻る（BACK）
  - `"to"` - 指定ページへ遷移（TO）
  - `null` - 何もしない（CHOICEで終了）
- `target` (string): 遷移先（`type`が`"to"`の場合のみ）
- `conditions` (Condition[]): 遷移条件（`type`が`"to"`の場合のみ）
- `effects` (Effect[]): 遷移時の効果（`type`が`"to"`の場合のみ）

---

## コンパイラアーキテクチャ

### ファイル構成

```
src/
  compiler/
    parser.js      # スクリプトをパース→AST構築
    generator.js   # AST→JSON変換
    index.js       # コンパイラのエントリポイント
  validation.js    # 既存（バリデーション）
  constants.js     # 既存（構文定義）
```

### コンパイルフロー

```
スクリプトテキスト
  ↓
validation.js (バリデーション)
  ↓
parser.js (パース)
  ↓
AST (抽象構文木)
  ↓
generator.js (JSON生成)
  ↓
JSON出力
```

---

### parser.js の責務

1. **2パス方式**（validation.jsと同じ）
   - 1パス目: DEFINE, FLAG, PAGE の収集
   - 2パス目: 各ページの内容をパース

2. **行の分類**
   - コマンド行（PAGE, CHOICE, IS, TO, EXEC, RETURN, BACK）
   - テキスト行（`>`, `-` で始まる行）
   - 条件付き行（`true:`, `false:` などで始まる行）

3. **AST構築**
   - ページごとにlines, choice, nextを抽出
   - 条件・効果を構造化

4. **特殊処理**
   - `/SAME` を直前のISのテキストで置換
   - テキストの継続行（`-`）を結合

---

### generator.js の責務

1. **AST → JSON変換**
   - 単純なオブジェクト変換（既に構造化済み）

2. **型情報の付与**
   - Conditionの `type` フィールドを生成
   - Effectの `type` フィールドを生成

3. **最適化**（オプション）
   - 空の配列を削除
   - 不要なフィールドを削除

---

### index.js (エントリポイント)

```javascript
import { validateScript } from '../validation.js';
import { parse } from './parser.js';
import { generate } from './generator.js';

export function compile(scriptText) {
  // 1. バリデーション
  const errors = validateScript(scriptText);
  if (errors.length > 0) {
    throw new CompileError("Validation failed", errors);
  }

  // 2. パース
  const ast = parse(scriptText);

  // 3. JSON生成
  const json = generate(ast);

  return json;
}

class CompileError extends Error {
  constructor(message, errors) {
    super(message);
    this.errors = errors;
  }
}
```

---

## 実装の優先順位

### フェーズ1: 基本コンパイラ（最小限）

**目標**: シンプルなスクリプトをJSONに変換できる

1. **parser.js**
   - DEFINE, FLAG のパース
   - PAGE の抽出
   - 単純なテキスト行（`>`, `-`）のパース
   - RETURN, BACK の処理

2. **generator.js**
   - 基本的なJSON出力

3. **動作確認**
   - Runボタンでコンパイル実行
   - コンソールにJSON出力

**テストケース:**
```
DEFINE "test"
  FLAG $key

PAGE @start
> こんにちは。
- これはテストです。
RETURN
```

---

### フェーズ2: 選択肢の実装

**目標**: CHOICE/ISをサポート

1. **parser.js**
   - CHOICE のパース（time指定含む）
   - IS のパース（テキスト、target、条件、効果）
   - `/SAME` の展開

2. **generator.js**
   - Choice, Option構造の生成

**テストケース:**
```
CHOICE
  IS "進む" @next
  IS "戻る" @back
```

---

### フェーズ3: 条件と効果

**目標**: 条件付きテキスト・選択肢、フラグ操作をサポート

1. **parser.js**
   - 条件の解析（`true:`, `false:`, `true-or:`, `false-or:`, `mode:not`）
   - 効果の解析（`to-true:`, `to-false:`）
   - 条件付きテキスト行のパース

2. **generator.js**
   - Condition, Effect構造の生成

**テストケース:**
```
true:$key> 鍵を持っている
IS "鍵を拾う" @^HERE false:$key to-true:$key
```

---

### フェーズ4: EXEC と TO

**目標**: 全機能をサポート

1. **parser.js**
   - EXEC コマンドのパース（executes.jsonから引数情報取得）
   - TO のパース（条件・効果付き遷移）

2. **generator.js**
   - Exec行の生成
   - Next構造（to）の生成

---

### フェーズ5: UI統合

1. **Runボタン機能**
   - エディタのテキストをコンパイル
   - JSONをプレビュー画面に表示

2. **ブラウザランタイム（ミニ実装）**
   - JSONを読み込んでテストプレイを実行
   - プレビュー画面で動作確認

3. **フローチャート生成**
   - JSON → Mermaid形式に変換
   - フローチャート画面に表示

---

## C#側の実装例

### データクラス定義

```csharp
[System.Serializable]
public class GamebookScript
{
    public string name;
    public string[] flags;
    public string startPage;
    public Dictionary<string, Page> pages;
}

[System.Serializable]
public class Page
{
    public Line[] lines;
    public Choice choice;
    public Next next;
}

[System.Serializable]
public class Line
{
    public string type; // "text" or "exec"
    public string content; // for text
    public string command; // for exec
    public string[] args; // for exec
    public Condition[] conditions;
}

[System.Serializable]
public class Condition
{
    public string type; // "all_true", "all_false", "any_true", "any_false", "not"
    public string[] flags;
}

[System.Serializable]
public class Effect
{
    public string type; // "set_true", "set_false"
    public string[] flags;
}

[System.Serializable]
public class Choice
{
    public string time; // null or "too_short", "short", "normal", "long", "too_long"
    public Option[] options;
}

[System.Serializable]
public class Option
{
    public string text;
    public string target;
    public Condition[] conditions;
    public Effect[] effects;
}

[System.Serializable]
public class Next
{
    public string type; // "return", "back", "to", or null
    public string target; // for "to"
    public Condition[] conditions; // for "to"
    public Effect[] effects; // for "to"
}
```

---

### 条件評価のロジック

```csharp
public class GamebookRuntime
{
    private HashSet<string> activeFlags = new HashSet<string>();
    private Stack<string> pageHistory = new Stack<string>();

    public bool EvaluateConditions(Condition[] conditions)
    {
        bool result = true;
        bool invertNext = false;

        foreach (var cond in conditions)
        {
            bool condResult = cond.type switch
            {
                "all_true" => cond.flags.All(f => activeFlags.Contains(f)),
                "all_false" => cond.flags.All(f => !activeFlags.Contains(f)),
                "any_true" => cond.flags.Any(f => activeFlags.Contains(f)),
                "any_false" => cond.flags.Any(f => !activeFlags.Contains(f)),
                "not" => { invertNext = true; return true; },
                _ => true
            };

            if (invertNext)
            {
                condResult = !condResult;
                invertNext = false;
            }

            result = result && condResult;
        }

        return result;
    }

    public void ApplyEffects(Effect[] effects)
    {
        foreach (var effect in effects)
        {
            switch (effect.type)
            {
                case "set_true":
                    foreach (var flag in effect.flags)
                        activeFlags.Add(flag);
                    break;
                case "set_false":
                    foreach (var flag in effect.flags)
                        activeFlags.Remove(flag);
                    break;
            }
        }
    }

    public string ResolveTarget(string target)
    {
        return target switch
        {
            "^HERE" => pageHistory.Peek(),
            "^BACK" => pageHistory.Skip(1).FirstOrDefault(),
            _ => target
        };
    }
}
```

---

### ページ実行の例

```csharp
public void ExecutePage(Page page)
{
    // 1. 行を順番に実行
    foreach (var line in page.lines)
    {
        if (!EvaluateConditions(line.conditions))
            continue;

        switch (line.type)
        {
            case "text":
                DisplayText(line.content);
                break;
            case "exec":
                ExecuteCommand(line.command, line.args);
                break;
        }
    }

    // 2. 選択肢を表示
    if (page.choice != null)
    {
        var availableOptions = page.choice.options
            .Where(opt => EvaluateConditions(opt.conditions))
            .ToList();

        DisplayChoice(availableOptions);
        // ユーザー選択を待つ...
    }

    // 3. Next処理
    if (page.next != null)
    {
        switch (page.next.type)
        {
            case "return":
                // ページの先頭に戻る（再実行）
                break;
            case "back":
                // 履歴から1つ戻る
                break;
            case "to":
                if (EvaluateConditions(page.next.conditions))
                {
                    ApplyEffects(page.next.effects);
                    GoToPage(ResolveTarget(page.next.target));
                }
                break;
        }
    }
}
```

---

## 注意事項

### 1. 文字列のエスケープ

- テキスト内の `"` は `\"` としてエスケープする必要がある
- JSONとして正しい形式を保つこと

### 2. フラグ名・ページ名の正規化

- スクリプトでは `$key`, `@cave` のように `$`, `@` 付き
- JSON内では `"key"`, `"cave"` のように記号なし

### 3. executes.json との連携

- EXEC コマンドの引数型は executes.json から取得
- 型情報はJSONに含めず、C#側でexecutes.jsonを読む設計も可能

### 4. エラーハンドリング

- コンパイルエラーは CompileError として投げる
- バリデーションエラーは詳細情報を含める

---

## 今後の拡張

### Markdown出力

JSONから以下の形式でMarkdownを生成:

```markdown
# Gamebook: main

## ページ: cave

暗い洞窟。
鍵のかかった扉がある。

**選択肢:**
- 森へ出る → [forest](#forest)
- 扉を開ける → [win](#win) (条件: key)
- 扉を開ける → [locked](#locked) (条件: not key)

---

## ページ: forest
...
```

### デバッグ情報の付与

開発時のみ、各ノードに元のスクリプトの行番号情報を付与:

```json
{
  "type": "text",
  "content": "暗い洞窟。",
  "__debug": { "line": 5 }
}
```

---

このドキュメントに沿ってコンパイラを実装することで、シンプルかつ拡張性の高いシステムが構築できます。
