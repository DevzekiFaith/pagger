type DictionaryMeaning = {
  partOfSpeech?: string;
  definitions?: Array<{ definition?: string }>;
};

type DictionaryApiItem = {
  word?: string;
  phonetic?: string;
  meanings?: DictionaryMeaning[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const term = (searchParams.get("term") ?? "").trim().toLowerCase();

  if (!term) {
    return Response.json({ error: "Missing term." }, { status: 400 });
  }

  try {
    const [dictionaryResponse, concordanceResponse] = await Promise.all([
      fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`),
      fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(term)}&max=8`),
    ]);

    const dictionaryRaw = dictionaryResponse.ok ? ((await dictionaryResponse.json()) as DictionaryApiItem[]) : [];
    const concordanceRaw = concordanceResponse.ok
      ? ((await concordanceResponse.json()) as Array<{ word?: string; score?: number }>)
      : [];

    const topDefinition = dictionaryRaw[0];
    const meanings =
      topDefinition?.meanings?.slice(0, 3).map((meaning) => ({
        partOfSpeech: meaning.partOfSpeech ?? "unknown",
        definitions: (meaning.definitions ?? []).slice(0, 2).map((item) => item.definition ?? ""),
      })) ?? [];

    return Response.json({
      word: topDefinition?.word ?? term,
      phonetic: topDefinition?.phonetic ?? "",
      meanings,
      relatedWords: concordanceRaw.map((item) => item.word).filter(Boolean),
    });
  } catch {
    return Response.json({ error: "Dictionary lookup failed." }, { status: 500 });
  }
}
