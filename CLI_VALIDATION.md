# CLI Validation

Gamebook ScriptのバリデーションをCI/CDパイプラインで実行するためのコマンドラインツールです。

## 使用方法

### 基本的な使い方

```bash
node cli/validate.js <file>
```

### 例

```bash
# 単一ファイルのバリデーション
node cli/validate.js test.gbs

# npm scriptを使用
npm run lint test.gbs
```

## 出力形式

### 成功時

```
✓ test.gbs - エラーなし
```

終了コード: `0`

### エラーがある場合

```
test-error.gbs:5:8 - Error: 未定義のコマンド: INVALID_COMMAND
test-error.gbs:8:13 - Error: 未定義のページ: undefined_page
test-error.gbs:9:25 - Error: 未定義のフラグ: undefinedFlag

3 error(s), 0 warning(s)
```

終了コード: `1` (エラーがある場合) / `0` (警告のみの場合)

## CI/CDでの使用

### GitHub Actions

```yaml
name: Lint Gamebook Scripts

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Validate gamebook scripts
        run: |
          for file in scripts/*.gbs; do
            node cli/validate.js "$file"
          done
```

### GitLab CI

```yaml
lint:
  stage: test
  image: node:18
  script:
    - |
      for file in scripts/*.gbs; do
        node cli/validate.js "$file"
      done
```

### Pre-commit Hook

`.git/hooks/pre-commit` に以下を追加:

```bash
#!/bin/bash

# Gamebook scriptファイルをバリデーション
for file in $(git diff --cached --name-only --diff-filter=ACM | grep '\.gbs$'); do
  echo "Validating $file..."
  node cli/validate.js "$file"
  if [ $? -ne 0 ]; then
    echo "❌ Validation failed for $file"
    exit 1
  fi
done

echo "✓ All gamebook scripts are valid"
exit 0
```

## エラーの種類

### Error (重大度: 8)

スクリプトとして不正な構文やセマンティックエラー:
- 未定義のページ参照
- 未定義のフラグ参照
- 未定義のEXECコマンド
- 必須引数の不足
- 重複したページ/フラグ宣言
- DEFINE行の欠如

### Warning (重大度: 4)

実行可能だが推奨されない記述:
- 不適切な引数の数
- 不適切なコンテキストでのキーワード使用

## 技術仕様

### アーキテクチャ

CLI版とブラウザ版（Monaco Editor）で同じバリデーションロジックを共有:

```
src/validation.js
├── validateScriptCore()  ← 共通のコアロジック
├── validateScript()       ← Monaco用ラッパー
└── Severity               ← 共通の重大度定義

cli/validate.js            ← CLI用ラッパー
```

### エラー形式

#### コア形式（共通）

```javascript
{
  line: number,           // 行番号（1-indexed）
  startColumn: number,    // 開始カラム（1-indexed）
  endColumn: number,      // 終了カラム（1-indexed）
  message: string,        // エラーメッセージ
  severity: number        // 重大度（8=Error, 4=Warning）
}
```

#### Monaco形式（ブラウザ用）

```javascript
{
  startLineNumber: number,
  endLineNumber: number,
  startColumn: number,
  endColumn: number,
  message: string,
  severity: number
}
```

### executes.json の読み込み

CLIでは `fs.readFileSync()` を使用して `executes.json` を同期的に読み込みます。
ファイルが見つからない場合は警告を表示しますが、バリデーションは続行されます。

## カスタマイズ

### カラー出力の無効化

環境変数 `NO_COLOR` を設定することでカラー出力を無効化できます:

```bash
NO_COLOR=1 node cli/validate.js test.gbs
```

### 独自のEXECコマンド定義

`executes.json` を編集することで、プロジェクト固有のEXECコマンドを追加できます:

```json
[
  {
    "name": "MY_COMMAND",
    "args": [
      {
        "require": true,
        "name": "param1",
        "type": "text"
      }
    ]
  }
]
```

## トラブルシューティング

### "executes.json を読み込めませんでした" 警告

`executes.json` が見つからない場合に表示されます。EXECコマンドのバリデーションはスキップされますが、その他のバリデーションは正常に動作します。

### ES Modules エラー

`package.json` に `"type": "module"` が設定されていることを確認してください。

### Node.js バージョン

Node.js 14以上が必要です（ES Modules サポート）。
