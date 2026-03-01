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

// Serve builder UI
const staticPath = path.join(__dirname, "public");
app.use(express.static(staticPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(staticPath, "index.html"));
});

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================
// GENERATE ROUTE
// ============================

app.post("/generate", async (req, res) => {
  const prompt = req.body.prompt;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a professional frontend developer.

Return ONLY valid JSON in this format:

{
  "pages": [
    { "filename": "index.html", "content": "full HTML content" },
    { "filename": "about.html", "content": "full HTML content" },
    { "filename": "features.html", "content": "full HTML content" },
    { "filename": "pricing.html", "content": "full HTML content" },
    { "filename": "contact.html", "content": "full HTML content" }
  ],
  "css": "complete shared CSS styling",
  "images": [
    { "filename": "logo.png", "prompt": "image description" }
  ]
}

Rules:
- All images MUST use: <img src="assets/<filename>">
- Never use leading slash in image path
- No markdown
- No explanation
- Each HTML must:
  - Start with <!DOCTYPE html>
  - Include: <link rel="stylesheet" href="style.css">
`
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    let raw = response.choices[0].message.content;
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(raw);

    // Ensure docs folder exists
    if (!fs.existsSync("docs")) {
      fs.mkdirSync("docs");
    }

    // Remove old HTML files
    fs.readdirSync("docs").forEach(file => {
      if (file.endsWith(".html")) {
        fs.unlinkSync(`docs/${file}`);
      }
    });

    // Ensure assets folder exists
    if (!fs.existsSync("docs/assets")) {
      fs.mkdirSync("docs/assets", { recursive: true });
    }

    // ===== Image Generation =====
    const MAX_IMAGES = 5;
    const imagesToGenerate = (parsed.images || []).slice(0, MAX_IMAGES);

    for (const img of imagesToGenerate) {
      const filePath = `docs/assets/${img.filename}`;

      if (!fs.existsSync(filePath)) {
        const imageResponse = await client.images.generate({
          model: "gpt-image-1",
          prompt: img.prompt,
          size: "1024x1024"
        });

        const imageBase64 = imageResponse.data[0].b64_json;
        const imageBuffer = Buffer.from(imageBase64, "base64");

        fs.writeFileSync(filePath, imageBuffer);
      }
    }

    // ===== Write Pages =====
    parsed.pages.forEach(page => {
      let content = page.content;

      // Fix accidental leading slash
      content = content.replace(
        /src="\/(.*?)"/g,
        'src="assets/$1"'
      );

      fs.writeFileSync(`docs/${page.filename}`, content);
    });

    // Write CSS
    fs.writeFileSync("docs/style.css", parsed.css);

    console.log("Site generated successfully.");

    // ===== Safe Commit Message =====
    const shortPrompt = prompt
      .replace(/["'`]/g, "")
      .replace(/\n/g, " ")
      .substring(0, 60)
      .trim();

    const commitMessage = `AI: ${shortPrompt}`;

    try {
      execSync("git add .", { stdio: "inherit" });
      execSync(`git commit -m "${commitMessage}"`, { stdio: "inherit" });
      execSync("git push", { stdio: "inherit" });
    } catch (gitErr) {
      console.error("Git error:", gitErr.message);
    }

    res.json({ status: "Generation successful" });

  } catch (err) {
    console.error("Generation error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================
// Git Commit History
// ============================

app.get("/commits", (req, res) => {
  try {
    const log = execSync(
      'git log --pretty=format:"%h|%s|%cd" --date=short -- docs',
      { encoding: "utf-8" }
    );

    const commits = log.split("\n").map(line => {
      const [hash, message, date] = line.split("|");
      return { hash, message, date };
    });

    res.json(commits);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================
// Git Rollback
// ============================

app.post("/git-rollback", (req, res) => {
  const { hash } = req.body;

  try {
    execSync(`git checkout ${hash} -- docs`);
    execSync("git add .");
    execSync(`git commit -m "Rollback to commit ${hash}"`);
    execSync("git push");

    res.json({ status: "Rollback successful" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});