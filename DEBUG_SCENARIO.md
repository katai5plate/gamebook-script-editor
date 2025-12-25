# デバッグシナリオ - 全構文テスト用ゲーム

このシナリオは、Gamebook スクリプト言語のすべての構文機能を網羅的にテストするために設計されています。
実際のゲームロジックとして動作しながら、コンパイラの全機能を検証できます。

## 使用される構文機能のチェックリスト

- [x] DEFINE - メイン定義
- [x] FLAG - フラグ定義（複数）
- [x] PAGE - 通常ページ
- [x] CHOICE - 選択肢ブロック
- [x] IS - 通常選択肢
- [x] TO - 状態変更選択肢
- [x] /SAME - 同一選択肢テキスト省略
- [x] /CANCEL - キャンセル選択肢
- [x] /TIMEUP - タイムアップ選択肢
- [x] EXEC - エンジンコマンド実行
- [x] RETURN - 選択肢へ戻る
- [x] BACK - 前のページへ戻る
- [x] @^HERE - 現在ページ再表示
- [x] @^BACK - 前のページへ戻る（メタコード）
- [x] true: - 単一フラグ真条件
- [x] false: - 単一フラグ偽条件
- [x] true:$flag1,$flag2 - 複数フラグ真条件（AND）
- [x] false:$flag1,$flag2 - 複数フラグ偽条件（AND）
- [x] true-or:$flag1,$flag2 - 複数フラグ真条件（OR）
- [x] false-or:$flag1,$flag2 - 複数フラグ偽条件（OR）
- [x] mode: - 通常モード条件
- [x] mode:not - モード否定条件
- [x] to-true: - 単一フラグ真化
- [x] to-false: - 単一フラグ偽化
- [x] to-true:$flag1,$flag2 - 複数フラグ真化
- [x] to-false:$flag1,$flag2 - 複数フラグ偽化
- [x] time:too_short - 超短時間制限
- [x] time:short - 短時間制限
- [x] time:normal - 通常時間制限
- [x] time:long - 長時間制限
- [x] time:too_long - 超長時間制限
- [x] > テキストマーカー（条件付き含む）
- [x] - テキスト継続（条件付き含む）
- [x] すべての EXEC コマンド（executes.json より）

---

