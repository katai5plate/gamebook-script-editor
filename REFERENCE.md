# Gamebook スクリプト 書き方リファレンス

このドキュメントは、ゲームブック形式のシナリオを書くためのスクリプト言語のリファレンスです。

## 目次

1. [基本構造](#基本構造)
2. [コマンド一覧](#コマンド一覧)
3. [特殊な記法](#特殊な記法)
4. [サンプルコード](#サンプルコード)

---

## 基本構造

すべてのスクリプトは `DEFINE` から始まり、ページごとに内容を記述します。

```
DEFINE "スクリプト名"
  FLAG $フラグ名

PAGE @ページ名
> テキスト
- テキスト（続き）
CHOICE
  IS "選択肢" @遷移先
```

### コメント

`//` 以降はコメントとして扱われます。

```
FLAG $key // 鍵を取得したか
```

---

## コマンド一覧

### DEFINE

**用途**: スクリプトの最初に必ず書きます。フラグの宣言を含みます。

**書き方**:

```
DEFINE
  FLAG $flag1 $flag2 $flag3
```

**説明**:

- スクリプトの 1 行目に必ず書く必要があります
- フラグは複数まとめて書けます（スペース区切り）
- フラグは `$` で始まる名前です

---

### PAGE

**用途**: 新しいページ（シーン）を開始します。

**書き方**:

```
PAGE @ページ名
```

**説明**:

- ページ名は `@` で始まります
- 英字とアンダースコア（`_`）のみ使用可能

**例**:

```
PAGE @cave
PAGE @forest_entrance
```

---

### テキスト行

**用途**: プレイヤーに表示されるテキストを書きます。

**書き方**:

```
> テキスト
- テキスト（2行目以降）
```

**説明**:

- `>` は新しいテキストブロックの開始
- `-` はテキストの続き
- 条件付きでテキストを表示することもできます

**例**:

```
> 暗い洞窟。
- 奥から何か音が聞こえる。
true:$hasLight> 明かりで周囲が見える。
false:$hasLight> 真っ暗で何も見えない。
```

---

### CHOICE

**用途**: 選択肢を提示します。

**書き方**:

```
CHOICE
  IS "選択肢テキスト" @遷移先
  IS "選択肢テキスト" @遷移先
```

**時間制限付き**:

```
CHOICE time:short
  IS "急いで逃げる" @escape
  IS /TIMEUP @caught
```

時間指定:

- `time:too_short` - 非常に短い
- `time:short` - 短い
- `time:normal` - 普通
- `time:long` - 長い
- `time:too_long` - 非常に長い

**例**:

```
CHOICE
  IS "森へ進む" @forest
  IS "洞窟に入る" @cave
  IS "村に戻る" @village
```

---

### IS

**用途**: 選択肢の内容を定義します。CHOICE の直後に書きます。

**書き方**:

```
IS "選択肢テキスト" @遷移先
IS "選択肢テキスト" @遷移先 条件 効果
```

**条件と効果**:

```
IS "鍵を拾う" @^HERE false:$key to-true:$key
```

- `true:$flag` - フラグが真のときのみ表示
- `false:$flag` - フラグが偽のときのみ表示
- `to-true:$flag` - 選択時にフラグを真にする
- `to-false:$flag` - 選択時にフラグを偽にする

**特殊キーワード**:

```
IS /SAME @別のページ false:$key
IS /CANCEL @前のページ
IS /TIMEUP @時間切れページ
```

- `/SAME` - 直前の選択肢と同じテキストを使用
- `/CANCEL` - キャンセルボタンの動作
- `/TIMEUP` - 時間切れ時の動作

---

### TO

**用途**: 選択肢を経由せず、自動的にページ遷移します。

**書き方**:

```
TO @ページ名
TO @ページ名 条件 効果
```

**例**:

```
TO @gameover false:$hasKey
TO @next true:$hasKey to-false:$usedKey
```

---

### EXEC

**用途**: ゲームエンジン側の機能を呼び出します（背景変更、効果音など）。

**書き方**:

```
EXEC #コマンド名 引数...
```

**例**:

```
EXEC #SET_BG "forest"
EXEC #PLAY_SE "door_open"
EXEC #SAVE_CLEAR_TIME $wasHighScore
```

利用可能なコマンドは、プロジェクトの `executes.json` を参照してください。

---

### RETURN

**用途**: 現在のページの先頭に戻ります。

**書き方**:

```
RETURN
```

**例**:

```
PAGE @shop
> ようこそ。
CHOICE
  IS "剣を買う" @^HERE true:$hasGold to-false:$hasGold to-true:$hasSword
  IS "店を出る" @town
RETURN
```

---

### BACK

**用途**: 直前のページに戻ります。

**書き方**:

```
BACK
```

**例**:

```
PAGE @locked_door
> 鍵がかかっている。
BACK
```

---

## 特殊な記法

### メタコード

#### @^HERE

その場に留まる（ページ遷移しない）

```
IS "アイテムを拾う" @^HERE to-true:$hasItem
```

#### @^BACK

直前のページに戻る

```
IS "戻る" @^BACK
```

---

### 条件指定

#### 基本の条件

- `true:$flag1,$flag2,$flag3` - フラグが真の場合
- `false:$flag1,$flag2,$flag3` - フラグが偽の場合

#### 複数条件（OR）

- `true-or:$flag1,$flag2,$flag3` - いずれかが真
- `false-or:$flag1,$flag2,$flag3` - いずれかが偽

#### 条件の反転

- `mode:not true:$flag` - フラグが真**でない**場合

**例**:

```
> 扉を開けるには3つの鍵が必要だ。
true-or:$key1,$key2,$key3> 鍵を1つ以上持っている。
mode:not true:$key1,$key2,$key3> 鍵を1つも持っていない。
false:$key1> 赤い鍵を持っていない。
```

---

### 効果指定

- `to-true:$flag1,$flag2,$flag3` - フラグを真にする
- `to-false:$flag1,$flag2,$flag3` - フラグを偽にする

**例**:

```
IS "宝箱を開ける" @^HERE to-true:$openedChest,$hasGold
```

---

## サンプルコード

### 基本的な例

```
DEFINE
  FLAG $hasKey

PAGE @start
> あなたは洞窟の入口に立っている。
CHOICE
  IS "中に入る" @cave
  IS "引き返す" @end

PAGE @cave
> 暗い洞窟の中。
> 地面に小さな鍵が落ちている。
CHOICE
  IS "鍵を拾う" @^HERE false:$hasKey to-true:$hasKey
  IS "奥へ進む" @deep_cave
  IS "外へ出る" @start

PAGE @deep_cave
> 扉がある。
false:$hasKey> 鍵がかかっている。
true:$hasKey> 鍵を使って開けることができそうだ。
CHOICE
  IS "扉を開ける" @treasure true:$hasKey
  IS /SAME @locked false:$hasKey
  IS "戻る" @cave

PAGE @locked
> 鍵がかかっていて開かない。
BACK

PAGE @treasure
> 宝物を発見した！
TO @end

PAGE @end
> 冒険は終わった。
```

---

### 時間制限付きの例

```
DEFINE
  FLAG $escaped

PAGE @chase
EXEC #PLAY_BGM "danger"
> 敵に追いかけられている！
CHOICE time:short
  IS "左の道へ" @left_path
  IS "右の道へ" @right_path
  IS /TIMEUP @caught

PAGE @caught
> 追いつかれてしまった...
TO @gameover

PAGE @left_path
> 狭い道を抜けて逃げ切った！
TO @safe to-true:$escaped
```

---

### 条件分岐の例

```
DEFINE
  FLAG $hasWeapon
  FLAG $hasArmor
  FLAG $hasPotion

PAGE @boss_battle
> 強大な敵が立ちはだかる。
true:$hasWeapon> 武器を構える。
true:$hasArmor> 防具が身を守る。
CHOICE
  IS "戦う" @fight_result
  IS "逃げる" @escape

PAGE @fight_result
true-or:$hasWeapon,$hasArmor> 装備のおかげで勝利した！
mode:not true-or:$hasWeapon,$hasArmor> 装備がなく敗北した...
TO @victory true-or:$hasWeapon,$hasArmor
TO @defeat mode:not true-or:$hasWeapon,$hasArmor
```

---

## 注意事項

1. **DEFINE は必ず 1 行目に書く**
2. **使用するフラグは必ず DEFINE で宣言する**
3. **IS は CHOICE の直後にのみ書ける**
4. **ページ名・フラグ名は英字とアンダースコアのみ**
5. **テキストは `"` で囲む**
6. **条件・効果は何個でも組み合わせ可能（スペース区切り）**

---

このリファレンスで分からないことがあれば、プロジェクト担当者に確認してください。
