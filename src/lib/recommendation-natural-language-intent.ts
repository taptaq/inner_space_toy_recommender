export type RecommendationNaturalLanguageIntent = {
  rawQuery: string;
  must: {
    suctionProduct: boolean;
    externalOnly: boolean;
  };
  prefer: {
    strongSuction: boolean;
    morePatterns: boolean;
    moderateNoise: boolean;
    gentleIntensity: boolean;
  };
  avoid: {
    insertable: boolean;
    appOrRemote: boolean;
    couple: boolean;
    strongIntensity: boolean;
  };
};

export function parseNaturalLanguageRecommendationIntent(
  query: string,
): RecommendationNaturalLanguageIntent {
  const rawQuery = String(query || "").trim();
  const lowerQuery = rawQuery.toLowerCase();

  const expressesSuction =
    /吮吸|吸感|吸吮|小海豚|阴蒂吸|air ?pulse|suction/.test(lowerQuery);
  const strongSuction =
    /吮吸感更强|更强吮吸|更强吸感|吸力更强|吸感更强/.test(lowerQuery);
  const explicitInsertableAllowance =
    /想要入体|可以入体|接受入体|内外一起|双刺激|双通道|g点|g\s*点/.test(lowerQuery);

  return {
    rawQuery,
    must: {
      suctionProduct: expressesSuction,
      externalOnly: expressesSuction && !explicitInsertableAllowance,
    },
    prefer: {
      strongSuction,
      morePatterns: /波形.*多|模式.*多|档位.*多|变化.*多|花样.*多/.test(lowerQuery),
      moderateNoise: /噪音适中|声音适中|别太吵|不要太吵|静音|夜晚|宿舍|同住/.test(
        lowerQuery,
      ),
      gentleIntensity: /温和一点|柔和一点|别太刺激|不要太刺激|不想太刺激/.test(lowerQuery),
    },
    avoid: {
      insertable: /不要入体|别入体|不想入体|拒绝入体/.test(lowerQuery),
      appOrRemote: /不要app|别用app|不要远控|别远控|不想app|不想远控/.test(lowerQuery),
      couple: /不要情侣|不要双人|不要共玩|别情侣|别双人|别共玩/.test(lowerQuery),
      strongIntensity: /不要太刺激|别太刺激|不想太刺激|温和一点/.test(lowerQuery),
    },
  };
}
