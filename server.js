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

let threadId = null;

// Neue Unterhaltung starten
async function initThread() {
  const thread = await openai.beta.threads.create();
  threadId = thread.id;
}

// Antwort holen vom Assistant
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  try {
    // Wenn keine Unterhaltung existiert → neue starten
    if (!threadId) await initThread();

    // Nachricht an Thread anhängen
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: userMessage,
    });

    // Assistant starten
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: process.env.ASSISTANT_ID,
    });

    // Warten bis Antwort fertig ist
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    while (runStatus.status !== "completed") {
      await new Promise((r) => setTimeout(r, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }

    // Antwort lesen
    const messages = await openai.beta.threads.messages.list(threadId);
    const reply = messages.data[0].content[0].text.value;

    res.json({ reply });
  } catch (error) {
    console.error("Fehler:", error);
    res.status(500).json({ error: "Fehler beim Abrufen der Antwort." });
  }
});

app.listen(port, () => {
  console.log(`✅ Server läuft auf http://localhost:${port}`);
});
