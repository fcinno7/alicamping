// seedSynonyms.js

import dbConnect from "./utils/dbConnect.js";
import mongoose from "mongoose";
// 위에서 드린 데이터를 여기에 변수로 넣습니다.
const synonymsData = [
  {
    mappingType: "equivalent",
    synonyms: [
      "낚시대",
      "낚싯대",
      "낚시 로드",
      "fishing rod",
      "rod",
      "낚시봉",
      "로드대",
    ],
  },

  {
    mappingType: "equivalent",
    synonyms: ["릴", "낚시릴", "낚시 릴", "reel", "fishing reel"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["릴시트", "릴 시트"],
  },

  {
    mappingType: "equivalent",
    synonyms: [
      "베이트릴",
      "베이트 릴",
      "캐스팅릴",
      "바다 베이트릴",
      "bait reel",
      "baitcasting reel",
      "캐스팅 릴",
      "베이트 리일",
    ],
  },

  {
    mappingType: "equivalent",
    synonyms: [
      "전동릴",
      "전동 릴",
      "전동낚시릴",
      "전동릴기",
      "electric reel",
      "power reel",
      "전동리일",
      "전동릴세트",
    ],
  },

  {
    mappingType: "equivalent",
    synonyms: ["원줄", "낚싯줄", "낚시줄", "라인", "main line", "fishing line"],
  },

  {
    mappingType: "equivalent",
    synonyms: [
      "합사",
      "합사줄",
      "PE라인",
      "PE 라인",
      "브레이드",
      "브레이드 라인",
      "braided line",
      "braid line",
    ],
  },
  {
    mappingType: "equivalent",
    synonyms: [
      "0.1호",
      "0.15호",
      "0.2호",
      "0.3호",
      "0.4호",
      "0.5호",
      "0.6호",
      "0.8호",
      "1호",
      "1.2호",
      "1.5호",
      "2호",
      "2.5호",
      "3호",
      "4호",
      "5호",
      "6호",
      "8호",
      "10호",
      "12호",
      "15호",
      "20호",
      "25호",
      "30호",
      "LB",
    ],
  },

  // {
  //   mappingType: "equivalent",
  //   synonyms: ["합사1호", "PE", "PE 라인"],
  // },

  {
    mappingType: "equivalent",
    synonyms: [
      "카본줄",
      "카본라인",
      "fluorocarbon",
      "fluorocarbon line",
      "FC라인",
      "FC 라인",
    ],
  },

  {
    mappingType: "equivalent",
    synonyms: [
      "목줄",
      "리더",
      "리더라인",
      "리더 줄",
      "쇼크리더",
      "쇼크 리더",
      "shock leader",
      "leader line",
    ],
  },

  {
    mappingType: "equivalent",
    synonyms: ["바늘", "낚시바늘", "훅", "후크", "hook", "낚시 훅", "바늘세트"],
  },

  {
    mappingType: "equivalent",
    synonyms: [
      "찌",
      "낚시찌",
      "찌낚시",
      "찌 채비",
      "float",
      "fishing float",
      "구멍찌",
      "전자찌",
    ],
  },

  {
    mappingType: "equivalent",
    synonyms: [
      "봉돌",
      "싱커",
      "추",
      "봉돌추",
      "lead weight",
      "납봉돌",
      "봉돌 세트",
    ],
  },

  {
    mappingType: "equivalent",
    synonyms: [
      "도래",
      "회전도래",
      "삼각도래",
      "swivel",
      "fishing swivel",
      "도래 세트",
    ],
  },

  {
    mappingType: "equivalent",
    synonyms: [
      "스냅",
      "스냅도래",
      "클립",
      "카라비너 스냅",
      "snap",
      "snap swivel",
      "퀵스냅",
      "스냅링",
    ],
  },

  {
    mappingType: "equivalent",
    synonyms: [
      "루어",
      "인조미끼",
      "인공미끼",
      "가짜미끼",
      "lure",
      "fishing lure",
      "루어미끼",
      "하드베이트",
    ],
  },

  {
    mappingType: "equivalent",
    synonyms: [
      "웜",
      "소프트베이트",
      "소프트 베이트",
      "웜미끼",
      "worm",
      "soft bait",
      "소프트루어",
      "소프트 루어",
    ],
  },

  {
    mappingType: "equivalent",
    synonyms: [
      "미노우",
      "미노",
      "미노우 루어",
      "minnow",
      "미노우베이트",
      "하드미노우",
      "싱킹 미노우",
      "플로팅 미노우",
    ],
  },

  {
    mappingType: "equivalent",
    synonyms: [
      "크랭크베이트",
      "크랭크",
      "crankbait",
      "크랭크 루어",
      "딥크랭크",
      "섈로우 크랭크",
      "크랭크미끼",
      "크랭크베이트 루어",
    ],
  },

  {
    mappingType: "equivalent",
    synonyms: [
      "스피너베이트",
      "스피너",
      "spinnerbait",
      "스피너 루어",
      "블레이드베이트",
      "블레이드 루어",
      "스피너 미끼",
      "스피너베이트 루어",
    ],
  },

  {
    mappingType: "equivalent",
    synonyms: [
      "스푼",
      "스푼루어",
      "spoon",
      "spoon lure",
      "메탈스푼",
      "송어스푼",
      "스푼 미끼",
      "스푼 베이트",
    ],
  },

  {
    mappingType: "equivalent",
    synonyms: [
      "메탈지그",
      "지그",
      "지깅",
      "metal jig",
      "jig",
      "jigging",
      "슬로우지그",
      "지그헤드",
    ],
  },

  {
    mappingType: "equivalent",
    synonyms: [
      "다운샷",
      "다운샷리그",
      "다운샷 채비",
      "downshot",
      "drop shot",
      "드롭샷",
      "드롭샷리그",
      "드롭샷 채비",
    ],
  },

  {
    mappingType: "equivalent",
    synonyms: [
      "텍사스리그",
      "텍사스 리그",
      "텍사스 채비",
      "texas rig",
      "텍사스",
      "오프셋훅",
      "오프셋 훅",
      "텍사스 세팅",
    ],
  },

  {
    mappingType: "equivalent",
    synonyms: ["노싱커", "노싱커리그", "노 싱커", "프리리그", "free rig"],
  },

  {
    mappingType: "equivalent",
    synonyms: [
      "원투낚시",
      "원투",
      "원투대",
      "원투채비",
      "서프캐스팅",
      "surf casting",
      "원거리 캐스팅",
      "캐스팅낚시",
    ],
  },

  {
    mappingType: "equivalent",
    synonyms: [
      "텅스텐싱커",
      "텅스텐 싱커",
      "텅스텐 봉돌",
      "텅스텐추, 싱커 , 봉돌",
    ],
  },
  {
    mappingType: "equivalent",
    synonyms: ["구멍 봉돌", "구멍봉돌"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["배쓰", "배스"],
  },

  // {
  //   mappingType: "equivalent",
  //   synonyms: ["zoro", "조로", "ZORO"],
  // },

  {
    mappingType: "equivalent",
    synonyms: ["케미", "케미라이트", "야광봉", "발광봉"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["플로트", "찌", "낚시찌", "float"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["1", "I"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["2", "II"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["3", "III"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["24톤", "24t"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["30톤", "30t"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["36톤", "36t"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["40톤", "40t"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["46톤", "46t"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["55톤", "55t"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["60톤", "60t"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["65톤", "65t"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["카본", "carbon", "카본로드", "탄소섬유"],
  },

  {
    mappingType: "equivalent",
    synonyms: ["베타", "better"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["blue", "블루"],
  },

  {
    mappingType: "equivalent",
    synonyms: ["seekbass", "시크베이스", "시크베스"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["black", "블랙"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["creek", "크릭"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["에기", "오징어", "갑오징어", "squid jig", "egi", "미끼"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["쭈꾸미", "squid jig", "갑오징어", "shrimp"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["찌", "잉어"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["베이트", "베이트캐스팅", "bait", "baitcasting"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["타이러버", "타이라바", "madai", "마다이", "인치쿠", "Inchiku"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["하이와", "HIAW"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["티탄", "티타늄", "타이타늄", "titanium"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["m", "미터"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["리더", "leader", "쇼크리더", "FC리더", "카본리더"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["쿨러", "태클박스", "박스"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["미노우", "minnow"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["pro", "프로"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["거치대", "브래킷", "받침대", "로드홀더", "받침틀"],
  },
  {
    mappingType: "equivalent",
    synonyms: ["surf", "원투", "surfcasting"],
  },
  {
    mappingType: "equivalent",
    synonyms: [
      "바다물",
      "바닷물",
      "바닷물용",
      "바다물용",
      "salt water",
      "saltwater",
      "바다용",
      "해수용",
    ],
  },
  {
    mappingType: "equivalent",
    synonyms: [
      "고추장",
      "레드브라운",
      "red brown",
      "redbrown",
      "레드",
      "red",

      "브라운레드",
      "brown red",
      "brownred",

      "brown",
      "브라운",
      "갈색",

      "적갈색",
      "reddish brown",

      "버건디",
      "burgundy",

      "와인색",
      "wine",
      "wine color",
      "wine red",
    ],
  },
];

const normalizeSynTerm = (s) => {
  let x = String(s ?? "")
    .trim()
    .toLowerCase();
  if (!x) return "";

  // ⚠️ Atlas Search synonyms에서 자주 터지는 패턴을 안전 치환
  // - 슬래시/하이픈/점 + 한 글자 토큰 조합은 analyzer에 따라 graph token 생성 -> 실패 가능
  x = x
    // 케이스
    .replace(/\bt\/g\b/g, "tg")
    // RGB
    .replace(/\ba-rgb\b/g, "argb")
    // 네트워크/인터페이스
    .replace(/\bwi-fi\b/g, "wifi")
    .replace(/\bpci-e\b/g, "pcie")
    // 폼팩터
    .replace(/\bm-atx\b/g, "matx")
    .replace(/\bmini-itx\b/g, "mini itx")
    // 스토리지 표기
    .replace(/\bm\.2\b/g, "m2");

  // 공백 정리
  x = x.replace(/\s+/g, " ").trim();

  return x;
};

const cleanToken = (s) => {
  const t = normalizeSynTerm(s);
  if (!t) return null;

  // ✅ 더 안전하게 가고 싶으면 공백 제거(옵션)
  // return t.replace(/\s+/g, "");

  return t;
};

// --------------------------
// 2) 문서 검증 + 정리
// --------------------------
const cleanDoc = (doc) => {
  if (!doc || typeof doc !== "object") return null;

  const mappingType = doc.mappingType;
  if (!["equivalent", "explicit"].includes(mappingType)) return null;

  // synonyms 검증/정리
  if (!Array.isArray(doc.synonyms)) return null;

  const synonyms = doc.synonyms.map(cleanToken).filter(Boolean);
  const uniqSynonyms = [...new Set(synonyms)];

  if (uniqSynonyms.length < 1) return null;
  if (mappingType === "equivalent" && uniqSynonyms.length < 2) return null;

  // explicit일 때 input도 필수
  if (mappingType === "explicit") {
    if (!Array.isArray(doc.input)) return null;
    const input = doc.input.map(cleanToken).filter(Boolean);
    const uniqInput = [...new Set(input)];
    if (uniqInput.length < 1) return null;

    return {
      mappingType: "explicit",
      input: uniqInput,
      synonyms: uniqSynonyms,
    };
  }

  // equivalent
  return {
    mappingType: "equivalent",
    synonyms: uniqSynonyms,
  };
};

// --------------------------
// 3) 배치 삽입 유틸 (너무 큰 insertMany 방지)
// --------------------------
const chunkArray = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// --------------------------
// 4) 메인 시드 함수
// --------------------------
const seedDB = async () => {
  try {
    await dbConnect();
    console.log("🔥 MongoDB Connected!");

    const collection = mongoose.connection.collection("search_synonyms");

    // 데이터 정리/검증
    const cleaned = [];
    const rejected = [];

    synonymsData.forEach((d, i) => {
      const cd = cleanDoc(d);
      if (cd) cleaned.push(cd);
      else rejected.push({ index: i, doc: d });
    });

    console.log(`📦 원본: ${synonymsData.length}개`);
    console.log(`✅ 정리 후: ${cleaned.length}개`);
    console.log(`🚫 거절: ${rejected.length}개`);

    // 거절 샘플 출력(많으면 10개만)
    if (rejected.length) {
      console.log("🚫 rejected sample (up to 10):");
      rejected.slice(0, 10).forEach((r) => {
        console.log(`- index ${r.index}:`, r.doc);
      });
    }

    // 기존 데이터 삭제
    await collection.deleteMany({});
    console.log("🗑️ 기존 동의어 삭제 완료");

    // 배치 삽입
    const BATCH_SIZE = 1000; // 필요 시 조절
    const batches = chunkArray(cleaned, BATCH_SIZE);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (batch.length === 0) continue;
      await collection.insertMany(batch, { ordered: true });
      console.log(
        `✅ batch ${i + 1}/${batches.length} inserted: ${batch.length}개`,
      );
    }

    console.log(`🎉 총 ${cleaned.length}개 동의어 입력 완료!`);

    process.exit(0);
  } catch (error) {
    console.error("❌ 에러 발생:", error);
    process.exit(1);
  }
};

seedDB();
