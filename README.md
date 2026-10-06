# D&D 雲端物品庫

本版使用 Supabase Auth、Postgres、Storage 和 Realtime。GitHub Pages 發布整個資料夾即可，無需建置。

已配置 luz940401/dnd-party 專案的公開連線資訊。只有資料庫 guild_admins 名單上的帳號能寫入；玩家免登入瀏覽。先執行另附 deployment/01-setup.sql，建立 Authentication 使用者，再執行 deployment/02-authorize-dm.sql。

網站起始資料為空。資料儲存成功才會更新畫面；以 revision 比對防止舊視窗覆蓋新資料。圖片在本機壓縮後存入 Supabase Storage。所有資料皆屬公開隊伍資訊。

JSON 匯出含雲端圖片網址，不含圖片二進位檔。圖片替換不自動刪除舊檔。

Supabase JS SDK 2.117.2 已隨網站封裝於 vendor，授權見 vendor/SUPABASE-LICENSE。網站字型需要 Google Fonts，無網路則使用系統字型。

這是網站部署程式包，發布後仍須驗收登入、圖片寫入權限、玩家唯讀權限與跨裝置同步。
