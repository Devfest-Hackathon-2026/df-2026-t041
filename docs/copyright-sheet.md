# 著作物利用シート（下書き）

> 運営のテンプレートが共有されたら、この表の内容を移してください。同じ内容を `copyright-sheet.csv` にも置いています。

| 区分 | 名称 | バージョン | 用途 | ライセンス | 出典URL | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| フォント | Google Fonts の日本語フォント29書体（Noto Sans JP / Zen Kaku Gothic New / BIZ UDPGothic / Murecho / Sawarabi Gothic / Noto Serif JP / Shippori Mincho / Zen Old Mincho / BIZ UDPMincho / Kaisei Decol / Sawarabi Mincho / M PLUS Rounded 1c / Zen Maru Gothic / Kiwi Maru / Dela Gothic One / Mochiy Pop One / RocknRoll One / Reggae One / Potta One / Train One / Rampart One / DotGothic16 / Klee One / Yuji Syuku / Yusei Magic / Hachi Maru Pop / Zen Kurenaido / Yomogi / Stick） | Google Fonts 配信版 | チラシの文字（利用者が選択） | SIL Open Font License 1.1 | https://fonts.google.com/ | 実行時に Google Fonts から読み込む。フォントファイルはリポジトリにもアプリのビルドにも含めない |
| フォント | Kosugi Maru（小杉丸ゴシック） | Google Fonts 配信版 | チラシの文字（利用者が選択） | Apache License 2.0 | https://fonts.google.com/specimen/Kosugi+Maru | 実行時に Google Fonts から読み込む。リポジトリには含めない |
| 写真 | Classic Chicken Karaage - Sunoso 2023-11-28 | - | README・ピッチ資料・デモ動画のサンプル料理写真 | CC0 1.0（パブリックドメイン） | https://commons.wikimedia.org/wiki/File:Classic_Chicken_Karaage_-_Sunoso_2023-11-28.jpg | 撮影者 Andy Li。Wikimedia Commons。リポジトリには含めていない |
| 画像 | テスト用の料理イラスト（tests/fixtures/karaage.*） | - | 自動テストの入力画像 | チーム自作 | - | プログラムで描画した図形のみ |
| アイコン | Lucide | 1.69.0 (lucide-react) | 画面のアイコン | ISC License | https://lucide.dev |  |
| ライブラリ | Next.js | 16.4.5 | Webアプリの基盤 | MIT License | https://nextjs.org |  |
| ライブラリ | React / React DOM | 19.3.0 | 画面の構築 | MIT License | https://react.dev |  |
| ライブラリ | Fabric.js | 7.4.0 | 編集可能なキャンバス | MIT License | http://fabricjs.com |  |
| ライブラリ | pdf-lib | 1.17.1 | 印刷用PDFの生成 | MIT License | https://pdf-lib.js.org |  |
| ライブラリ | idb | 8.0.4 | ブラウザ内保存（IndexedDB） | ISC License | https://github.com/jakearchibald/idb |  |
| ライブラリ | zod | 4.6.7 | 入力とAI出力の検証 | MIT License | https://zod.dev |  |
| ライブラリ | zustand | 5.0.16 | 画面の状態管理 | MIT License | https://github.com/pmndrs/zustand |  |
| ライブラリ | Google Gen AI SDK (@google/genai) | 2.32.0 | Gemini（Vertex AI）の呼び出し | Apache License 2.0 | https://github.com/googleapis/js-genai |  |
| ライブラリ | openai (Node SDK) | 7.52.0 | 開発時の予備プロバイダ（本番環境では未使用） | Apache License 2.0 | https://github.com/openai/openai-node |  |
| 開発ツール | Tailwind CSS | 4.3.4 | 画面のスタイル | MIT License | https://tailwindcss.com |  |
| 開発ツール | TypeScript | 5.9.3 | 型チェック | Apache License 2.0 | https://www.typescriptlang.org |  |
| 開発ツール | ESLint / eslint-config-next | 9.39.5 / 16.4.5 | 静的解析 | MIT License | https://eslint.org |  |
| 開発ツール | Playwright | 1.65.0 | E2Eテスト | Apache License 2.0 | https://playwright.dev |  |
| 開発ツール | pdfjs-dist / pngjs | 6.5.438 / 7.0.0 | テストでの書き出し結果の検証 | Apache License 2.0 / MIT License | https://mozilla.github.io/pdf.js/ |  |
| AI生成物 | Gemini が生成したレイアウト（JSON） | gemini-3-flash-preview | チラシの配置・配色の提案 | Google Cloud の利用規約に従う | https://cloud.google.com/terms | 画像は生成していない。文字は利用者の入力のみ |

- このプロダクトは、利用者が入力した文字と、利用者が用意した写真だけをチラシに使います。
- AIは配置・配色・書体の提案だけを行い、画像や文章の生成はしません（価格はサーバーで入力値に置き換えています）。
- フォントはすべて Google Fonts から実行時に読み込み、フォントファイル自体はリポジトリに含めていません。
