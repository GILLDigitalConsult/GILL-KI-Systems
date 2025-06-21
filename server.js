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
app.use(express.static("public")); // Website-Frontend

// POST /chat → verarbeitet Anfragen
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  try {
    // 🆕 1. Thread für diese Anfrage erzeugen
    const thread = await openai.beta.threads.create();
    const threadId = thread.id;

    // 📨 2. User-Nachricht anhängen
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: userMessage,
    });

    // 🤖 3. Assistant starten
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: process.env.ASSISTANT_ID,
    });

    // ⏳ 4. Auf Abschluss warten
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    while (runStatus.status !== "completed") {
      await new Promise((r) => setTimeout(r, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }

    // 💬 5. Antwort extrahieren
    const messages = await openai.beta.threads.messages.list(threadId);
    const reply = messages.data[0].content[0].text.value;

    res.json({ reply });
  } catch (error) {
    console.error("Fehler:", error);
    res.status(500).json({ error: "Fehler beim Abrufen der Antwort." });
  }
});

app.listen(port, () => {
    console.log(`http://localhost:${port}`);
});