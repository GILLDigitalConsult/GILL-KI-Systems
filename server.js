require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.OPENAI_API_KEY || !process.env.ASSISTANT_ID) {
  console.error("❌ Bitte setze OPENAI_API_KEY und ASSISTANT_ID in der .env");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

////////////////////////////////////////////////////////////////////////////////
// 1) Thread anlegen (einmal pro Session)
////////////////////////////////////////////////////////////////////////////////
app.post("/create-thread", async (req, res) => {
  try {
    const thread = await openai.chat.threads.create({
      assistant_id: process.env.ASSISTANT_ID
    });
    res.json({ threadId: thread.id });
  } catch (err) {
    console.error("❌ create-thread:", err);
    res.status(500).json({ error: "Thread konnte nicht erstellt werden." });
  }
});

////////////////////////////////////////////////////////////////////////////////
// 2) Chat: User‑Nachricht an Thread senden, Assistant‑Antwort holen
////////////////////////////////////////////////////////////////////////////////
app.post("/chat", async (req, res) => {
  const { threadId, message } = req.body;
  if (!threadId || !message) {
    return res.status(400).json({ error: "threadId und message erforderlich." });
  }

  try {
    // 2a) Chat-Completion im existierenden Thread
    const completion = await openai.chat.completions.create({
      assistant_id: process.env.ASSISTANT_ID,
      thread_id: threadId,
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: message }
      ]
    });

    const reply = completion.choices?.[0]?.message?.content;
    if (!reply) {
      throw new Error("Keine Antwort vom Model.");
    }

    // Gib nur die neue Antwort zurück
    res.json({ reply });

  } catch (err) {
    console.error("❌ /chat:", err);
    res.status(500).json({ error: "Fehler beim Chatten." });
  }
});

////////////////////////////////////////////////////////////////////////////////
// 3) History: Komplette Message-Liste des Threads zurückgeben
////////////////////////////////////////////////////////////////////////////////
app.get("/history", async (req, res) => {
  const threadId = req.query.threadId;
  if (!threadId) {
    return res.status(400).json({ error: "threadId query-param fehlt." });
  }

  try {
    const messagesRes = await openai.chat.threads.messages.list({
      thread_id: threadId,
      // optional: ?limit=100
    });

    // messagesRes.data ist Array von { role, content, ... }
    // Wir mappen es auf { role, content } zur UI.
    const history = messagesRes.data.map(m => ({
      role: m.role,
      content: m.content
    }));

    res.json({ history });

  } catch (err) {
    console.error("❌ /history:", err);
    res.status(500).json({ error: "Fehler beim Laden der History." });
  }
});

app.listen(port, () => {
  console.log(`✅ Server läuft auf http://localhost:${port}`);
});
