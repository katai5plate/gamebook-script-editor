// Gamebook言語のテーマ定義
export const gamebookThemeDefinition = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "page-name", foreground: "4EC9B0", fontStyle: "bold" },
    { token: "flag-name", foreground: "DCDCAA" },
    { token: "engine-cmd", foreground: "C586C0" },
    { token: "meta-code", foreground: "569CD6", fontStyle: "bold" },
    { token: "special-choice", foreground: "C586C0", fontStyle: "bold" },
    { token: "keyword", foreground: "569CD6" },
    { token: "string", foreground: "CE9178" },
    { token: "condition", foreground: "B5CEA8" },
    { token: "time-spec", foreground: "D4A5A5" },
    { token: "comment", foreground: "6A9955", fontStyle: "italic" },
    { token: "text-marker", foreground: "D4D4D4" },
    { token: "text-continue", foreground: "D4D4D4" },
  ],
  colors: {},
};
