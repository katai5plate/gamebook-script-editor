// Gamebook言語のホバープロバイダー
import { HOVER_DOCS, REGEX_PATTERNS } from "./constants.js";

export function createHoverProvider() {
  // executes.jsonから読み込んだコマンド定義
  let executeDefinitions = [];
  fetch("../executes.json")
    .then((res) => res.json())
    .then((data) => {
      executeDefinitions = data;
    })
    .catch((err) => console.warn("Failed to load executes.json:", err));

  return {
    provideHover: (model, position) => {
      const lineContent = model.getLineContent(position.lineNumber);
      const cursorColumn = position.column;

      // カーソル位置に存在する要素を検出するヘルパー関数
      function findElementAtCursor(regex, lineContent, cursorColumn) {
        // グローバルフラグがない場合は、一時的にグローバル版を作成
        const globalRegex = new RegExp(
          regex.source,
          regex.flags.includes("g") ? regex.flags : regex.flags + "g"
        );

        for (const match of lineContent.matchAll(globalRegex)) {
          const startCol = match.index + 1; // Monaco は 1-indexed
          const endCol = startCol + match[0].length;

          if (cursorColumn >= startCol && cursorColumn <= endCol) {
            return {
              match: match,
              startCol: startCol,
              endCol: endCol,
            };
          }
        }
        return null;
      }

      // 行頭のコマンドをチェック
      const commandMatch = lineContent.match(
        /^\s*(DEFINE|PAGE|CHOICE|IS|TO|RETURN|BACK|EXEC|FLAG)\b/
      );
      if (commandMatch) {
        const command = commandMatch[1];
        const commandStartCol = lineContent.indexOf(command) + 1;
        const commandEndCol = commandStartCol + command.length;

        if (
          position.column >= commandStartCol &&
          position.column <= commandEndCol
        ) {
          const doc = HOVER_DOCS[command];
          if (doc) {
            return {
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: commandStartCol,
                endColumn: commandEndCol,
              },
              contents: [
                { value: `**${doc.title}**` },
                { value: doc.description },
                { value: `**構文:**\n\`\`\`\n${doc.syntax}\n\`\`\`` },
                { value: `**例:**\n\`\`\`\n${doc.example}\n\`\`\`` },
              ],
            };
          }
        }
      }

      // 特殊キーワードをチェック (/SAME, /CANCEL, /TIMEUP)
      const specialResult = findElementAtCursor(
        REGEX_PATTERNS.specialChoice,
        lineContent,
        cursorColumn
      );
      if (specialResult) {
        const specialKeyword = "/" + specialResult.match[1];
        const doc = HOVER_DOCS[specialKeyword];
        if (doc) {
          return {
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: specialResult.startCol,
              endColumn: specialResult.endCol,
            },
            contents: [
              { value: `**${doc.title}**` },
              { value: doc.description },
              { value: `**構文:**\n\`\`\`\n${doc.syntax}\n\`\`\`` },
              { value: `**例:**\n\`\`\`\n${doc.example}\n\`\`\`` },
            ],
          };
        }
      }

      // メタコードをチェック (@^HERE, @^BACK)
      const metaResult = findElementAtCursor(
        REGEX_PATTERNS.metaCode,
        lineContent,
        cursorColumn
      );
      if (metaResult) {
        const metaKeyword = "@^" + metaResult.match[1];
        const doc = HOVER_DOCS[metaKeyword];
        if (doc) {
          return {
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: metaResult.startCol,
              endColumn: metaResult.endCol,
            },
            contents: [
              { value: `**${doc.title}**` },
              { value: doc.description },
              { value: `**構文:**\n\`\`\`\n${doc.syntax}\n\`\`\`` },
              { value: `**例:**\n\`\`\`\n${doc.example}\n\`\`\`` },
            ],
          };
        }
      }

      // 条件・効果キーワードをチェック
      const conditionEffectPatterns = [
        { pattern: /mode:not\b/g, keyword: "mode:not" },
        { pattern: /mode:(?!not)\b/g, keyword: "mode:" },
        { pattern: /(?<!to-)true:/g, keyword: "true:" },
        { pattern: /(?<!to-)false:/g, keyword: "false:" },
        { pattern: /true-or:/g, keyword: "true-or:" },
        { pattern: /false-or:/g, keyword: "false-or:" },
        { pattern: /to-true:/g, keyword: "to-true:" },
        { pattern: /to-false:/g, keyword: "to-false:" },
      ];

      for (const { pattern, keyword } of conditionEffectPatterns) {
        const result = findElementAtCursor(pattern, lineContent, cursorColumn);
        if (result) {
          const doc = HOVER_DOCS[keyword];
          if (doc) {
            return {
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: result.startCol,
                endColumn: result.endCol,
              },
              contents: [
                { value: `**${doc.title}**` },
                { value: doc.description },
                { value: `**構文:**\n\`\`\`\n${doc.syntax}\n\`\`\`` },
                { value: `**例:**\n\`\`\`\n${doc.example}\n\`\`\`` },
              ],
            };
          }
        }
      }

      // time:指定をチェック
      const timeResult = findElementAtCursor(
        REGEX_PATTERNS.timeSpec,
        lineContent,
        cursorColumn
      );
      if (timeResult) {
        const timeKeyword = timeResult.match[0];
        const doc = HOVER_DOCS[timeKeyword] || HOVER_DOCS["time:"];
        if (doc) {
          return {
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: timeResult.startCol,
              endColumn: timeResult.endCol,
            },
            contents: [
              { value: `**${doc.title}**` },
              { value: doc.description },
              { value: `**構文:**\n\`\`\`\n${doc.syntax}\n\`\`\`` },
              { value: `**例:**\n\`\`\`\n${doc.example}\n\`\`\`` },
            ],
          };
        }
      }

      // EXECコマンドをチェック
      const execResult = findElementAtCursor(
        REGEX_PATTERNS.execCmd,
        lineContent,
        cursorColumn
      );
      if (execResult && executeDefinitions.length > 0) {
        const cmdName = execResult.match[1];
        const cmdDef = executeDefinitions.find((cmd) => cmd.name === cmdName);
        if (cmdDef) {
          let argsDesc = "なし";
          if (cmdDef.args && cmdDef.args.length > 0) {
            argsDesc = cmdDef.args
              .map((arg) => {
                const required = arg.require ? "(必須)" : "(任意)";
                const type =
                  arg.type === "text"
                    ? "テキスト"
                    : arg.type === "flag"
                    ? "フラグ"
                    : arg.type === "page"
                    ? "ページ"
                    : arg.type;
                return `- ${arg.name} ${required}: ${type}`;
              })
              .join("\n");
          }

          return {
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: execResult.startCol,
              endColumn: execResult.endCol,
            },
            contents: [
              { value: `**#${cmdName}**` },
              { value: "エンジン側のコマンドを実行します。" },
              { value: `**引数:**\n${argsDesc}` },
            ],
          };
        }
      }

      // ページ参照をチェック
      if (!lineContent.trim().startsWith("PAGE")) {
        const pageResult = findElementAtCursor(
          /@([a-zA-Z_]+)/g,
          lineContent,
          cursorColumn
        );
        if (pageResult) {
          const pageName = pageResult.match[1];
          return {
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: pageResult.startCol,
              endColumn: pageResult.endCol,
            },
            contents: [
              { value: `**@${pageName}**` },
              { value: "ページへの参照" },
            ],
          };
        }
      }

      // フラグ参照をチェック
      if (!lineContent.trim().startsWith("FLAG")) {
        const flagResult = findElementAtCursor(
          /\$([a-zA-Z_]+)/g,
          lineContent,
          cursorColumn
        );
        if (flagResult) {
          const flagName = flagResult.match[1];
          return {
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: flagResult.startCol,
              endColumn: flagResult.endCol,
            },
            contents: [
              { value: `**$${flagName}**` },
              { value: "フラグへの参照" },
            ],
          };
        }
      }

      return null;
    },
  };
}
