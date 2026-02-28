import fs from "fs";
import dotenv from "dotenv";
import OpenAI from "openai";
import { execSync } from "child_process";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const prompt = process.argv.slice(2).join(" ");

if (!prompt) {
  console.log("Please provide a prompt.");
  process.exit(1);
}

async function generatePage() {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a web developer. Generate ONLY raw HTML. Do NOT include explanations. Return pure HTML starting with <!DOCTYPE html>.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  let htmlContent = response.choices[0].message.content;
  htmlContent = htmlContent.replace(/```html/g, "").replace(/```/g, "");

  fs.writeFileSync("index.html", htmlContent.trim());

  console.log("HTML generated.");

  // Auto Git Commit + Push
  execSync("git add .");
  execSync(`git commit -m "AI update: ${prompt}"`);
  execSync("git push");

  console.log("Changes pushed to GitHub.");
}

generatePage();