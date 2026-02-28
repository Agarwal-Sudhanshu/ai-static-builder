import express from "express";
import fs from "fs";
import dotenv from "dotenv";
import OpenAI from "openai";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// FORCE absolute static path
const staticPath = path.join(__dirname, "public");
console.log("Serving static from:", staticPath);

app.use(express.static(staticPath));

// Explicit root route
app.get("/", (req, res) => {
  res.sendFile(path.join(staticPath, "index.html"));
});

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/generate", async (req, res) => {
  const prompt = req.body.prompt;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages:[
    {
      role: "system",
      content: `
You are a professional frontend developer.

Return ONLY valid JSON in this exact format:

{
  "pages": [
    { "filename": "index.html", "content": "full HTML content" },
    { "filename": "about.html", "content": "full HTML content" },
    { "filename": "services.html", "content": "full HTML content" },
    { "filename": "pricing.html", "content": "full HTML content" },
    { "filename": "contact.html", "content": "full HTML content" }
  ],
  "css": "complete shared CSS styling"
}

Rules:
- No markdown
- No explanation
- No backticks
- Each HTML must:
  - Start with <!DOCTYPE html>
  - Include: <link rel="stylesheet" href="style.css">
  - Include navigation menu linking all pages
`
    },
    {
      role: "user",
      content: prompt
    }
  ],
    });

    let raw = response.choices[0].message.content;
raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

const parsed = JSON.parse(raw);

// Write pages
parsed.pages.forEach(page => {
  fs.writeFileSync(`docs/${page.filename}`, page.content);
});

// Write shared CSS
fs.writeFileSync("docs/style.css", parsed.css);

console.log("Multi-page site generated.");

    execSync("git add .");
    execSync(`git commit -m "AI update: ${prompt}"`);
    execSync("git push");

    res.json({ status: "Success" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});