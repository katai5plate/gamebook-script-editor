# Gamebook JSON Interface

このドキュメントは、GamebookスクリプトからコンパイルされるJSON形式の型定義を記述します。

## TypeScript型定義

```ts
/**
 * ゲームブック全体のデータ構造
 * @template P ページ名の型（文字列リテラル型）
 */
interface GamebookData<P extends string = string> {
  /** スクリプト名（DEFINE で指定された名前） */
  name: string;
  /** 定義されたフラグ名のリスト */
  flagNames: string[];
  /** 定義されたページ名のリスト */
  pageNames: P[];
  /** ページ名をキーとしたページコマンドのマップ */
  pages: Record<P, PageCommand[]>;
}

/**
 * ページ内で実行されるコマンドの型
 */
type PageCommand =
  | ExecCommand
  | LineCommand
  | ChoiceCommand
  | GotoCommand
  | PageEndCommand;

/**
 * エンジン側のコマンドを実行
 * EXEC #COMMAND_NAME args...
 */
interface ExecCommand {
  type: "exec";
  /** コマンド名（例: "SET_BG", "PLAY_SE"） */
  func: string;
  /** コマンド引数のリスト */
  args: CommandArg[];
}

/**
 * コマンド引数の型
 */
interface CommandArg {
  /** 引数の型 */
  type: "text" | "flag" | "page";
  /** 引数の値（フラグ・ページの場合は $, @ を除いた名前） */
  value: string;
}

/**
 * テキスト表示コマンド
 * > テキスト または - テキスト
 */
interface LineCommand {
  type: "line";
  /** 新しいテキストブロックの開始かどうか（> なら true, - なら false） */
  isFirst: boolean;
  /** 表示条件のリスト（すべて満たす必要がある） */
  conditions: Condition[];
  /** 表示するテキスト */
  text: string;
}

/**
 * 選択肢ブロック
 * CHOICE [time:duration]
 */
interface ChoiceCommand {
  type: "choice";
  /** 制限時間（指定なしの場合は null） */
  time: "too_short" | "short" | "normal" | "long" | "too_long" | null;
  /** 選択肢のリスト */
  options: ChoiceOption[];
}

/**
 * 選択肢の個別オプション
 * IS "text" @page [conditions] [effects]
 */
interface ChoiceOption {
  /** 選択肢のテキスト（/CANCEL, /TIMEUP の場合は null） */
  text: string | null;
  /** 遷移先のページ名（@^HERE の場合は null） */
  page: string | null;
  /** その場に留まるか（@^HERE の場合は true） */
  noMove: boolean;
  /** 前のページに戻るか（@^BACK の場合は true） */
  toBack: boolean;
  /** /CANCEL で指定されたかどうか */
  wasCancel?: boolean;
  /** /TIMEUP で指定されたかどうか */
  wasTimeup?: boolean;
  /** 選択肢の表示条件 */
  conditions: Condition[];
  /** 選択時に適用される効果 */
  effects: Effect[];
}

/**
 * 自動ページ遷移コマンド（選択肢なし）
 * TO @page [conditions] [effects]
 */
interface GotoCommand {
  type: "goto";
  /** 遷移先のページ名（@^HERE の場合は null） */
  page: string | null;
  /** その場に留まるか（@^HERE の場合は true） */
  noMove: boolean;
  /** 前のページに戻るか（@^BACK の場合は true） */
  toBack: boolean;
  /** 遷移条件 */
  conditions: Condition[];
  /** 遷移時に適用される効果 */
  effects: Effect[];
}

/**
 * ページ終了コマンド
 * RETURN または BACK
 */
interface PageEndCommand {
  type: "page-end";
  /** 終了モード */
  mode: "return" | "back";
}

/**
 * 条件式
 */
interface Condition {
  /**
   * 条件の種類
   * - "true": すべてのフラグが真
   * - "false": すべてのフラグが偽
   * - "true-or": いずれかのフラグが真
   * - "false-or": いずれかのフラグが偽
   * - "mode": モード指定（現在は "not" のみ）
   */
  formula: "true" | "false" | "true-or" | "false-or" | "mode";
  /** 対象フラグ名のリスト（$ を除く） */
  flags: string[];
}

/**
 * 効果（フラグの変更）
 */
interface Effect {
  /**
   * 効果の種類
   * - "to-true": フラグを真に設定
   * - "to-false": フラグを偽に設定
   */
  formula: "to-true" | "to-false";
  /** 対象フラグ名のリスト（$ を除く） */
  flags: string[];
}
```

## JSON出力例

以下は `democode.json` の実際の出力例です。

### 基本的な構造

