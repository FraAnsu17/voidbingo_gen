export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, systemPrompt } = req.body;
  if (!systemPrompt || typeof systemPrompt !== "string") {
    return res.status(400).json({ error: "Missing systemPrompt" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
  }

  const jsonInstruction = `\n\nRispondi SOLO con un array JSON valido di 10 stringhe, senza nessun altro testo, senza backtick, senza markdown. Esempio: ["frase 1", "frase 2", ..., "frase 10"]`;
  const fullPrompt = prompt
    ? `${systemPrompt}${jsonInstruction}\n\nTema o contesto aggiuntivo: ${prompt}`
    : `${systemPrompt}${jsonInstruction}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: fullPrompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 1024,
          }
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemini error:", err);
      return res.status(502).json({ error: "Gemini API error", detail: err });
    }

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON array dalla risposta
    const cleaned = raw.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
    let phrases;
    try {
      phrases = JSON.parse(cleaned);
      if (!Array.isArray(phrases)) throw new Error("Not an array");
    } catch {
      // Fallback: split per newline se il JSON parsing fallisce
      phrases = cleaned
        .split("\n")
        .map((l) => l.replace(/^[\d\-\.\*\"\s]+/, "").replace(/\",$/, "").replace(/^\"/, "").replace(/\"$/, "").trim())
        .filter(Boolean)
        .slice(0, 10);
    }

    return res.status(200).json({ phrases });
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}