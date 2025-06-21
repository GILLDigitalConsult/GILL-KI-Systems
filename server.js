require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");

const app  = express();
const port = process.env.PORT || 3000;

if (!process.env.OPENAI_API_KEY || !process.env.ASSISTANT_ID) {
  console.error("❌ Bitte setze OPENAI_API_KEY und ASSISTANT_ID in der .env");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public")); // Serviert dein Frontend

////////////////////////////////////////////////////////////////////////////////
// 1) Thread anlegen
////////////////////////////////////////////////////////////////////////////////
app.post("/create-thread", async (req, res) => {
  console.log("📥 POST /create-thread");
  try {
    const thread = await openai.chat.threads.create({
      assistant_id: process.env.ASSISTANT_ID
    });
    console.log("🧵 Neuer Thread:", thread.id);
    res.json({ threadId: thread.id });
  } catch (err) {
    console.error("❌ create-thread:", err);
    res.status(500).json({ error: err.message });
  }
});

////////////////////////////////////////////////////////////////////////////////
// 2) Chat-Nachricht & Antwort
////////////////////////////////////////////////////////////////////////////////
app.post("/chat", async (req, res) => {
  console.log("📥 POST /chat mit Body:", req.body);
  const { threadId, message } = req.body;
  if (!threadId || !message) {
    console.warn("⚠️ Ungültige /chat-Request:", req.body);
    return res.status(400).json({ error: "threadId und message erforderlich." });
  }

  try {
    const completion = await openai.chat.completions.create({
      assistant_id: process.env.ASSISTANT_ID,
      thread_id:    threadId,
      model:        "gpt-4o-mini",
      messages: [
        { role: "user", content: message }
      ]
    });
    const reply = completion.choices?.[0]?.message?.content;
    if (!reply) throw new Error("Keine Antwort vom Model.");
    console.log("🤖 Antwort:", reply);
    res.json({ reply });
  } catch (err) {
    console.error("❌ /chat-Error:", err);
    res.status(500).json({ error: err.message });
  }
});

////////////////////////////////////////////////////////////////////////////////
// 3) Vollen Verlauf holen
////////////////////////////////////////////////////////////////////////////////
app.get("/history", async (req, res) => {
  const threadId = req.query.threadId;
  console.log("📥 GET /history?threadId=", threadId);
  if (!threadId) {
    return res.status(400).json({ error: "threadId query-param fehlt." });
  }

  try {
    const list = await openai.chat.threads.messages.list({ thread_id: threadId });
    const history = list.data.map(m => ({ role: m.role, content: m.content }));
    res.json({ history });
  } catch (err) {
    console.error("❌ /history-Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Server läuft auf http://localhost:${port}`);
});
