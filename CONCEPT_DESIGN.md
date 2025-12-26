# 注意

これは考案時の仕様であり、実装とは異なります。

# 企画

```
// PAGE @page_name
// CHOICE time:too_short time:short time:normal time:long time:too_long
//   IS "text" @page_name <conditions> <effects>
//   <conditions>:
//     mode:not (これがあると条件と合致しない条件となる)
//     true:$flag_name false:$flag_name
//     true-or:$flag_name,... false-or:$flag_name,...
//   <effects>: to-true:$flag_name to-false:$flag_name
//   IS "text" @^HERE ... (ページ遷移しない)
//   IS "text" @^BACK ... (直前のページの冒頭に戻る)
//   IS /SAME @page_name <conditions> <effects> (上で宣言された IS の text を引用する)
//   IS /CENCEL ... (これを省略した場合は、キャンセルできないものとして処理)
//   IS /TIMEUP ... (CHOICE に time を指定している場合に、時間切れになった時)
// TO @page_name <conditions> <effects> (CHOICEを挟まないページ遷移)
// TO @^HERE <conditions> <effects> (遷移させずに副作用を行いたい場合)
// RETURN (現在のページの冒頭に戻る)
// BACK (直前のページの冒頭に戻る)
// EXEC #COMMAND_NAME arg ... (このスクリプトでは表現不能な処理をエンジン側コマンド呼び出しで実現する)
// DEFINE (1行目に必ず書かなければならない)
//   FLAG $flag_name ... (フラグを宣言。DEFINE 内なら分けて書くことも、１行で書くこともできる。)
// mode:not true:$flag_name false:$flag_name> text
// mode:not true:$flag_name false:$flag_name- text (２行目以降)
//
// ・補足と制約
// conditions/effects 構文は重複して書けるが、基本的にAND演算・右辺優先となる。
//   mode:not true:a false:b true-or:c,d false-or:e,f の場合は !(a&!b&(c|d)&!(e|f)) という演算になる。
//     ただ、デバッグが面倒になるだけなので、ここまで複雑な記述は推奨しない。
//   to-true:a to-false:a の場合は、to-false:a に上書きされる。
// VM はページを直前までしか保持しない。２つ前のラベルに BACK で戻ることはできない。
// 重複したフラグは宣言できない。また、宣言されていないフラグを使用することもできない。

DEFINE
  FLAG $key // 鍵を取得したか
  FLAG $wasHighScore // ハイスコアになったか

PAGE @cave
EXEC #SET_BG "cave"
> 暗い洞窟。
- 鍵のかかった扉がある。
CHOICE
  IS "森へ出る" @forest
  IS "扉を開ける" @win true:$key
  IS /SAME @locked false:$key
RETURN

PAGE @forest
EXEC #SET_BG "forest"
> 森。
false:$key- 地面に小さな鍵。
CHOICE
  IS "鍵を拾う" @^HERE false:$key to-true:$key
  IS "洞窟へ戻る" @^BACK
RETURN

PAGE @locked
> 鍵がない。
- 押しても引いても開かなかった。
BACK

PAGE @win
> 鍵が回った。脱出成功！
- ゲームクリア！
EXEC #PLAY_SE "finish"
EXEC #SAVE_CLEAR_TIME $wasHighScore
true:$wasHighScore> クリア時間ハイスコア更新！
- おめでとう！
```

# 言語仕様

```
<conditions>
  mode:not
  {true|false}:$flag_name
  {true|false}-or:$flag_name,$flag_name,...,$flag_name
<effects>
  to-{true|false}:$flag_name

PAGE @page_name
CHOICE time:{too_short|short|normal|long|too_long}
IS {"text"|/SAME|/CANCEL|/TIMEUP} {@page_name|@^HERE|@^BACK} <conditions> <effects>
TO {@page_name|@^HERE} <conditions> <effects>
RETURN
BACK
EXEC #COMMAND_NAME {"text"|$flag_name|@page_name} ... {"text"|$flag_name|@page_name}
DEFINE
  FLAG $flag_name $flag_name
<conditions>> text
<conditions>- text
```

# 厳密仕様

- DEFINE は１行目に書かなければならない。そして、２度書けない。
- PAGE は第１引数に@ページが来る。
- EXEC は第１引数に#コマンドが来る。第２引数以降は executes.json の args の数だけ入力可能。バリデーションは require と type と presets を参照。
  - args は@ページ, $フラグ, "テキスト" のみ入力可能とする。
  - presets はあくまで入力例なので、候補にないものを入力しても OK とする。
- CHOICE の第１引数は任意だが、time: を入力できる。
  - time: と入力した時点で、short などの候補が出る
- IS の前の行は必ず CHOICE か IS でなければならない。
  - 第１引数に"テキスト", /SAME が来る。
  - 第２引数に@ページが来る
  - 第３引数以降は任意だが、conditions と effects が来る。順番は問わない。
- RETURN, BACK に引数はない。
- テキスト行は conditions のみ有効で、effects は書けない。
- mode:not は m と書いた地点で候補に出す。not 以外のモードを出す予定はない。
  - あくまで記法統一のためにこのようになっている。
