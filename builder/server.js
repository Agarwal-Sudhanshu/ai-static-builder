import express from "express";
import fs from "fs";
import dotenv from "dotenv";
import OpenAI from "openai";
import { execSync } from "child_process";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static("builder/public"));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/generate", async (req, res) => {
  const prompt = req.body.prompt;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Generate ONLY raw HTML and separate CSS inside <style> tags. No explanation.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    let htmlContent = response.choices[0].message.content;
    htmlContent = htmlContent.replace(/```html/g, "").replace(/```/g, "");

    fs.writeFileSync("docs/index.html", htmlContent.trim());

    execSync("git add .");
    execSync(`git commit -m "AI update: ${prompt}"`);
    execSync("git push");

    res.json({ status: "Success" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});