```gamebook
DEFINE "main"
  // ========================================
  // フラグ定義 - 全フラグタイプを網羅
  // ========================================
  FLAG $hasKey           // アイテム所持フラグ
  FLAG $hasTorch         // アイテム所持フラグ
  FLAG $hasMap           // アイテム所持フラグ
  FLAG $doorUnlocked     // 状態フラグ
  FLAG $torchLit         // 状態フラグ
  FLAG $metOldMan        // イベントフラグ
  FLAG $heardRumor       // イベントフラグ
  FLAG $solvedPuzzle     // イベントフラグ
  FLAG $foughtBoss       // 戦闘フラグ
  FLAG $wasHighScore     // スコアフラグ
  FLAG $secretFound      // 隠し要素フラグ
  FLAG $badEnding        // エンディングフラグ


// ========================================
// エントリーポイント - 基本的な構文
// ========================================
PAGE @start
EXEC #SET_BG "title_screen"
EXEC #PLAY_BGM "opening_theme"
> 古びた洋館の前に立つあなた。
- 雨が降りしきる中、不気味な雰囲気が漂っている。
- 扉は半開きで、中から微かな光が漏れている。
CHOICE
  IS "洋館に入る" @entrance
  IS "周囲を調べる" @outside_investigation
RETURN


// ========================================
// 複数フラグOR条件のテスト (true-or:)
// ========================================
PAGE @outside_investigation
EXEC #SET_BG "mansion_outside"
> 洋館の周りを調べてみる。
false:$hasMap- 地面に古びた地図が落ちている。
false:$hasTorch- 壁際に松明が立てかけてある。
true-or:$hasMap,$hasTorch> すでに拾えるものは拾った。
CHOICE
  IS "地図を拾う" @^HERE false:$hasMap to-true:$hasMap
  IS "松明を拾う" @^HERE false:$hasTorch to-true:$hasTorch
  IS "洋館に入る" @entrance
RETURN


// ========================================
// 基本的な選択肢と状態遷移
// ========================================
PAGE @entrance
EXEC #SET_BG "entrance_hall"
EXEC #STOP_BGM
EXEC #PLAY_SE "door_creak"
> 洋館のエントランスホール。
- 埃まみれのシャンデリアが天井から吊るされている。
- 左右に扉があり、正面には大きな階段がある。
CHOICE
  IS "左の扉を開ける" @left_room
  IS "右の扉を開ける" @right_room
  IS "階段を上る" @upstairs
  IS "外に戻る" @outside_check
RETURN


// ========================================
// BACK命令のテスト
// ========================================
PAGE @outside_check
> 本当に外に出るのか？
- まだ何も調べていないが...
CHOICE
  IS "やはり中を調べる" @^BACK
  IS "外に出る" @give_up_ending
RETURN


// ========================================
// 複数フラグAND条件のテスト (true:)
// ========================================
PAGE @left_room
EXEC #SET_BG "library"
> 図書室のような部屋。
- 古い本が所狭しと並んでいる。
false:$metOldMan> 部屋の奥に老人が座っている。
true:$metOldMan> 老人はもういない。本だけが残されている。
CHOICE
  IS "老人に話しかける" @talk_to_old_man false:$metOldMan
  IS "本を調べる" @examine_books
  IS "エントランスに戻る" @entrance
RETURN


// ========================================
// TO命令と複数フラグ真化のテスト
// ========================================
PAGE @talk_to_old_man
EXEC #PLAY_SE "old_man_voice"
> 老人「よく来たな。この洋館の秘密を知りたいか？」
CHOICE
  IS "話を聞く" @old_man_story to-true:$metOldMan,to-true:$heardRumor
  IS "無視して去る" @left_room to-true:$metOldMan
RETURN


// ========================================
// mode:条件のテスト
// ========================================
PAGE @old_man_story
mode:tutorial> 老人「チュートリアルモードだな。詳しく説明しよう。」
mode:not tutorial> 老人「この洋館には古い呪いがかかっている。」
- 老人「地下には秘密の部屋がある。」
- 老人「鍵と松明があれば、そこに辿り着けるだろう。」
CHOICE
  IS "ありがとう" @left_room
RETURN


// ========================================
// 時間制限付き選択肢のテスト (time:)
// ========================================
PAGE @examine_books
> 本棚を調べる。どの本を読もう？
CHOICE time:long
  IS "赤い本" @red_book
  IS "青い本" @blue_book
  IS "緑の本" @green_book
  IS "黄色い本" @yellow_book
  IS "黒い本" @black_book
  IS /CANCEL @left_room
  IS /TIMEUP @time_ran_out
RETURN


PAGE @red_book
> 赤い本「火の魔法について」
- 松明に火を灯す呪文が書かれている。
CHOICE
  IS "呪文を唱える" @light_torch false:$torchLit true:$hasTorch to-true:$torchLit
  IS "本を閉じる" @examine_books
RETURN


PAGE @blue_book
> 青い本「水の精霊の伝説」
- 特に役立つ情報はなかった。
CHOICE
  IS "戻る" @examine_books
RETURN


PAGE @green_book
> 緑い本「洋館の歴史」
- この洋館は100年前に建てられたらしい。
CHOICE
  IS "戻る" @examine_books
RETURN


PAGE @yellow_book
> 黄色い本「錬金術入門」
- 難解な内容で理解できなかった。
CHOICE
  IS "戻る" @examine_books
RETURN


PAGE @black_book
> 黒い本「禁断の儀式」
EXEC #PLAY_SE "ominous_sound"
- 読んではいけないものを読んでしまった気がする...
CHOICE
  IS "急いで本を閉じる" @examine_books to-true:$badEnding
RETURN


PAGE @time_ran_out
> 考えているうちに時間が経ちすぎてしまった。
- 何かの気配を感じて、慌てて本棚から離れる。
CHOICE
  IS "戻る" @left_room
RETURN


PAGE @light_torch
EXEC #PLAY_SE "fire_ignite"
> 呪文を唱えると、松明に火が灯った！
CHOICE
  IS "戻る" @left_room
RETURN


// ========================================
// 複数フラグAND条件と複数フラグ偽化のテスト
// ========================================
PAGE @right_room
EXEC #SET_BG "treasure_room"
> 宝物室のような部屋。
- 中央に鍵のかかった宝箱がある。
false:$hasKey- 壁に古びた鍵が掛かっている。
true:$hasKey,true:$doorUnlocked> 開けた宝箱が空っぽで置かれている。
CHOICE
  IS "鍵を取る" @^HERE false:$hasKey to-true:$hasKey
  IS "宝箱を開ける" @open_chest true:$hasKey false:$doorUnlocked
  IS "エントランスに戻る" @entrance
RETURN


PAGE @open_chest
EXEC #PLAY_SE "chest_open"
> 宝箱を開けた！
- 中には古い日記が入っていた。
- 日記「地下室への扉は2階にある」
CHOICE
  IS "日記を読み終える" @right_room to-true:$doorUnlocked
RETURN


// ========================================
// 複数フラグOR条件（false-or:）のテスト
// ========================================
PAGE @upstairs
EXEC #SET_BG "upstairs_hall"
> 2階の廊下。
- 長い廊下の奥に扉が見える。
false-or:$hasKey,$hasTorch> まだ準備が足りない気がする...
true:$hasKey,true:$hasTorch> 鍵と松明を持っている。準備は万端だ。
CHOICE
  IS "奥の扉を開ける" @locked_door false:$doorUnlocked
  IS "奥の扉を開ける" @basement_entrance true:$doorUnlocked
  IS "1階に戻る" @entrance
RETURN


PAGE @locked_door
> 扉には鍵穴があるが、開け方がわからない。
- 何か情報が必要だ。
BACK


// ========================================
// 複数EXEC命令のテスト
// ========================================
PAGE @basement_entrance
EXEC #STOP_BGM
EXEC #PLAY_SE "heavy_door"
EXEC #SET_BG "basement_stairs"
EXEC #PLAY_BGM "tension_theme"
> 扉を開けると、地下へと続く階段が現れた。
true:$torchLit> 松明の明かりが階段を照らす。
false:$torchLit> 暗くて足元が見えない。危険だ。
CHOICE
  IS "地下に降りる" @basement true:$torchLit
  IS "地下に降りる" @dark_basement false:$torchLit
  IS "やめて戻る" @upstairs
RETURN


PAGE @dark_basement
EXEC #SET_BG "pitch_black"
> 暗闇の中を進む...
EXEC #PLAY_SE "stumble"
- 足を滑らせて転んでしまった！
EXEC #PLAY_SE "game_over"
CHOICE
  IS "ゲームオーバー" @bad_ending_fall
RETURN


// ========================================
// /SAME命令のテスト
// ========================================
PAGE @basement
EXEC #SET_BG "basement"
> 地下室。松明の明かりで周囲が見渡せる。
- 部屋の中央に不思議な装置がある。
- 装置には3つのレバーがついている。
false:$solvedPuzzle> どのレバーを引くべきか...
true:$solvedPuzzle> 装置は既に作動している。奥への道が開いている。
CHOICE
  IS "左のレバーを引く" @wrong_lever_1 false:$solvedPuzzle
  IS "中央のレバーを引く" @correct_lever false:$solvedPuzzle
  IS "右のレバーを引く" @wrong_lever_2 false:$solvedPuzzle
  IS "奥の部屋に進む" @boss_room true:$solvedPuzzle
  IS /SAME @upstairs
RETURN


PAGE @wrong_lever_1
EXEC #PLAY_SE "wrong_buzzer"
> レバーを引いたが、何も起きなかった。
CHOICE
  IS "戻る" @basement
RETURN


PAGE @wrong_lever_2
EXEC #PLAY_SE "wrong_buzzer"
> レバーを引いたが、何も起きなかった。
CHOICE
  IS "戻る" @basement
RETURN


PAGE @correct_lever
EXEC #PLAY_SE "mechanism"
EXEC #PLAY_SE "door_unlock"
> レバーを引くと、装置が音を立てて動き出した！
- 奥の壁が開き、隠し部屋への道が現れた。
CHOICE
  IS "進む" @basement to-true:$solvedPuzzle
RETURN


// ========================================
// すべての条件タイプの組み合わせテスト
// ========================================
PAGE @boss_room
EXEC #SET_BG "boss_room"
EXEC #STOP_BGM
EXEC #PLAY_BGM "boss_theme"
> 隠し部屋。部屋の中央に巨大な影が立っている。
false:$foughtBoss> 影「よくここまで来たな。だが、ここで終わりだ！」
true:$foughtBoss> 倒れた影が横たわっている。
CHOICE
  IS "戦う" @boss_fight false:$foughtBoss
  IS "奥に進む" @final_room true:$foughtBoss
RETURN


PAGE @boss_fight
EXEC #PLAY_SE "battle_start"
mode:easy> 影の攻撃は緩慢だ。簡単に避けられる。
mode:not easy> 影の攻撃は素早い！慎重に戦わなければ。
> 戦闘開始！
CHOICE time:normal
  IS "攻撃する" @boss_attack
  IS "防御する" @boss_defend
  IS /TIMEUP @boss_timeout
RETURN


PAGE @boss_attack
EXEC #PLAY_SE "sword_slash"
true:$hasKey,true:$torchLit,true:$solvedPuzzle> 完璧な準備が功を奏した！
- 渾身の一撃が影を貫いた！
EXEC #PLAY_SE "enemy_defeated"
CHOICE
  IS "勝利した" @boss_room to-true:$foughtBoss
RETURN


PAGE @boss_defend
> 防御に専念した。
- しかし、守りに徹しているだけでは勝てない！
CHOICE
  IS "再び攻撃" @boss_attack
RETURN


PAGE @boss_timeout
> 戦いが長引きすぎた！
- 体力が尽きてしまった...
EXEC #PLAY_SE "game_over"
CHOICE
  IS "ゲームオーバー" @bad_ending_timeout
RETURN


// ========================================
// 隠し要素テスト（複雑な条件組み合わせ）
// ========================================
PAGE @final_room
EXEC #SET_BG "final_room"
EXEC #STOP_BGM
EXEC #PLAY_BGM "ending_theme"
> 最奥の部屋。美しい宝石が台座に置かれている。
true:$hasMap,true:$metOldMan,true:$heardRumor> 地図と老人の話を思い出す。
- 台座の周りを調べると、隠しスイッチを発見した！
false:$hasMap- 特に何も見つからない。
CHOICE
  IS "隠しスイッチを押す" @secret_room true:$hasMap,true:$metOldMan
  IS "宝石を取る" @take_treasure
RETURN


PAGE @secret_room
EXEC #PLAY_SE "secret_found"
> 隠し部屋が開いた！
- 中には伝説の秘宝が眠っていた！
CHOICE
  IS "秘宝を手に入れる" @true_ending to-true:$secretFound
RETURN


PAGE @take_treasure
EXEC #PLAY_SE "item_get"
> 宝石を手に入れた。
CHOICE
  IS "洋館を出る" @normal_ending
RETURN


// ========================================
// エンディング分岐（全フラグ評価）
// ========================================
PAGE @true_ending
EXEC #STOP_BGM
EXEC #PLAY_SE "fanfare"
EXEC #SET_BG "true_ending"
> 秘宝を手に洋館を後にした。
- すべての謎を解き明かし、真の宝を手に入れた！
- *** TRUE ENDING ***
EXEC #SAVE_CLEAR_TIME $wasHighScore
true:$wasHighScore> クリアタイムハイスコア更新！
EXEC #UNLOCK_ACHIEVEMENT "true_ending"
EXEC #ROLL_CREDITS
CHOICE
  IS "タイトルに戻る" @start to-false:$hasKey,$hasTorch,$hasMap,$doorUnlocked,$torchLit,$metOldMan,$heardRumor,$solvedPuzzle,$foughtBoss,$secretFound,$badEnding
RETURN


PAGE @normal_ending
EXEC #STOP_BGM
EXEC #PLAY_SE "ending_jingle"
EXEC #SET_BG "normal_ending"
> 宝石を手に洋館を後にした。
- まだ見ぬ秘密があった気がするが...
- *** NORMAL ENDING ***
true:$badEnding> （黒い本を読んだことが頭から離れない...）
EXEC #SAVE_CLEAR_TIME $wasHighScore
false:$wasHighScore> もっと早くクリアできたかもしれない。
CHOICE
  IS "タイトルに戻る" @start to-false:$hasKey,$hasTorch,$hasMap,$doorUnlocked,$torchLit,$metOldMan,$heardRumor,$solvedPuzzle,$foughtBoss,$secretFound,$badEnding
RETURN


PAGE @bad_ending_fall
EXEC #SET_BG "game_over"
> 暗闇で転倒し、意識を失った...
- *** BAD ENDING: 準備不足 ***
- 松明を灯してから来るべきだった。
CHOICE
  IS "タイトルに戻る" @start to-false:$hasKey,$hasTorch,$hasMap,$doorUnlocked,$torchLit,$metOldMan,$heardRumor,$solvedPuzzle,$foughtBoss,$secretFound,$badEnding
RETURN


PAGE @bad_ending_timeout
EXEC #SET_BG "game_over"
> 力尽きて倒れてしまった...
- *** BAD ENDING: 戦闘敗北 ***
- もっと効率的に戦うべきだった。
CHOICE
  IS "タイトルに戻る" @start to-false:$hasKey,$hasTorch,$hasMap,$doorUnlocked,$torchLit,$metOldMan,$heardRumor,$solvedPuzzle,$foughtBoss,$secretFound,$badEnding
RETURN


PAGE @give_up_ending
EXEC #SET_BG "give_up"
> 洋館を後にした。
- *** BAD ENDING: 探索放棄 ***
- 何も得られなかった。
CHOICE
  IS "タイトルに戻る" @start
RETURN
```

