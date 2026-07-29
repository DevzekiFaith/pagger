type LanguageToolMatch = {
  offset: number;
  length: number;
  replacements?: Array<{ value?: string }>;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { text?: string };
    const text = payload.text?.trim();

    if (!text) {
      return Response.json({ correctedText: "" });
    }

    const body = new URLSearchParams({
      text,
      language: "en-US",
    });

    const response = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      return Response.json({ correctedText: text });
    }

    const result = (await response.json()) as { matches?: LanguageToolMatch[] };
    const matches = (result.matches ?? []).slice().sort((a, b) => b.offset - a.offset);

    let corrected = text;
    for (const match of matches) {
      const replacement = match.replacements?.[0]?.value;
      if (!replacement) continue;

      corrected =
        corrected.slice(0, match.offset) + replacement + corrected.slice(match.offset + match.length);
    }

    return Response.json({ correctedText: corrected });
  } catch {
    return Response.json({ correctedText: "" }, { status: 500 });
  }
}
