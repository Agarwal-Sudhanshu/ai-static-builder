import fs from "fs";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const prompt = process.argv[2];

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
        content: "You are a web developer. Generate a complete responsive HTML landing page with inline CSS.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const htmlContent = response.choices[0].message.content;

  fs.writeFileSync("index.html", htmlContent);

  console.log("index.html generated successfully!");
}

generatePage();