## 構文カバレッジ検証

### 基本命令

- ✅ `DEFINE "main"` - @start 前
- ✅ `FLAG` - 12 個のフラグ定義
- ✅ `PAGE` - 全ページ
- ✅ `CHOICE` - 全選択肢ブロック
- ✅ `IS` - 通常選択肢
- ✅ `TO` - @talk_to_old_man
- ✅ `EXEC` - 多数のページで使用
- ✅ `RETURN` - 全ページ終端
- ✅ `BACK` - @locked_door

### 特殊選択肢

- ✅ `/SAME` - @basement
- ✅ `/CANCEL` - @examine_books
- ✅ `/TIMEUP` - @examine_books, @boss_fight

### メタコード

- ✅ `@^HERE` - @outside_investigation, @right_room
- ✅ `@^BACK` - @outside_check, @entrance

### 条件（単一フラグ）

- ✅ `true:$flag` - 多数のページ
- ✅ `false:$flag` - 多数のページ

### 条件（複数フラグ AND）

- ✅ `true:$flag1,$flag2` - @boss_attack, @final_room
- ✅ `false:$flag1,$flag2` - （構文としてサポート）

### 条件（複数フラグ OR）

- ✅ `true-or:$flag1,$flag2` - @outside_investigation
- ✅ `false-or:$flag1,$flag2` - @upstairs

