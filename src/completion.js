// Gamebook言語の補完プロバイダー
import {
  KEYWORDS,
  TIME_OPTIONS,
  SPECIAL_CHOICES,
  REGEX_PATTERNS,
  parseArgs,
} from "./constants.js";

export function createCompletionProvider() {
  // executes.jsonから#コマンドと引数定義を読み込む
  let executeCommands = [];
  let executeDefinitions = [];
  fetch("../executes.json")
    .then((res) => res.json())
    .then((data) => {
      executeCommands = data.map((cmd) => cmd.name);
      executeDefinitions = data;
    })
    .catch((err) => console.warn("Failed to load executes.json:", err));

  return {
    triggerCharacters: ["@", "$", "#", " ", "/", ":", ","],
    provideCompletionItems: (model, position) => {
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);
      const lastChar = textBeforeCursor.slice(-1);

      const text = model.getValue();
      const suggestions = [];

      // @を入力した場合
      if (lastChar === "@") {
        // 既出のページ名を抽出
        const allPageRefs = text.matchAll(REGEX_PATTERNS.pageRef);
        const allPageNames = new Set(Array.from(allPageRefs, (m) => m[1]));

        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - 1,
          endColumn: word.endColumn,
        };

        for (const name of allPageNames) {
          suggestions.push({
            label: "@" + name,
            kind: monaco.languages.CompletionItemKind.Reference,
            insertText: "@" + name,
            range: range,
          });
        }

        // @^メタコード
        suggestions.push({
          label: "@^HERE",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: "@^HERE",
          range: range,
        });
        suggestions.push({
          label: "@^BACK",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: "@^BACK",
          range: range,
        });
      }
      // $を入力した場合
      else if (lastChar === "$") {
        // 既出のフラグ名を抽出
        const allFlagRefs = text.matchAll(REGEX_PATTERNS.flagRef);
        const allFlagNames = new Set(Array.from(allFlagRefs, (m) => m[1]));

        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - 1,
          endColumn: word.endColumn,
        };

        for (const name of allFlagNames) {
          suggestions.push({
            label: "$" + name,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: "$" + name,
            range: range,
          });
        }
      }
      // #を入力した場合
      else if (lastChar === "#") {
        // executes.jsonから読み込んだコマンドを候補に追加
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - 1,
          endColumn: word.endColumn,
        };

        for (const cmd of executeCommands) {
          suggestions.push({
            label: "#" + cmd,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: "#" + cmd,
            range: range,
          });
        }
      }
      // /を入力した場合
      else if (lastChar === "/") {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - 1,
          endColumn: word.endColumn,
        };

        for (const special of SPECIAL_CHOICES) {
          suggestions.push({
            label: special,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: special,
            range: range,
          });
        }
      }
      // : または , を入力した場合、条件・効果キーワードの後ならフラグ補完
      else if (lastChar === ":" || lastChar === ",") {
        const conditionEffectMatch = textBeforeCursor.match(/(mode:not|true:|false:|true-or:|false-or:|to-true:|to-false:)([^>\s]*,)*$/);
        if (conditionEffectMatch) {
          // 既出のフラグ名を抽出
          const text = model.getValue();
          const allFlagRefs = text.matchAll(REGEX_PATTERNS.flagRef);
          const allFlagNames = new Set(Array.from(allFlagRefs, (m) => m[1]));

          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column,
            endColumn: word.endColumn,
          };

          for (const name of allFlagNames) {
            suggestions.push({
              label: "$" + name,
              kind: monaco.languages.CompletionItemKind.Variable,
              insertText: "$" + name,
              range: range,
            });
          }

          return { suggestions };
        }
      }
      // 通常のキーワード補完または引数補完
      else {
        // time: と入力した場合、時間候補を表示
        if (textBeforeCursor.endsWith("time:")) {
          for (const option of TIME_OPTIONS) {
            suggestions.push({
              label: option,
              kind: monaco.languages.CompletionItemKind.Value,
              insertText: option,
              detail: "時間指定",
            });
          }
          return { suggestions };
        }

        // m と入力した場合、mode:not を優先的に表示
        const wordMatch = textBeforeCursor.match(/(\S+)$/);
        if (wordMatch && wordMatch[1] === "m") {
          suggestions.push({
            label: "mode:not",
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: "mode:not",
            detail: "条件反転",
            sortText: "0", // 優先的に表示
          });
        }

        // EXEC行で#コマンドの後の場合、引数補完を試みる
        const execMatch = textBeforeCursor.match(/EXEC\s+#([A-Z_]+)\s+(.*)$/);
        if (execMatch && executeDefinitions.length > 0) {
          const cmdName = execMatch[1];
          const argsText = execMatch[2];

          // コマンド定義を検索
          const cmdDef = executeDefinitions.find((cmd) => cmd.name === cmdName);
          if (cmdDef && cmdDef.args && cmdDef.args.length > 0) {
            // 引数をパース（クォート付きテキストを考慮）
            const args = parseArgs(argsText);

            // クォート状態を判定
            let inQuotes = false;
            for (let j = 0; j < argsText.length; j++) {
              if (argsText[j] === '"') {
                inQuotes = !inQuotes;
              }
            }

            // 現在の引数数をカウント
            // 末尾がスペースかつクォート外なら次の引数を入力中
            let argIndex;
            if ((argsText.endsWith(" ") && !inQuotes) || argsText === "") {
              // 次の引数を入力しようとしている
              argIndex = args.length;
            } else {
              // 現在の引数を編集中
              argIndex = args.length > 0 ? args.length - 1 : 0;
            }

            // 対応する引数定義を取得
            if (argIndex >= 0 && argIndex < cmdDef.args.length) {
              const argDef = cmdDef.args[argIndex];

              // type: text の場合、presetsを候補に
              if (
                argDef.type === "text" &&
                argDef.presets &&
                argDef.presets.length > 0
              ) {
                for (const preset of argDef.presets) {
                  suggestions.push({
                    label: preset,
                    kind: monaco.languages.CompletionItemKind.Value,
                    insertText: `"${preset}"`,
                    detail: `${argDef.name} (${cmdName})`,
                  });
                }
                return { suggestions };
              }
              // type: flag の場合、既存のフラグを候補に
              else if (argDef.type === "flag") {
                const allFlagRefs = text.matchAll(REGEX_PATTERNS.flagRef);
                const allFlagNames = new Set(
                  Array.from(allFlagRefs, (m) => m[1])
                );

                for (const name of allFlagNames) {
                  suggestions.push({
                    label: "$" + name,
                    kind: monaco.languages.CompletionItemKind.Variable,
                    insertText: "$" + name,
                    detail: `${argDef.name} (${cmdName})`,
                  });
                }
                return { suggestions };
              }
            }
          }
        }

        // 通常のキーワード補完
        for (const keyword of KEYWORDS) {
          suggestions.push({
            label: keyword,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: keyword,
          });
        }
      }

      return { suggestions };
    },
  };
}
