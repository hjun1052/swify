export async function searchWeb(query: string, apiKey: string) {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: 4 }),
  });

  if (!res.ok) throw new Error("Serper Search failed");
  return res.json();
}

export async function searchimages(query: string, apiKey: string) {
  const res = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: 1 }),
  });

  if (!res.ok) throw new Error("Serper Image Search failed");
  const data = await res.json();
  return data.images?.[0]?.imageUrl || "";
}