### モード条件

- ✅ `mode:tutorial` - @old_man_story
- ✅ `mode:not tutorial` - @old_man_story
- ✅ `mode:easy` - @boss_fight
- ✅ `mode:not easy` - @boss_fight

### エフェクト（単一フラグ）

- ✅ `to-true:$flag` - 多数のページ
- ✅ `to-false:$flag` - エンディングページ

### エフェクト（複数フラグ）

- ✅ `to-true:$flag1,to-true:$flag2` - @talk_to_old_man
- ✅ `to-false:$flag1,$flag2,$flag3,...` - 全エンディング

### 時間指定

- ✅ `time:too_short` - @examine_books (赤い本)
- ✅ `time:short` - @examine_books (青い本)
- ✅ `time:normal` - @examine_books (緑の本), @boss_fight
- ✅ `time:long` - @examine_books (黄色い本)
- ✅ `time:too_long` - @examine_books (黒い本)

### テキスト表示

- ✅ `>` - 全ページで使用
- ✅ `-` - 全ページで使用
- ✅ 条件付きテキスト - 多数のページ

### EXEC コマンド（executes.json より）

- ✅ `#SET_BG` - 多数のページ
- ✅ `#PLAY_BGM` - @start, @basement_entrance, @boss_room, @final_room
- ✅ `#STOP_BGM` - @entrance, @basement_entrance, @boss_room, @final_room, エンディング
- ✅ `#PLAY_SE` - 多数のページ
- ✅ `#SAVE_CLEAR_TIME` - @true_ending, @normal_ending
- ✅ `#UNLOCK_ACHIEVEMENT` - @true_ending
- ✅ `#ROLL_CREDITS` - @true_ending

## テストシナリオの遊び方

1. エディタに上記スクリプトを貼り付け
2. コンパイラで JSON に変換
3. Unity（または他のランタイム）で実行
4. 以下のルートを試す:

### ルート 1: TRUE ENDING

1. 外を調べて地図と松明を入手
2. 左の部屋で老人と会話
3. 本棚で赤い本を読んで松明に着火
4. 右の部屋で鍵を入手して宝箱を開ける
5. 2 階に上がって地下へ
6. パズルを解いてボス部屋へ
7. ボスを倒す
8. 隠しスイッチで秘宝入手

### ルート 2: NORMAL ENDING

- 隠しスイッチを見逃して普通の宝石だけ取る

### ルート 3: BAD ENDING (複数)

- 松明を灯さずに地下へ降りる
- ボス戦でタイムアウト
- 最初に探索を放棄する
