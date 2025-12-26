// Gamebook言語のバリデーション機能
import {
  SYNTAX_RULES,
  ARG_TYPE_PATTERNS,
  REGEX_PATTERNS,
  parseArgs,
} from "./constants.js";

/**
 * エラーの重大度レベル
 * Monaco Editor の MarkerSeverity と互換性を持つ定数
 *
 * @see https://microsoft.github.io/monaco-editor/api/enums/monaco.MarkerSeverity.html
 *
 * Monaco.MarkerSeverity:
 * - Hint = 1
 * - Info = 2
 * - Warning = 4
 * - Error = 8
 */
export const Severity = {
  /** 構文エラーやセマンティックエラー (monaco.MarkerSeverity.Error) */
  Error: 8,
  /** 警告レベルの問題 (monaco.MarkerSeverity.Warning) */
  Warning: 4,
  /** 情報メッセージ (monaco.MarkerSeverity.Info) */
  Info: 2,
  /** ヒントや提案 (monaco.MarkerSeverity.Hint) */
  Hint: 1,
};

// executes.jsonから有効なコマンドと定義を読み込む（ブラウザ用）
let validExecuteCommands = new Set();
let executeDefinitions = [];
if (typeof window !== "undefined") {
  fetch("../executes.json")
    .then((res) => res.json())
    .then((data) => {
      validExecuteCommands = new Set(data.map((cmd) => cmd.name));
      executeDefinitions = data;
    })
    .catch((err) => console.warn("Failed to load executes.json:", err));
}

/**
 * スクリプトをバリデーションする（コア関数）
 * @param {string} text - バリデーション対象のスクリプト
 * @param {object} options - オプション
 * @param {Array} options.executeCommands - 利用可能なEXECコマンドの定義
 * @returns {Array} エラーの配列
 */
