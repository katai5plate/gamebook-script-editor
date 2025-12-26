# gamebook-script-editor

ゲームブックみたいにノベルスクリプトを書くスクリプトエディター

---

## クイックスタート

```js
DEFINE
  FLAG $hasKey

PAGE @start
> 暗い洞窟の入口。
CHOICE
  IS "中に入る" @cave
  IS "引き返す" @end

PAGE @cave
> 鍵のかかった扉がある。
false:$hasKey- 地面に小さな鍵が落ちている。
CHOICE
  IS "鍵を拾う" @^HERE false:$hasKey to-true:$hasKey
  IS "扉を開ける" @treasure true:$hasKey
  IS /SAME @locked false:$hasKey

PAGE @locked
> 鍵がかかっている。
BACK

PAGE @treasure
EXEC #PLAY_SE "finish"
> 扉が開いた！宝物を手に入れた！
RETURN

PAGE @end
> 諦めて帰った...
RETURN
```

---

## 言語チートシート

### 基本構文

```js
DEFINE                                  // 1行目必須
  FLAG $flag1 $flag2                   // フラグ宣言

PAGE @page_name                        // ページ定義
> テキスト                              // メッセージ（1行目）
- テキスト                              // メッセージ（2行目以降）

CHOICE                                 // 選択肢
  IS "選択肢" @next_page               // 選択項目
TO @next_page                          // 自動遷移
RETURN                                 // 現在ページの冒頭へ
BACK                                   // 直前ページの冒頭へ

EXEC #COMMAND arg                      // エンジンコマンド実行
```

### 条件式

```js
true:$a,$b         // AND: a かつ b
false:$a,$b        // AND否定: a でない かつ b でない
true-or:$a,$b      // OR: a または b
false-or:$a,$b     // OR否定: a でない または b でない

// 使用例
true:$hasKey> 鍵を持っている
IS "扉を開ける" @next true:$hasKey
```

### 効果

```js
to-true:$flag      // フラグを真にする
to-false:$flag     // フラグを偽にする

// 使用例
IS "鍵を拾う" @^HERE to-true:$hasKey
```

### 特殊記法

```js
@^HERE             // その場に留まる
@^BACK             // 直前ページへ戻る
/SAME              // 直前のIS行のテキストを引用
/CANCEL            // キャンセル時の動作
/TIMEUP            // 時間切れ時の動作

// 使用例
IS "アイテムを拾う" @^HERE to-true:$hasItem
IS "戻る" @^BACK
IS /SAME @locked false:$key
```

### 時間制限

```js
CHOICE time:short
  IS "急いで逃げる" @escape
  IS /TIMEUP @caught
```

### 複雑な条件の組み合わせ

```js
// 「鍵と松明の両方を持っていて、扉が開いている」
true:$hasKey,$hasTorch,$doorOpen> 先へ進める

// 「剣か盾のどちらかを持っている」
true-or:$hasSword,$hasShield> 武器がある

// 「鍵を持っていて、扉が開いていない」
true:$hasKey false:$doorOpen> 鍵で開けられそうだ

// 複数効果
IS "宝箱を開ける" @^HERE to-true:$opened,$hasGold to-false:$hasKey
```

---

## プロジェクト構成

```
gamebook-script-editor/
├── index.html              # エディタ（Monaco Editor）
├── package.json            # npm設定
├── executes.json           # エンジンコマンド定義
├── REFERENCE.md            # 詳細な言語仕様 ★
├── GUIDE_FOR_CLAUDE.md     # 開発者向けガイド
├── cli/
│   └── validate.js         # CLI検証ツール（CI/CD用）
├── spec/
│   └── advance.gbs         # テストスクリプト
└── src/
    ├── constants.js        # 構文定義
    ├── validation.js       # バリデーション
    ├── completion.js       # 補完
    ├── hover.js            # ホバー
    ├── language.js         # シンタックスハイライト
    └── theme.js            # テーマ
```

---

## 開発

### エディタの起動

```bash
# ローカルサーバーを起動してindex.htmlを開く
python -m http.server 8000
# http://localhost:8000 にアクセス
```

### CLIでバリデーション

```bash
npm run lint                    # spec/advance.gbs を検証
npm run lint path/to/file.gbs  # 指定ファイルを検証
```

### CI/CD統合

詳細は [CLI_VALIDATION.md](CLI_VALIDATION.md) を参照。

```yaml
# GitHub Actions 例
- run: npm run lint *.gbs
```

---

## ドキュメント

- **[REFERENCE.md](REFERENCE.md)** - 言語仕様の詳細（シナリオライター向け）
- **[GUIDE_FOR_CLAUDE.md](GUIDE_FOR_CLAUDE.md)** - 開発ガイド（開発者向け）
- **[CLI_VALIDATION.md](CLI_VALIDATION.md)** - CLI使用方法（CI/CD担当者向け）
- **[JSON_INTERFACE.md](JSON_INTERFACE.md)** - パーサー出力仕様（エンジン開発者向け）

---

## ライセンス

MIT
