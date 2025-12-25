// Gamebook言語のシンタックスハイライト定義
export const gamebookLanguageDefinition = {
  tokenizer: {
    root: [
      [/\/\/.*$/, "comment"],
      [/"[^"]*"/, "string"],
      [/@\^[A-Z]+/, "meta-code"],
      [/@[a-zA-Z_]+/, "page-name"],
      [/\$[a-zA-Z_]+/, "flag-name"],
      [/#[A-Z_]+/, "engine-cmd"],
      [/\/[A-Z]+/, "special-choice"],
      [/PAGE|CHOICE|IS|EXEC|RETURN|BACK|DEFINE|FLAG|TO/, "keyword"],
      [/>/, "text-marker"],
      [/-/, "text-continue"],
      [/time:(too_short|short|normal|long|too_long)/, "time-spec"],
      [
        /true:|false:|mode:not|mode:|to-true:|to-false:|true-or:|false-or:/,
        "condition",
      ],
    ],
  },
};
