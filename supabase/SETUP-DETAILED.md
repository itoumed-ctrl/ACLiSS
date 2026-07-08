# Supabaseセットアップ詳細手順（初心者向け）

「3. 接続情報を整える」の部分を丁寧に説明します。

## ステップ3-1: Supabase ダッシュボードから接続情報を取得する

### 3-1-A: プロジェクト設定画面を開く

1. https://supabase.com にログインしたら、左上に作成したプロジェクト名が表示されています
2. 左メニューの一番下に「⚙️ Settings」という歯車アイコンがあります → クリック
3. 左のサブメニューから「API」を選択

### 3-1-B: 2つの情報をコピーする

これで「API Keys and URLs」というページが表示されます。以下の2つを見つけてコピーしてください。

**① Project URL**
- ページの上の方にある「Project URL」というラベルの下に
  `https://xxxxxxxx.supabase.co` という形のURLが表示されています
- 右端の「📋 Copy」ボタンをクリックしてコピー（またはマウスで選んで Ctrl+C / Cmd+C）

**② anon public キー**
- さらに下の方に「Project API keys」という区切りがあります
- その下に「anon public」というラベルの行があります
  （「Service role」という行も下にありますが、こちらはまだ使いません）
- 「anon public」の右に長い文字列が表示されています
- その右端の「📋 Copy」ボタンをクリックしてコピー

コピーできましたか？では次に進みます。

## ステップ3-2: .env.local ファイルを作成する

ここからはPCのファイルエディタを使います。

### 3-2-A: VS Code（またはテキストエディタ）で、ACLiSS フォルダを開く

ACLiSSのプロジェクトフォルダを、VS Code（またはお使いのエディタ）で開いてください。
ツールバーの「File」→「Open Folder」で `ACLiSS` フォルダを選ぶだけです。

### 3-2-B: `.env.local.example` をコピーする

1. VS Codeの左側ファイル一覧から、ルートディレクトリ（一番上）を探します
2. `.env.local.example` というファイルが見えます（先頭の `.` ドットに注意）
3. そのファイルを**右クリック**
4. 「Copy」を選択

### 3-2-C: ペーストして、リネームする

1. 右クリックしたのと同じ場所（ルートディレクトリ）で、空いているところを右クリック
2. 「Paste」を選択
3. すると「.env.local.example copy」みたいなファイルが出現します
4. そのファイルを右クリック → 「Rename」
5. 名前を `.env.local` に変更（`.local.example copy` を削除して `.local` だけにする）
   - **重要: `.env` の先頭のドットを忘れずに！**

### 3-2-D: 中身を編集する

1. `.env.local` をクリックして開く
2. 以下のような内容が見えます

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

各行の `=` の後ろに、コピーした情報を貼り付けます：

**例（あくまで例。実際の値はあなたのSupabaseプロジェクトから取得したものを使う）**

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh12345678.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJyb2xlIjoiYW5vbiIsImFjdC...（長い文字列）
SUPABASE_SERVICE_ROLE_KEY=
```

**やる手順:**

1. 1行目 `NEXT_PUBLIC_SUPABASE_URL=` の後ろをクリック（`=` の直後）
2. さっきコピーした Project URL を貼り付け（Ctrl+V / Cmd+V）
3. 2行目 `NEXT_PUBLIC_SUPABASE_ANON_KEY=` の後ろをクリック
4. 「anon public」キーを貼り付け
5. 3行目 `SUPABASE_SERVICE_ROLE_KEY=` は空のままでいいです（フェーズ2で使う）

**重要: 何を貼り付けたか**
- `NEXT_PUBLIC_SUPABASE_URL=` → Project URL（https://... の形）
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=` → anon public キー（「公開」と書いてある方）
- `SUPABASE_SERVICE_ROLE_KEY=` → 空のままでOK

### 3-2-E: ファイルを保存する

編集が終わったら、Ctrl+S / Cmd+S で保存します。
（VS Codeなら、タブに丸い点がついていたら未保存。保存すると消えます）

## ステップ3-3: ファイルが正しく作られたか確認

1. VS Codeの左ファイル一覧に、`.env.local` が表示されているか確認
2. その内容（`=` の後ろに値が入っているか）をざっと確認

これで終わり！

## ステップ4: 動作確認

```bash
npm run dev
```

をターミナルで実行して、エラーが出ないか確認してください。
もし「Supabaseの接続情報が未設定です」というエラーが出たら、`.env.local` の
内容をもう一度チェックしてください。

---

**わからないことがあったら、どの部分でどんなエラー/わからないことが出たか、教えてください！**
