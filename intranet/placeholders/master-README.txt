このフォルダに、次の2つのCSVファイルを置いてください。

  containers.csv   … 容器マスタ（材料シート）
  test_items.csv   … 検査項目マスタ（オーダ可能項目シート）

・列名（1行目）は、Vercel版の管理画面「マスタ管理」からダウンロードしたCSV、
  または scripts/convert-master-xlsx.py で変換したCSVと同じにしてください。
・Excelで編集した場合、「CSV（コンマ区切り）」「CSV UTF-8」のどちらで保存しても読めます。
・ファイルを上書きすると、次にACLiSSを開いた時から新しい内容が表示されます。
