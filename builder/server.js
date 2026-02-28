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
  "html": "full HTML markup without <style> tag. Must link style.css properly.",
  "css": "complete CSS styling"
}

Rules:
- No markdown
- No explanation
- No backticks
- HTML must include: <link rel="stylesheet" href="style.css">
- Start HTML with <!DOCTYPE html>
`
    },
    {
      role: "user",
      content: prompt
    }
  ],
    });

    let raw = response.choices[0].message.content;

// Remove accidental markdown if any
raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

const parsed = JSON.parse(raw);

fs.writeFileSync("docs/index.html", parsed.html);
fs.writeFileSync("docs/style.css", parsed.css);
console.log("Multi-file site generated.");

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