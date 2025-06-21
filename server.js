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
app.use(express.static("public")); // Für dein Website-Frontend (index.html usw.)

// ➕ Neuer Endpoint zum Erzeugen eines Threads (wird nur einmal je Session genutzt)
app.post("/create-thread", async (req, res) => {
  try {
    const thread = await openai.beta.threads.create();
    res.json({ threadId: thread.id });
  } catch (error) {
    console.error("❌ Fehler bei Thread-Erstellung:", error);
    res.status(500).json({ error: "Thread konnte nicht erstellt werden." });
  }
});

// 🔁 Bestehender Chat-Endpoint, nutzt jetzt bestehende threadId vom Client
app.post("/chat", async (req, res) => {
  const { message, threadId } = req.body;

  if (!threadId) {
    return res.status(400).json({ error: "Kein threadId übergeben." });
  }

  try {
    // Nachricht an bestehenden Thread anhängen
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
    });

    // Assistant starten
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: process.env.ASSISTANT_ID,
    });

    // Auf Abschluss warten
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    while (runStatus.status !== "completed") {
      await new Promise((r) => setTimeout(r, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }

    // Antwort extrahieren
    const messages = await openai.beta.threads.messages.list(threadId);
    const reply = messages.data[0].content[0].text.value;

    res.json({ reply });
  } catch (error) {
    console.error("❌ Fehler beim Abrufen der Antwort:", error);
    res.status(500).json({ error: "Fehler beim Abrufen der Antwort." });
  }
});

app.listen(port, () => {
  console.log(`✅ Server läuft auf http://localhost:${port}`);
});
