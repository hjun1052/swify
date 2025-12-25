import { NextRequest, NextResponse } from "next/server";
import { scrapeWeb, scrapeImages } from "@/lib/crawler";

export const runtime = "nodejs";

const SECTIONS_CONFIG: any = {
  en: [
    {
      id: "briefing",
      query: "top technology news today Dec 2025",
      category: "Future Tech",
    },
    {
      id: "issues",
      query: "major global news headlines Dec 2025",
      category: "Politics",
    },
    {
      id: "facts",
      query: "fascinating new facts and world weather 2025",
      category: "Environment",
    },
  ],
  ko: [
    {
      id: "briefing",
      query: "오늘의 주요 기술 뉴스 및 IT 동향 2025년 12월",
      category: "Future Tech",
    },
    {
      id: "issues",
      query: "전 세계 주요 뉴스 헤드라인 2025년 12월",
      category: "Politics",
    },
    {
      id: "facts",
      query: "오늘의 날씨 정보와 흥미로운 상식 2025",
      category: "Environment",
    },
  ],
  ja: [
    {
      id: "briefing",
      query: "今日の最新テクノロジーニュース 2025年12月",
      category: "Future Tech",
    },
    {
      id: "issues",
      query: "主要な世界のニュース 2025年12月",
      category: "Politics",
    },
    {
      id: "facts",
      query: "興味深い豆知識と世界の天気 2025",
      category: "Environment",
    },
  ],
  es: [
    {
      id: "briefing",
      query: "noticias tecnológicas de hoy diciembre 2025",
      category: "Future Tech",
    },
    {
      id: "issues",
      query: "titulares de noticias globales hoy diciembre 2025",
      category: "Politics",
    },
    {
      id: "facts",
      query: "datos curiosos y clima mundial hoy 2025",
      category: "Environment",
    },
  ],
};

// Simple keyword-based mock translator for better demo feel
const MOCK_TRANSLATIONS: any = {
  ko: {
    SpaceX: "스페이스X",
    Apple: "애플",
    Google: "구글",
    Microsoft: "마이크로소프트",
    AI: "인공지능",
    Robot: "로봇",
    Climate: "기후",
    Weather: "날씨",
    Bitcoin: "비트코인",
    Crypto: "암호화폐",
    Launch: "발사",
    Mission: "미션",
    World: "세계",
    News: "뉴스",
  },
  ja: {
    SpaceX: "スペースX",
    Apple: "アップル",
    Google: "グーグル",
    Microsoft: "マイクロソフト",
    AI: "人工知能",
    Robot: "ロボット",
    Climate: "気候",
    Weather: "天気",
    Bitcoin: "ビットコイン",
    Crypto: "仮想通貨",
    Launch: "打ち上げ",
    Mission: "ミッション",
    World: "世界",
    News: "ニュース",
  },
};

function mockTranslate(text: string, lang: string) {
  if (lang === "en" || !MOCK_TRANSLATIONS[lang]) return text;

  let translated = text;
  const dict = MOCK_TRANSLATIONS[lang];

  Object.keys(dict).forEach((key) => {
    const regex = new RegExp(key, "gi");
    translated = translated.replace(regex, dict[key]);
  });

  return translated;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lang = (searchParams.get("lang") || "en") as string;

    const sections = SECTIONS_CONFIG[lang] || SECTIONS_CONFIG.en;

    const sectionPromises = sections.map(async (section: any) => {
      const searchRes = await scrapeWeb(section.query);
      const items = [];
      const organic = searchRes.organic;

      for (let i = 0; i < organic.length; i++) {
        const res = organic[i];
        let title = res.title.split(" - ")[0].split(" | ")[0].trim();

        // 1. Try mock translation for key terms
        title = mockTranslate(title, lang);

        // 2. Add visual indicator
        const flag =
          lang === "ko"
            ? "🇰🇷 "
            : lang === "ja"
            ? "🇯🇵 "
            : lang === "es"
            ? "🇪🇸 "
            : "";
        title = flag + title;

        const imageUrl = await scrapeImages(
          title + " " + section.category,
          section.category
        );

        items.push({
          id: `${section.id}-${i}`,
          title: title,
          query: title,
          image:
            imageUrl ||
            "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1000",
          category: section.category,
        });
      }
      return { id: section.id, items };
    });

    const resultsArray = await Promise.all(sectionPromises);
    const results: any = {};
    resultsArray.forEach((res) => {
      results[res.id] = res.items;
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("Home content fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
