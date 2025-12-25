import { createCompletionProvider } from './completion.js';
import { validateScript } from './validation.js';
import { createHoverProvider } from './hover.js';
import { gamebookLanguageDefinition } from './language.js';
import { gamebookThemeDefinition } from './theme.js';

let editor; // グローバルスコープで宣言

require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });

require(['vs/editor/editor.main'], function () {
  // カスタム言語の登録
  monaco.languages.register({ id: 'gamebook' });

  // シンタックスハイライトの定義
  monaco.languages.setMonarchTokensProvider('gamebook', gamebookLanguageDefinition);

  // テーマの定義
  monaco.editor.defineTheme('gamebook-theme', gamebookThemeDefinition);

  // エディタの作成
  editor = monaco.editor.create(document.getElementById('editor'), {
    value: `DEFINE "main"
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
- おめでとう！`,
    language: 'gamebook',
    theme: 'gamebook-theme',
    minimap: { enabled: true },
    fontSize: 14,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true, // 自動レイアウト調整
  });

  // 補完の定義
  monaco.languages.registerCompletionItemProvider('gamebook', createCompletionProvider());

  // ホバーの定義
  monaco.languages.registerHoverProvider('gamebook', createHoverProvider());

  // エディタの変更を監視してエラー表示
  editor.onDidChangeModelContent(() => {
    const text = editor.getValue();
    const errors = validateScript(text);
    monaco.editor.setModelMarkers(editor.getModel(), 'gamebook', errors);
  });

  // 初期バリデーションを実行
  const initialErrors = validateScript(editor.getValue());
  monaco.editor.setModelMarkers(editor.getModel(), 'gamebook', initialErrors);

  // Ctrl+/ でコメントトグル
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
    const selection = editor.getSelection();
    const model = editor.getModel();
    const startLine = selection.startLineNumber;
    const endLine = selection.endLineNumber;

    const edits = [];
    let shouldComment = false;

    // すべての行がコメントかチェック
    for (let i = startLine; i <= endLine; i++) {
      const line = model.getLineContent(i);
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//')) {
        shouldComment = true;
        break;
      }
    }

    for (let i = startLine; i <= endLine; i++) {
      const line = model.getLineContent(i);
      if (!line.trim()) continue; // 空行はスキップ

      if (shouldComment) {
        // コメント追加
        const firstNonSpace = line.search(/\S/);
        edits.push({
          range: new monaco.Range(i, firstNonSpace + 1, i, firstNonSpace + 1),
          text: '// '
        });
      } else {
        // コメント削除
        const commentMatch = line.match(/^(\s*)\/\/\s?/);
        if (commentMatch) {
          edits.push({
            range: new monaco.Range(i, 1, i, commentMatch[0].length + 1),
            text: commentMatch[1]
          });
        }
      }
    }

    editor.executeEdits('toggle-comment', edits);
  });

  // 選択範囲を引用符で囲む機能
  // Shift+2 (日本語キーボード) をハンドル
  editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Digit2, () => {
    const selection = editor.getSelection();
    const model = editor.getModel();
    const selectedText = model.getValueInRange(selection);

    if (selectedText && !selection.isEmpty()) {
      editor.executeEdits('surround-with-quotes', [{
        range: selection,
        text: `"${selectedText}"`
      }]);
      // カーソル位置を調整（引用符の外側へ）
      const newSelection = new monaco.Selection(
        selection.endLineNumber,
        selection.endColumn + 2,
        selection.endLineNumber,
        selection.endColumn + 2
      );
      editor.setSelection(newSelection);
    } else {
      // 選択がない場合は通常通り " を入力
      editor.trigger('keyboard', 'type', { text: '"' });
    }
  });
});