function validateScriptCore(text, options = {}) {
  const errors = [];
  const lines = text.split("\n");
  const declaredPages = new Set();
  const declaredFlags = new Set();

  // オプションから実行コマンド定義を取得（未指定の場合はグローバル変数を使用）
  const execCommands = options.executeCommands || executeDefinitions;
  const execCommandNames = new Set(execCommands.map((cmd) => cmd.name));

  function addError(lineNum, startCol, endCol, message, severity) {
    if (typeof lineNum !== "number" || lineNum < 1) return;
    if (typeof startCol !== "number" || startCol < 1) return;
    if (typeof endCol !== "number" || endCol < 1) return;
    if (endCol <= startCol) return;
    if (isNaN(lineNum) || isNaN(startCol) || isNaN(endCol)) return;

    errors.push({
      line: lineNum,
      startColumn: startCol,
      endColumn: endCol,
      message: message,
      severity: severity,
    });
  }

  function validateCommandArgs(lineNum, originalLine, command, argsText) {
    const rule = SYNTAX_RULES[command];
    if (!rule) return;

    const args = parseArgs(argsText);

    // EXEC の特別処理
    if (command === "EXEC") {
      const cmdMatch = argsText.match(/^#([A-Z_]+)/);
      if (!cmdMatch) return;

      const cmdName = cmdMatch[1];
      const cmdDef = execCommands.find((cmd) => cmd.name === cmdName);
      if (!cmdDef || !cmdDef.args) return;

      const cmdArgs = args.slice(1);

      if (cmdArgs.length > cmdDef.args.length) {
        const cmdPos = originalLine.indexOf("#" + cmdName);
        addError(
          lineNum,
          cmdPos + 1,
          cmdPos + cmdName.length + 2,
          `${cmdName}の引数は最大${cmdDef.args.length}個です`,
          Severity.Warning
        );
      }

      for (let i = 0; i < cmdDef.args.length; i++) {
        const argDef = cmdDef.args[i];
        const argValue = cmdArgs[i];

        if (argDef.require && !argValue) {
          const cmdPos = originalLine.indexOf("#" + cmdName);
          addError(
            lineNum,
            cmdPos + 1,
            cmdPos + cmdName.length + 2,
            `${cmdName}の引数 ${argDef.name} が必要です`,
            Severity.Warning
          );
          continue;
        }

        if (argValue) {
          const isValidFormat =
            argValue.startsWith("@") ||
            argValue.startsWith("$") ||
            argValue.startsWith('"');

          if (!isValidFormat) {
            const argPos = originalLine.indexOf(argValue);
            addError(
              lineNum,
              argPos + 1,
              argPos + argValue.length + 1,
              `EXEC引数は@ページ, $フラグ, "テキスト"のいずれかである必要があります`,
              Severity.Warning
            );
          }

          if (argDef.type === "flag" && !argValue.startsWith("$")) {
            const argPos = originalLine.indexOf(argValue);
            addError(
              lineNum,
              argPos + 1,
              argPos + argValue.length + 1,
              `引数 ${argDef.name} はフラグ($で始まる)である必要があります`,
              Severity.Warning
            );
          }

          if (argDef.type === "text" && !argValue.startsWith('"')) {
            const argPos = originalLine.indexOf(argValue);
            addError(
              lineNum,
              argPos + 1,
              argPos + argValue.length + 1,
              `引数 ${argDef.name} はテキスト("で囲む)である必要があります`,
              Severity.Warning
            );
          }
        }
      }
      return;
    }

    // 引数なしコマンドチェック
    if (rule.args.length === 0 && args.length > 0) {
      const cmdPos = originalLine.indexOf(command);
      addError(
        lineNum,
        cmdPos + 1,
        cmdPos + command.length + 1,
        `${command}に引数は指定できません`,
        Severity.Warning
      );
      return;
    }

    // 必須引数のチェック
    for (let i = 0; i < rule.args.length; i++) {
      const argDef = rule.args[i];
      if (argDef.required && !args[i]) {
        const cmdPos = originalLine.indexOf(command);
        let message = `${command}の第${i + 1}引数が必要です`;

        // DEFINE用の特別なメッセージ
        if (command === "DEFINE" && i === 0) {
          message = `DEFINEにはスクリプト名（"テキスト"）が必要です`;
        }

        addError(
          lineNum,
          cmdPos + 1,
          cmdPos + command.length + 1,
          message,
          Severity.Error
        );
      }
    }

    // 各引数の型チェック
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // multipleでない場合は定義された引数の範囲内かチェック
      const argDef = rule.args[i];
      if (!argDef) {
        if (
          i >= rule.args.length &&
          !rule.args[rule.args.length - 1]?.multiple
        ) {
          const argPos = originalLine.indexOf(arg);
          addError(
            lineNum,
            argPos + 1,
            argPos + arg.length + 1,
            `${command}の引数が多すぎます`,
            Severity.Error
          );
          continue;
        }
      }

      const checkArgDef = argDef || rule.args[rule.args.length - 1];
      if (!checkArgDef) continue;

      const typePattern = ARG_TYPE_PATTERNS[checkArgDef.type];
      if (typePattern && !typePattern.test(arg)) {
        const argPos = originalLine.indexOf(arg);
        let message = `${command}の第${i + 1}引数の形式が正しくありません`;

        if (checkArgDef.type === "page") {
          message = `${command}の第${i + 1}引数は@ページでなければなりません`;
        } else if (checkArgDef.type === "text_or_special") {
          message = `${command}の第${
            i + 1
          }引数は"テキスト"または/SAME, /CANCEL, /TIMEUPでなければなりません`;
        } else if (checkArgDef.type === "time") {
          message = `${command}の引数はtime:のみです`;
        }

        addError(
          lineNum,
          argPos + 1,
          argPos + arg.length + 1,
          message,
          Severity.Error
        );
      }
    }
  }

  // 1行目DEFINEチェック
  if (lines.length > 0 && !lines[0].trim().startsWith("DEFINE")) {
    addError(1, 1, 2, "1行目にDEFINEが必要です", Severity.Error);
  }

  // DEFINE重複チェック
  let defineCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("DEFINE")) {
      defineCount++;
      if (defineCount > 1) {
        const definePos = lines[i].indexOf("DEFINE");
        addError(
          i + 1,
          definePos + 1,
          definePos + 7,
          "DEFINEは1度しか書けません",
          Severity.Error
        );
      }
    }
  }

  // 1パス目：宣言収集
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const originalLine = lines[i];

    const pageMatch = line.match(/^PAGE @([a-zA-Z0-9_]+)/);
    if (pageMatch && pageMatch[1]) {
      const pageName = pageMatch[1];
      if (declaredPages.has(pageName)) {
        const pagePos = originalLine.indexOf("@" + pageName);
        addError(
          i + 1,
          pagePos + 1,
          pagePos + pageName.length + 2,
          `重複したページ宣言: ${pageName}`,
          Severity.Error
        );
      }
      declaredPages.add(pageName);
    }

    const flagMatch = line.match(/FLAG \$([a-zA-Z0-9_]+)/);
    if (flagMatch && flagMatch[1]) {
      const flagName = flagMatch[1];
      if (declaredFlags.has(flagName)) {
        const flagPos = originalLine.indexOf("$" + flagName);
        addError(
          i + 1,
          flagPos + 1,
          flagPos + flagName.length + 2,
          `重複したフラグ宣言: ${flagName}`,
          Severity.Error
        );
      }
      declaredFlags.add(flagName);
    }
  }

  // 2パス目：使用検証と構文チェック
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const originalLine = lines[i];

    // 各コマンドの構文チェック
    for (const [command, rule] of Object.entries(SYNTAX_RULES)) {
      if (line.startsWith(command + " ") || line === command) {
        const argsMatch = line.match(new RegExp(`^${command}\\s+(.+)$`));
        let argsText = argsMatch ? argsMatch[1] : "";

        // コメントを除去（クォート内を除く）
        let cleanedArgsText = "";
        let inQuotes = false;
        for (let j = 0; j < argsText.length; j++) {
          const char = argsText[j];
          if (char === '"') {
            inQuotes = !inQuotes;
            cleanedArgsText += char;
          } else if (
            char === "/" &&
            j + 1 < argsText.length &&
            argsText[j + 1] === "/" &&
            !inQuotes
          ) {
            // コメント開始、残りを無視
            break;
          } else {
            cleanedArgsText += char;
          }
        }
        argsText = cleanedArgsText.trim();

        // 前行チェック
        if (rule.requiresPrevious && i > 0) {
          let prevLineIdx = i - 1;
          let prevLine = "";
          while (prevLineIdx >= 0) {
            const checkLine = lines[prevLineIdx].trim();
            if (checkLine && !checkLine.startsWith("//")) {
              prevLine = checkLine;
              break;
            }
            prevLineIdx--;
          }

          const isPrevValid = rule.requiresPrevious.some((req) =>
            prevLine.startsWith(req)
          );
          if (prevLine && !isPrevValid) {
            const cmdPos = originalLine.indexOf(command);
            addError(
              i + 1,
              cmdPos + 1,
              cmdPos + command.length + 1,
              `${command}の前の行は${rule.requiresPrevious.join(
                "か"
              )}でなければなりません`,
              Severity.Error
            );
          }
        }

        // 引数チェック
        validateCommandArgs(i + 1, originalLine, command, argsText);
      }
    }

    // コメント行はスキップ
    if (line.startsWith("//")) {
      continue;
    }

    // テキスト行（メッセージ）かどうかを判定
    // テキスト行の場合、条件部分とメッセージ部分を分離
    let checkTarget = originalLine;
    const textLineMatch = originalLine.match(/^(\s*)(.+?)([>\-])\s+(.*)$/);
    if (textLineMatch) {
      // テキスト行の場合、条件部分（[>\-]の前）のみをチェック対象にする
      const [, indent, conditionPart, marker] = textLineMatch;
      checkTarget = indent + conditionPart + marker; // メッセージ部分を除外
    } else {
      // [>\-]が行頭にある場合（条件なし）
      const simpleTextLineMatch = originalLine.match(/^(\s*)([>\-])\s+(.*)$/);
      if (simpleTextLineMatch) {
        const [, indent, marker] = simpleTextLineMatch;
        checkTarget = indent + marker; // メッセージ部分を完全に除外
      }
    }

    // ページ参照チェック（メッセージ部分は除外）
    const pageRefs = [...checkTarget.matchAll(REGEX_PATTERNS.pageRef)];
    for (const match of pageRefs) {
      if (!match || !match[1] || typeof match.index !== "number") continue;
      if (!line.startsWith("PAGE")) {
        const pageName = match[1];
        const beforeAt =
          match.index > 0 ? checkTarget.charAt(match.index - 1) : "";
        if (beforeAt === "^") continue;

        if (!declaredPages.has(pageName)) {
          addError(
            i + 1,
            match.index + 1,
            match.index + match[0].length + 1,
            `未定義のページ: ${pageName}`,
            Severity.Error
          );
        }
      }
    }

    // PAGE宣言でのメタコードチェック
    if (line.startsWith("PAGE")) {
      const metaCodeMatch = originalLine.match(/@\^(HERE|BACK)/);
      if (metaCodeMatch) {
        const metaPos = originalLine.indexOf(metaCodeMatch[0]);
        addError(
          i + 1,
          metaPos + 1,
          metaPos + metaCodeMatch[0].length + 1,
          `PAGE宣言では@^${metaCodeMatch[1]}は使用できません`,
          Severity.Error
        );
      }
    }

    // フラグ参照チェック（メッセージ部分は除外）
    const flagRefs = [...checkTarget.matchAll(REGEX_PATTERNS.flagRef)];
    for (const match of flagRefs) {
      if (!match || !match[1] || typeof match.index !== "number") continue;
      if (!line.startsWith("FLAG")) {
        const flagName = match[1];
        if (!declaredFlags.has(flagName)) {
          addError(
            i + 1,
            match.index + 1,
            match.index + match[0].length + 1,
            `未定義のフラグ: ${flagName}`,
            Severity.Error
          );
        }
      }
    }

    // EXECコマンドチェック
    const execRefs = [...originalLine.matchAll(REGEX_PATTERNS.execCmd)];
    for (const match of execRefs) {
      if (!match || !match[1] || typeof match.index !== "number") continue;
      const cmdName = match[1];

      if (execCommandNames.size > 0 && !execCommandNames.has(cmdName)) {
        addError(
          i + 1,
          match.index + 1,
          match.index + match[0].length + 1,
          `未定義のコマンド: ${cmdName}`,
          Severity.Error
        );
      }
    }

    // 不正な条件・効果のカンマ連結チェック
    // 例: true:$a,true:$b は NG (正: true:$a,$b または true:$a true:$b)
    const invalidConditionPattern = /(?:true|false|true-or|false-or):[\$a-zA-Z0-9_,]+,(?:true|false|true-or|false-or):/;
    const invalidEffectPattern = /(?:to-true|to-false):[\$a-zA-Z0-9_,]+,(?:to-true|to-false):/;

    const invalidCondMatch = originalLine.match(invalidConditionPattern);
    if (invalidCondMatch) {
      const invalidPos = originalLine.indexOf(invalidCondMatch[0]);
      addError(
        i + 1,
        invalidPos + 1,
        invalidPos + invalidCondMatch[0].length + 1,
        "条件はカンマで連結できません。スペース区切りか、1つの条件に複数フラグをまとめてください",
        Severity.Error
      );
    }

    const invalidEffMatch = originalLine.match(invalidEffectPattern);
    if (invalidEffMatch) {
      const invalidPos = originalLine.indexOf(invalidEffMatch[0]);
      addError(
        i + 1,
        invalidPos + 1,
        invalidPos + invalidEffMatch[0].length + 1,
        "効果はカンマで連結できません。スペース区切りか、1つの効果に複数フラグをまとめてください",
        Severity.Error
      );
    }

    // 文脈依存チェック
    const timeMatch = originalLine.match(REGEX_PATTERNS.timeSpec);
    if (timeMatch && !line.startsWith("CHOICE")) {
      const timePos = originalLine.indexOf(timeMatch[0]);
      addError(
        i + 1,
        timePos + 1,
        timePos + timeMatch[0].length + 1,
        "time指定はCHOICE行でのみ有効です",
        Severity.Warning
      );
    }

    // コメント行はスキップ
    if (!line.startsWith("//")) {
      const specialMatch = originalLine.match(REGEX_PATTERNS.specialChoice);
      if (specialMatch && !line.startsWith("IS")) {
        const specialPos = originalLine.indexOf(specialMatch[0]);
        addError(
          i + 1,
          specialPos + 1,
          specialPos + specialMatch[0].length + 1,
          `${specialMatch[0]}はIS行でのみ有効です`,
          Severity.Warning
        );
      }

      const conditionPatterns = [
        /(?<!to-)true:/,
        /(?<!to-)false:/,
        /true-or:/,
        /false-or:/,
      ];

      const isValidConditionContext =
        line.startsWith("IS") ||
        line.startsWith("TO") ||
        line.match(
          /^(true:|false:|true-or:|false-or:|to-true:|to-false:)/
        ) ||
        checkTarget.match(/[>\-]/);

      // メッセージ部分を除外してチェック
      for (const pattern of conditionPatterns) {
        const condMatch = checkTarget.match(pattern);
        if (condMatch && !isValidConditionContext) {
          const condPos = checkTarget.indexOf(condMatch[0]);
          addError(
            i + 1,
            condPos + 1,
            condPos + condMatch[0].length + 1,
            "条件指定はIS/TO/テキスト行でのみ有効です",
            Severity.Warning
          );
        }
      }

      const effectPatterns = [/to-true:/, /to-false:/];
      const isValidEffectContext =
        line.startsWith("IS") || line.startsWith("TO");

      // メッセージ部分を除外してチェック
      for (const pattern of effectPatterns) {
        const effectMatch = checkTarget.match(pattern);
        if (effectMatch && !isValidEffectContext) {
          const effectPos = checkTarget.indexOf(effectMatch[0]);
          addError(
            i + 1,
            effectPos + 1,
            effectPos + effectMatch[0].length + 1,
            "効果指定はIS/TO行でのみ有効です",
            Severity.Warning
          );
        }
      }
    }
  }

  return errors;
}

/**
 * Monaco Editor用のバリデーション関数（後方互換性）
 * @param {string} text - バリデーション対象のスクリプト
 * @returns {Array} Monaco形式のエラー配列
 */
function validateScript(text) {
  const errors = validateScriptCore(text);

  // Monacoの形式に変換
  return errors.map((err) => ({
    startLineNumber: err.line,
    endLineNumber: err.line,
    startColumn: err.startColumn,
    endColumn: err.endColumn,
    message: err.message,
    severity: err.severity,
  }));
}

export { validateScript, validateScriptCore };
