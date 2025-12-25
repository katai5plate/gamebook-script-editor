// Gamebook言語の定数定義
// すべての構文定義、パターン、ドキュメントを一元管理

// 構文定義データベース
export const SYNTAX_RULES = {
  DEFINE: {
    maxOccurrences: 1,
    mustBeFirstLine: true,
    args: [{ type: "text", required: true }],
  },
  PAGE: {
    args: [{ type: "page", required: true }],
  },
  EXEC: {
    args: "dynamic", // executes.jsonから動的に取得
  },
  CHOICE: {
    args: [{ type: "time", required: false }],
  },
  IS: {
    requiresPrevious: ["CHOICE", "IS"],
    args: [
      { type: "text_or_special", required: true },
      { type: "page", required: true },
      { type: "conditions_effects", required: false, multiple: true },
    ],
  },
  TO: {
    args: [
      { type: "page", required: true },
      { type: "conditions_effects", required: false, multiple: true },
    ],
  },
  RETURN: {
    args: [],
  },
  BACK: {
    args: [],
  },
  FLAG: {
    args: [{ type: "flag", required: true, multiple: true }],
  },
};

// 引数型の検証パターン
export const ARG_TYPE_PATTERNS = {
  page: /^@([a-zA-Z_]+|\^(HERE|BACK))$/,
  flag: /^\$[a-zA-Z_]+$/,
  text: /^".*"$/,
  time: /^time:(too_short|short|normal|long|too_long)$/,
  text_or_special: /^("|\/SAME|\/CANCEL|\/TIMEUP)/,
  conditions_effects:
    /^(mode:not|mode:|true:|false:|true-or:|false-or:|to-true:|to-false:)/,
};

// ホバードキュメント
export const HOVER_DOCS = {
  // コマンド
  DEFINE: {
    title: "DEFINE",
    description: "スクリプトの定義セクション。1行目に必ず書く必要があります。",
    syntax: "DEFINE",
    example: "DEFINE\n  FLAG $key\n  FLAG $hasItem",
  },
  PAGE: {
    title: "PAGE",
    description: "ページの開始を宣言します。",
    syntax: "PAGE @page_name",
    example: "PAGE @cave",
  },
  CHOICE: {
    title: "CHOICE",
    description: "選択肢の開始を宣言します。時間制限を設定できます。",
    syntax: "CHOICE [time:duration]",
    example: 'CHOICE time:normal\n  IS "進む" @next\n  IS "戻る" @back',
  },
  IS: {
    title: "IS",
    description: "選択肢の項目を定義します。CHOICEまたはISの後にのみ書けます。",
    syntax:
      'IS {"text"|/SAME|/CANCEL|/TIMEUP} @page_name [conditions] [effects]',
    example: 'IS "鍵を拾う" @forest true:$hasKey to-true:$gotKey',
  },
  TO: {
    title: "TO",
    description: "選択肢を経由しないページ遷移を行います。",
    syntax: "TO @page_name [conditions] [effects]",
    example: "TO @next true:$hasKey to-false:$usedKey",
  },
  RETURN: {
    title: "RETURN",
    description: "現在のページの冒頭に戻ります。",
    syntax: "RETURN",
    example: "RETURN",
  },
  BACK: {
    title: "BACK",
    description: "直前のページの冒頭に戻ります。",
    syntax: "BACK",
    example: "BACK",
  },
  EXEC: {
    title: "EXEC",
    description: "エンジン側のコマンドを実行します。",
    syntax: "EXEC #COMMAND_NAME [args...]",
    example: 'EXEC #SET_BG "cave"\nEXEC #PLAY_SE "finish" "normal"',
  },
  FLAG: {
    title: "FLAG",
    description: "フラグを宣言します。DEFINE内でのみ使用できます。",
    syntax: "FLAG $flag_name [$flag_name...]",
    example: "FLAG $key $hasItem",
  },

  // 特殊キーワード
  "/SAME": {
    title: "/SAME",
    description: "直前のIS行のテキストを引用します。",
    syntax: "/SAME",
    example: 'IS "扉を開ける" @win true:$key\nIS /SAME @locked false:$key',
  },
  "/CANCEL": {
    title: "/CANCEL",
    description: "選択肢をキャンセルした時の動作を定義します。",
    syntax: "/CANCEL",
    example: "IS /CANCEL @previous",
  },
  "/TIMEUP": {
    title: "/TIMEUP",
    description:
      "時間切れになった時の動作を定義します。CHOICEにtime指定が必要です。",
    syntax: "/TIMEUP",
    example:
      'CHOICE time:short\n  IS "急いで逃げる" @escape\n  IS /TIMEUP @caught',
  },

  // メタコード
  "@^HERE": {
    title: "@^HERE",
    description: "ページ遷移せず、現在のページに留まります。",
    syntax: "@^HERE",
    example: 'IS "アイテムを拾う" @^HERE to-true:$gotItem',
  },
  "@^BACK": {
    title: "@^BACK",
    description: "直前のページに戻ります。",
    syntax: "@^BACK",
    example: 'IS "戻る" @^BACK',
  },

  // 条件
  "mode:not": {
    title: "mode:not",
    description: "条件を反転します。後続の条件が偽の場合に真となります。",
    syntax: "mode:not [conditions]",
    example: "mode:not true:$hasKey> 鍵を持っていない",
  },
  "mode:": {
    title: "mode:",
    description: "条件モードを指定します(現在はnotのみ実装)。",
    syntax: "mode:not",
    example: "mode:not true:$flag",
  },
  "true:": {
    title: "true:",
    description: "指定されたフラグ（複数可）がすべて真の場合に条件を満たします。",
    syntax: "true:$flag1,$flag2,...",
    example: "true:$hasKey,$hasTorch> 鍵と松明を両方持っている",
  },
  "false:": {
    title: "false:",
    description: "指定されたフラグ（複数可）がすべて偽の場合に条件を満たします。",
    syntax: "false:$flag1,$flag2,...",
    example: "false:$hasKey,$hasTorch> 鍵も松明も持っていない",
  },
  "true-or:": {
    title: "true-or:",
    description: "複数のフラグのいずれかが真の場合に条件を満たします。",
    syntax: "true-or:$flag1,$flag2,...",
    example: "true-or:$key1,$key2,$key3> いずれかの鍵を持っている",
  },
  "false-or:": {
    title: "false-or:",
    description: "複数のフラグのいずれかが偽の場合に条件を満たします。",
    syntax: "false-or:$flag1,$flag2,...",
    example: "false-or:$item1,$item2> いずれかのアイテムを持っていない",
  },

  // 効果
  "to-true:": {
    title: "to-true:",
    description: "指定されたフラグ（複数可）を真に設定します。",
    syntax: "to-true:$flag1,$flag2,...",
    example: 'IS "宝箱を開ける" @^HERE to-true:$openedChest,$hasGold',
  },
  "to-false:": {
    title: "to-false:",
    description: "指定されたフラグ（複数可）を偽に設定します。",
    syntax: "to-false:$flag1,$flag2,...",
    example: 'IS "アイテムを使う" @next to-false:$hasPotion,$hasBomb',
  },

  // 時間指定
  "time:": {
    title: "time:",
    description: "CHOICEの制限時間を指定します。",
    syntax: "time:{too_short|short|normal|long|too_long}",
    example: "CHOICE time:short",
  },
  "time:too_short": {
    title: "time:too_short",
    description: "非常に短い制限時間を設定します。",
    syntax: "time:too_short",
    example: "CHOICE time:too_short",
  },
  "time:short": {
    title: "time:short",
    description: "短い制限時間を設定します。",
    syntax: "time:short",
    example: "CHOICE time:short",
  },
  "time:normal": {
    title: "time:normal",
    description: "通常の制限時間を設定します。",
    syntax: "time:normal",
    example: "CHOICE time:normal",
  },
  "time:long": {
    title: "time:long",
    description: "長い制限時間を設定します。",
    syntax: "time:long",
    example: "CHOICE time:long",
  },
  "time:too_long": {
    title: "time:too_long",
    description: "非常に長い制限時間を設定します。",
    syntax: "time:too_long",
    example: "CHOICE time:too_long",
  },
};

// キーワード一覧（補完用）
export const KEYWORDS = [
  // コマンド
  "PAGE",
  "CHOICE",
  "IS",
  "EXEC",
  "TO",
  "RETURN",
  "BACK",
  "DEFINE",
  "FLAG",
  // 特殊キーワード
  "/SAME",
  "/CANCEL",
  "/TIMEUP",
  // 条件
  "mode:not",
  "mode:",
  "true:",
  "false:",
  "true-or:",
  "false-or:",
  // 効果
  "to-true:",
  "to-false:",
  // 時間条件
  "time:too_short",
  "time:short",
  "time:normal",
  "time:long",
  "time:too_long",
];

// 時間オプション一覧
export const TIME_OPTIONS = [
  "too_short",
  "short",
  "normal",
  "long",
  "too_long",
];

// 特殊選択肢一覧
export const SPECIAL_CHOICES = ["/SAME", "/CANCEL", "/TIMEUP"];

// 共通正規表現パターン
export const REGEX_PATTERNS = {
  pageRef: /@([a-zA-Z_]+)/g,
  flagRef: /\$([a-zA-Z_]+)/g,
  execCmd: /#([A-Z_]+)/g,
  timeSpec: /time:(too_short|short|normal|long|too_long)/,
  specialChoice: /\/(SAME|CANCEL|TIMEUP)/,
  metaCode: /@\^(HERE|BACK)/,
};

// 共通ユーティリティ関数

/**
 * 引数文字列をパースして配列に変換する
 * クォート内のスペースは区切り文字として扱わない
 * @param {string} argsText - パース対象の引数文字列
 * @returns {string[]} パースされた引数の配列
 */
export function parseArgs(argsText) {
  const args = [];
  let currentArg = "";
  let inQuotes = false;

  for (let j = 0; j < argsText.length; j++) {
    const char = argsText[j];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentArg += char;
    } else if (char === " " && !inQuotes) {
      if (currentArg) {
        args.push(currentArg);
        currentArg = "";
      }
    } else {
      currentArg += char;
    }
  }
  if (currentArg) {
    args.push(currentArg);
  }
  return args;
}