```json
{
  "name": "main",
  "flagNames": ["key", "wasHighScore"],
  "pageNames": ["cave", "forest", "win", "locked"],
  "pages": {
    "cave": [
      {
        "type": "exec",
        "func": "SET_BG",
        "args": [{ "type": "text", "value": "cave" }]
      },
      {
        "type": "line",
        "isFirst": true,
        "conditions": [],
        "text": "暗い洞窟。"
      },
      {
        "type": "line",
        "isFirst": false,
        "conditions": [],
        "text": "鍵のかかった扉がある。"
      },
      {
        "type": "choice",
        "time": null,
        "options": [
          {
            "text": "森へ出る",
            "page": "forest",
            "noMove": false,
            "toBack": false,
            "conditions": [],
            "effects": []
          },
          {
            "text": "扉を開ける",
            "page": "win",
            "noMove": false,
            "toBack": false,
            "conditions": [
              { "formula": "true", "flags": ["key"] }
            ],
            "effects": []
          },
          {
            "text": "扉を開ける",
            "page": "locked",
            "noMove": false,
            "toBack": false,
            "conditions": [
              { "formula": "false", "flags": ["key"] }
            ],
            "effects": []
          }
        ]
      },
      {
        "type": "page-end",
        "mode": "return"
      }
    ]
  }
}
```

### GotoCommand (TO命令) の例

```json
{
  "type": "goto",
  "page": null,
  "noMove": true,
  "toBack": false,
  "conditions": [],
  "effects": [
    {
      "formula": "to-false",
      "flags": ["key", "wasHighScore"]
    }
  ]
}
```

この例は `TO @^HERE to-false:$key,$wasHighScore` に対応するJSON出力です。

## Unity (C#) での利用

```csharp
using System;
using System.Collections.Generic;
using Newtonsoft.Json;

[Serializable]
public class GamebookData
{
    public string name;
    public string[] flagNames;
    public string[] pageNames;
    public Dictionary<string, PageCommand[]> pages;
}

[Serializable]
public class PageCommand
{
    public string type; // "exec", "line", "choice", "goto", "page-end"

    // ExecCommand
    public string func;
    public CommandArg[] args;

    // LineCommand
    public bool isFirst;
    public Condition[] conditions;
    public string text;

    // ChoiceCommand
    public string time;
    public ChoiceOption[] options;

    // GotoCommand
    public string page;
    public bool noMove;
    public bool toBack;
    public Effect[] effects;

    // PageEndCommand
    public string mode;
}

[Serializable]
public class CommandArg
{
    public string type; // "text", "flag", "page"
    public string value;
}

[Serializable]
public class ChoiceOption
{
    public string text; // null for /CANCEL, /TIMEUP
    public string page;
    public bool noMove;
    public bool toBack;
    public bool wasCancel;
    public bool wasTimeup;
    public Condition[] conditions;
    public Effect[] effects;
}

[Serializable]
public class Condition
{
    public string formula; // "true", "false", "true-or", "false-or", "mode"
    public string[] flags;
}

[Serializable]
public class Effect
{
    public string formula; // "to-true", "to-false"
    public string[] flags;
}

// 使用例
public class GamebookRunner
{
    private GamebookData data;
    private Dictionary<string, bool> flagStates = new Dictionary<string, bool>();

    public void LoadGamebook(string jsonText)
    {
        data = JsonConvert.DeserializeObject<GamebookData>(jsonText);

        // フラグの初期化（すべて false）
        foreach (var flagName in data.flagNames)
        {
            flagStates[flagName] = false;
        }
    }

    public PageCommand[] GetPage(string pageName)
    {
        return data.pages[pageName];
    }

    public bool EvaluateCondition(Condition condition)
    {
        switch (condition.formula)
        {
            case "true":
                foreach (var flag in condition.flags)
                    if (!flagStates[flag]) return false;
                return true;

            case "false":
                foreach (var flag in condition.flags)
                    if (flagStates[flag]) return false;
                return true;

            case "true-or":
                foreach (var flag in condition.flags)
                    if (flagStates[flag]) return true;
                return false;

            case "false-or":
                foreach (var flag in condition.flags)
                    if (!flagStates[flag]) return true;
                return false;

            default:
                return true;
        }
    }

    public void ApplyEffect(Effect effect)
    {
        bool targetValue = effect.formula == "to-true";
        foreach (var flag in effect.flags)
        {
            flagStates[flag] = targetValue;
        }
    }
}
```

## 注意事項

### GotoCommand（TO命令）の型判定

`GotoCommand` は `type: "goto"` を持ちます:

```csharp
// TypeScriptの場合
if (command.type === 'goto') {
    // GotoCommand
}

// C#の場合
if (command.type == "goto") {
    // GotoCommand
}
```

### 条件の評価順序

- `conditions` 配列内の条件はすべて AND で結合されます
- 複数の `Condition` がある場合、すべてが真である必要があります
- OR条件が必要な場合は `true-or:` または `false-or:` を使用します

### フラグ名の扱い

- JSONに格納されるフラグ名には `$` プレフィックスが**含まれません**
- 例: スクリプト上の `$key` → JSON上では `"key"`
- ページ名も同様に `@` プレフィックスが除去されます
