import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import opener from "opener";
dotenv.config();

const CLIENT_ID = process.env.EVERNOTE_CLIENT_ID!;
const CLIENT_SECRET = process.env.EVERNOTE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.EVERNOTE_REDIRECT_URI!;
const AUTH_URL = "https://www.evernote.com/oauth2/authorize";
const TOKEN_URL = "https://www.evernote.com/oauth2/token";
const API_BASE_URL = "https://api.evernote.com/v1";

export async function startOAuthFlow() {
  // 1. 認証用URLを生成
  const authUrl = `${AUTH_URL}?response_type=code&client_id=${encodeURIComponent(
    CLIENT_ID
  )}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  // 2. Expressサーバーを起動（リダイレクトURIで受け取る）
  const app = express();

  app.get("/callback", async (req, res) => {
    const code = req.query.code as string;
    if (!code) {
      res.send("認証コードが見つかりませんでした。");
      return;
    }

    // 3. 認証コードでアクセストークン取得
    try {
      const tokenResponse = await axios.post(
        TOKEN_URL,
        new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      const accessToken = tokenResponse.data.access_token;
      res.send("認証完了！ターミナルに結果を出します。");

      // 4. デフォルトノートブックIDを取得
      const notebookRes = await axios.get(`${API_BASE_URL}/notebooks`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const defaultNotebook = notebookRes.data.notebooks.find(
        (nb: any) => nb.defaultNotebook
      );
      if (!defaultNotebook) {
        console.log("デフォルトノートブックが見つかりません。");
        process.exit(1);
      }
      const notebookGuid = defaultNotebook.guid;
      console.log(`デフォルトノートブック名: ${defaultNotebook.name}`);
      console.log(`ノートブックGUID: ${notebookGuid}`);

      // 5. ノートタイトル一覧を取得
      const notesRes = await axios.get(
        `${API_BASE_URL}/notebooks/${notebookGuid}/notes`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const notes = notesRes.data.notes;
      console.log("\n--- ノートタイトル一覧 ---");
      notes.forEach((note: any) => {
        console.log(note.title);
      });

      process.exit(0);
    } catch (err: any) {
      console.error("エラー:", err.response?.data || err.message);
      res.send("エラーが発生しました。ターミナルを確認してください。");
      process.exit(1);
    }
  });

  app.listen(3000, () => {
    console.log("ローカルサーバー起動: http://localhost:3000/callback で待機中");
    console.log("ブラウザが開きます。Evernoteにログインして認証してください。");
    try {
      opener(authUrl);
    } catch (err) {
      console.error("ブラウザを開けませんでした:", err);
      console.log("以下のURLを手動でブラウザにコピーしてください:", authUrl);
    }
  });
}