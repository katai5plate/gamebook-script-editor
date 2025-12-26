import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { parse as parseUrl } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// HTMLをフォーマット（インデント付き）
function formatHTML(html) {
  let formatted = '';
  let indent = 0;
  const indentStr = '  ';

  // タグを改行で区切る
  const tokens = html.split(/(<[^>]+>)/g).filter(token => token.length > 0);

  for (const token of tokens) {
    if (token.startsWith('</')) {
      // 閉じタグ
      indent--;
      formatted += indentStr.repeat(indent) + token + '\n';
    } else if (token.startsWith('<') && !token.endsWith('/>')) {
      // 開きタグ
      formatted += indentStr.repeat(indent) + token + '\n';
      // 自己閉じタグでなければインデントを増やす
      if (!token.match(/<(br|hr|img|input|meta|link)[\s>]/)) {
        indent++;
      }
    } else if (token.trim().length > 0) {
      // テキストノード
      formatted += indentStr.repeat(indent) + token + '\n';
    }
  }

  return formatted.trim();
}

// 簡易HTTPサーバーを起動
function startServer() {
  const projectRoot = path.resolve(__dirname, '..');

  const server = createServer((req, res) => {
    const parsedUrl = parseUrl(req.url);
    let pathname = parsedUrl.pathname;

    // デフォルトでindex.htmlを返す
    if (pathname === '/') {
      pathname = '/index.html';
    }

    const filePath = path.join(projectRoot, pathname);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      // Content-Typeを設定
      const ext = path.extname(filePath);
      const contentType = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
      }[ext] || 'text/plain';

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

async function captureHighlighting(gbsFile, serverPort) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = browser.defaultBrowserContext();
  await context.overridePermissions(`http://localhost:${serverPort}`, ['clipboard-read', 'clipboard-write']);

  const page = await browser.newPage();

  // コンソールログをキャプチャ
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  const indexUrl = `http://localhost:${serverPort}/`;
  await page.goto(indexUrl, { waitUntil: 'networkidle0' });

  // Monaco Editorの初期化を待つ
  await page.waitForFunction(() => window.editor && typeof window.editor.setValue === 'function', {
    timeout: 10000
  });

  // .gbsファイルの内容を読み込み
  const content = fs.readFileSync(gbsFile, 'utf-8');

  // Monaco Editorにコンテンツを設定
  await page.evaluate((text) => {
    window.editor.setValue(text);
  }, content);

  // レンダリング待機
  await new Promise(resolve => setTimeout(resolve, 500));

  // ハイライト結果を取得し、計算済みスタイル（色）をインラインスタイルとして埋め込む
  const html = await page.evaluate(() => {
    const viewLines = document.querySelector('.view-lines');
    if (!viewLines) return '';

    // すべてのspan要素を取得して、計算済みスタイルをインラインスタイルに変換
    const spans = viewLines.querySelectorAll('span[class*="mtk"]');
    spans.forEach(span => {
      const computed = window.getComputedStyle(span);
      const color = computed.color;
      const fontWeight = computed.fontWeight;
      const fontStyle = computed.fontStyle;

      let style = '';
      if (color && color !== 'rgb(212, 212, 212)') { // デフォルト色以外
        style += `color: ${color};`;
      }
      if (fontWeight === 'bold' || parseInt(fontWeight) >= 700) {
        style += 'font-weight: bold;';
      }
      if (fontStyle === 'italic') {
        style += 'font-style: italic;';
      }

      if (style) {
        span.setAttribute('style', style);
      }
      // クラス名は残しておく（デバッグ用）
    });

    return viewLines.innerHTML;
  });

  await browser.close();
  return formatHTML(html);
}

async function main() {
  // HTTPサーバーを起動
  const { server, port } = await startServer();
  console.log(`HTTP server started on port ${port}`);

  try {
    const specDir = path.join(__dirname, '../spec');
    const snapshotDir = path.join(__dirname, '../snapshot');

    // snapshotディレクトリが存在しない場合は作成
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }

    const gbsFiles = fs.readdirSync(specDir).filter(f => f.endsWith('.gbs'));

    for (const file of gbsFiles) {
      const gbsPath = path.join(specDir, file);
      const viewPath = path.join(snapshotDir, file.replace('.gbs', '.view'));

      const html = await captureHighlighting(gbsPath, port);

      fs.writeFileSync(viewPath, html, 'utf-8');
      console.log(`✓ ${file} -> snapshot/${path.basename(viewPath)}`);
    }
  } finally {
    // サーバーをクローズ
    server.close();
    console.log('HTTP server closed');
  }
}

main();
