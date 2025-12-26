#!/usr/bin/env node

/**
 * Gamebook Script Validator - CLI版
 * CI/CDパイプラインで使用するためのコマンドラインバリデーター
 *
 * 使用方法:
 *   node cli/validate.js <file>
 *   node cli/validate.js democode.txt
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ES Modulesでの __dirname 取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// バリデーション関数をインポート
import { validateScriptCore, Severity } from "../src/validation.js";

// Severity名の取得
const severityNames = {
  [Severity.Error]: "Error",
  [Severity.Warning]: "Warning",
  [Severity.Info]: "Info",
  [Severity.Hint]: "Hint",
};

// ANSI カラーコード
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

/**
 * エラーをフォーマットして出力
 */
function formatError(error, filename) {
  const severityName = severityNames[error.severity] || "Unknown";
  const color =
    error.severity === Severity.Error
      ? colors.red
      : error.severity === Severity.Warning
      ? colors.yellow
      : colors.cyan;

  return `${colors.gray}${filename}:${error.line}:${error.startColumn}${colors.reset} - ${color}${severityName}${colors.reset}: ${error.message}`;
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("使用方法: node cli/validate.js <file>");
    console.error("例: node cli/validate.js democode.txt");
    process.exit(1);
  }

  const filepath = args[0];
  let text;
  let executeCommands;

  // ファイル読み込み
  try {
    text = readFileSync(filepath, "utf-8");
  } catch (err) {
    console.error(`${colors.red}Error${colors.reset}: ファイルを読み込めません: ${filepath}`);
    console.error(err.message);
    process.exit(1);
  }

  // executes.json の読み込み
  try {
    const executesPath = resolve(__dirname, "../executes.json");
    const executesJson = readFileSync(executesPath, "utf-8");
    executeCommands = JSON.parse(executesJson);
  } catch (err) {
    console.warn(`${colors.yellow}Warning${colors.reset}: executes.json を読み込めませんでした`);
    executeCommands = [];
  }

  // バリデーション実行
  const errors = validateScriptCore(text, { executeCommands });

  // 結果出力
  if (errors.length === 0) {
    console.log(`✓ ${filepath} - エラーなし`);
    process.exit(0);
  } else {
    const errorCount = errors.filter((e) => e.severity === Severity.Error).length;
    const warningCount = errors.filter((e) => e.severity === Severity.Warning).length;

    errors.forEach((error) => {
      console.log(formatError(error, filepath));
    });

    console.log();
    console.log(
      `${colors.red}${errorCount} error(s)${colors.reset}, ${colors.yellow}${warningCount} warning(s)${colors.reset}`
    );

    // エラーがある場合は終了コード1
    process.exit(errorCount > 0 ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(`${colors.red}Unexpected error:${colors.reset}`, err);
  process.exit(1);
});
