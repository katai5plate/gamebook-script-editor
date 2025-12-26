#!/usr/bin/env node

import fs from "fs";
import { parseScript } from "../src/parser.js";

// カラー出力用
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
};

const parseFile = (filePath) => {
  try {
    const script = fs.readFileSync(filePath, "utf-8");
    const result = parseScript(script);

    // parse-errorをチェック
    let hasParseError = false;
    const parseErrors = [];

    Object.entries(result.pages).forEach(([pageName, commands]) => {
      commands.forEach((cmd, index) => {
        if (cmd.type === "parse-error") {
          hasParseError = true;
          parseErrors.push({
            page: pageName,
            commandIndex: index,
            list: cmd.list,
          });
        }
      });
    });

    if (hasParseError) {
      console.log(colors.yellow(`⚠ ${filePath} - パース警告あり`));
      parseErrors.forEach(({ page, commandIndex, list }) => {
        console.log(
          colors.yellow(
            `  ページ @${page} の ${commandIndex + 1} 番目のコマンドでパースエラー`
          )
        );
        console.log(
          colors.gray(`    トークン: ${JSON.stringify(list, null, 2)}`)
        );
      });
      return { success: false, hasParseError: true };
    } else {
      console.log(colors.green(`✓ ${filePath} - パース成功`));
      return { success: true, hasParseError: false };
    }
  } catch (error) {
    console.log(colors.red(`✗ ${filePath} - パース失敗`));
    console.log(colors.red(`  ${error.message}`));
    return { success: false, hasParseError: false, error };
  }
};

const main = () => {
  const args = process.argv.slice(2);
  const showJson = args.includes("--json");
  const filePath = args.find((arg) => !arg.startsWith("--"));

  if (!filePath) {
    console.log("使用方法: node cli/parse.js <file> [--json]");
    console.log("例: node cli/parse.js spec/advance.gbs");
    console.log("    node cli/parse.js spec/advance.gbs --json");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.log(colors.red(`エラー: ファイルが見つかりません - ${filePath}`));
    process.exit(1);
  }

  if (showJson) {
    // JSON出力モード
    try {
      const script = fs.readFileSync(filePath, "utf-8");
      const result = parseScript(script);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(colors.red(`パースエラー: ${error.message}`));
      process.exit(1);
    }
  } else {
    // 通常モード（parse-errorチェック）
    const result = parseFile(filePath);
    if (!result.success || result.hasParseError) {
      process.exit(1);
    }
  }
};

main();
