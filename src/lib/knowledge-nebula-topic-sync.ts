import type {
  KnowledgeNebulaSection,
  KnowledgeNebulaTopic,
} from "../data/knowledge-nebula.ts";

export function mergeKnowledgeNebulaTopicPayload(
  localTopic: KnowledgeNebulaTopic,
  remoteTopic: KnowledgeNebulaTopic,
): KnowledgeNebulaTopic {
  const remoteSectionsById = new Map(
    remoteTopic.sections.map((section) => [section.id, section]),
  );
  const localSectionsById = new Map(
    localTopic.sections.map((section) => [section.id, section]),
  );
  const mergedSections = localTopic.sections.map(
    (section) => remoteSectionsById.get(section.id) ?? section,
  );

  for (const remoteSection of remoteTopic.sections) {
    if (!localSectionsById.has(remoteSection.id)) {
      mergedSections.push(remoteSection);
    }
  }

  return {
    ...remoteTopic,
    title: localTopic.title,
    shortLabel: localTopic.shortLabel,
    summary: localTopic.summary,
    accent: localTopic.accent,
    sections: attachRelatedSectionIds(mergedSections),
    featuredSectionIds: Array.from(
      new Set([
        ...localTopic.featuredSectionIds,
        ...remoteTopic.featuredSectionIds,
      ]),
    ),
  };
}

function attachRelatedSectionIds(
  sections: KnowledgeNebulaSection[],
): KnowledgeNebulaSection[] {
  return sections.map((section, _, allSections) => ({
    ...section,
    relatedSectionIds:
      section.relatedSectionIds?.length
        ? section.relatedSectionIds
        : buildRelatedSectionIds(section, allSections),
  }));
}

function buildRelatedSectionIds(
  section: KnowledgeNebulaSection,
  sections: KnowledgeNebulaSection[],
) {
  const currentEmbedding = normalizeEmbedding(section.embedding);
  const currentTags = section.tags ?? [];

  return sections
    .filter((candidate) => candidate.id !== section.id)
    .map((candidate) => {
      const candidateEmbedding = normalizeEmbedding(candidate.embedding);
      const semanticScore =
        currentEmbedding && candidateEmbedding
          ? cosineSimilarity(currentEmbedding, candidateEmbedding) * 100
          : 0;
      const tagScore =
        countOverlap(currentTags, candidate.tags ?? []) * 8;
      const heatScore = Math.min(candidate.viewCount ?? 0, 20) / 20;

      return {
        id: candidate.id,
        score: semanticScore + tagScore + heatScore,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((candidate) => candidate.id);
}

function normalizeEmbedding(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const embedding = value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));

  return embedding.length > 0 ? embedding : null;
}

function cosineSimilarity(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  if (length === 0) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function countOverlap(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item)).length;
}
