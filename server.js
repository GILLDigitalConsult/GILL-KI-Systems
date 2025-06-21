require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public")); // Webseite

// POST /chat
app.post("/chat", async (req, res) => {
  const { message, threadId: clientThreadId } = req.body;

  try {
    // 🆕 1. Thread-ID entweder vom Client nutzen oder eine neue erstellen
    const threadId = clientThreadId || (await openai.beta.threads.create()).id;

    // 📨 2. User-Nachricht zum Thread hinzufügen
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
    });

    // 🤖 3. Assistant ausführen
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: process.env.ASSISTANT_ID,
    });

    // ⏳ 4. Auf Abschluss warten
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    while (runStatus.status !== "completed") {
      await new Promise((r) => setTimeout(r, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }

    // 💬 5. Letzte Nachricht des Assistants extrahieren
    const messages = await openai.beta.threads.messages.list(threadId);
    const reply = messages.data[0]?.content?.[0]?.text?.value || "Keine Antwort erhalten.";

    // ✅ Antwort samt Thread-ID zurückgeben
    res.json({ reply, threadId });
  } catch (error) {
    console.error("Fehler:", error);
    res.status(500).json({ error: "Fehler beim Abrufen der Antwort." });
  }
});

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
