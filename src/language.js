// Gamebook言語のシンタックスハイライト定義
export const gamebookLanguageDefinition = {
  // デフォルトトークン（state間での引き継ぎを防ぐ）
  defaultToken: "",
  tokenPostfix: ".gbs",

  tokenizer: {
    root: [
      // コメント行（行全体）
      [/\/\/.*$/, "comment"],

      // 引用符文字列
      [/"[^"]*"/, "string"],

      // テキスト行のマーカーは条件・フラグより後にマッチさせる
      // ただし、メタコードやページ名より前
      [/@\^[A-Z]+/, "meta-code"],
      [/@[a-zA-Z_]+/, "page-name"],
      [/\$[a-zA-Z_]+/, "flag-name"],
      [/#[A-Z_]+/, "engine-cmd"],
      [/\/[A-Z]+/, "special-choice"],
      [/PAGE|CHOICE|IS|EXEC|RETURN|BACK|END|DEFINE|FLAG|TO/, "keyword"],
      [/time:(too_short|short|normal|long|too_long)/, "time-spec"],
      [
        /true:|false:|to-true:|to-false:|true-or:|false-or:/,
        "condition",
      ],

      // テキスト行：マーカーと、その後のメッセージ・コメントを分けて処理
      // 条件やフラグの後にマッチするように、ここに配置
      [/>[\t ]*/, "text-marker", "@textLine"],
      [/-[\t ]*/, "text-continue", "@textLine"],
    ],

    // テキスト行のメッセージ部分を処理する状態
    textLine: [
      // メッセージテキスト全体を一度にマッチ（行末まで）
      [/.*$/, "string", "@pop"],
    ],
  },
};
