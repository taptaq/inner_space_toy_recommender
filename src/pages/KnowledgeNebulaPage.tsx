import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  KNOWLEDGE_NEBULA_TOPICS,
  getKnowledgeNebulaTopicBySlug,
  type KnowledgeNebulaTopicSlug,
} from "../data/knowledge-nebula.ts";
import { KnowledgeNebulaField } from "../components/KnowledgeNebulaField.tsx";
import { KnowledgeNebulaTopicSections } from "../components/KnowledgeNebulaTopicSections.tsx";
import { TopicDetailScene3D } from "../components/knowledge-nebula/TopicDetailScene3D.tsx";
import {
  buildBrandKnowledgeTopic,
  type BrandKnowledgeSource,
} from "../lib/knowledge-nebula-brand-topic.ts";
import {
  buildTopicDetailSceneMeta,
  getTopicDetailViewport,
  type TopicDetailViewport,
} from "../lib/knowledge-nebula-topic-detail-scene.ts";
import { usePagePerformanceState } from "../lib/page-performance.ts";

function useTopicDetailViewport(): TopicDetailViewport {
  const [viewport, setViewport] = useState<TopicDetailViewport>(() =>
    getTopicDetailViewport(),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const syncViewport = (matches: boolean) => {
      setViewport(matches ? "desktop" : "mobile");
    };

    syncViewport(mediaQuery.matches);

    const onChange = (event: MediaQueryListEvent) => {
      syncViewport(event.matches);
    };

    mediaQuery.addEventListener("change", onChange);
    return () => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }, []);

  return viewport;
}

export function KnowledgeNebulaPage({
  pageVariants,
  topicSlug,
  sectionId,
  onBack,
  onSelectTopic,
}: {
  pageVariants: any;
  topicSlug?: KnowledgeNebulaTopicSlug;
  sectionId?: string;
  onBack: () => void;
  onSelectTopic: (slug: KnowledgeNebulaTopicSlug) => void;
}) {
  const baseTopic = topicSlug ? getKnowledgeNebulaTopicBySlug(topicSlug) : undefined;
  const [brandSources, setBrandSources] = useState<BrandKnowledgeSource[]>([]);
  const topic =
    baseTopic && topicSlug === "brand"
      ? buildBrandKnowledgeTopic(
          baseTopic,
          brandSources.length > 0 ? brandSources : undefined,
        )
      : baseTopic;
  const { shouldAnimate } = usePagePerformanceState();
  const isDetailPage = topic != null;
  const detailViewport = useTopicDetailViewport();
  const detailSceneMeta = useMemo(
    () => (topic ? buildTopicDetailSceneMeta(topic) : undefined),
    [topic],
  );

  useEffect(() => {
    if (topicSlug !== "brand") {
      setBrandSources([]);
      return undefined;
    }

    let cancelled = false;

    const loadBrandSources = async () => {
      try {
        const response = await fetch(`/api/knowledge/brands`);
        if (!response.ok) {
          if (!cancelled) {
            setBrandSources([]);
          }
          return;
        }

        const payload = (await response.json()) as { brands: BrandKnowledgeSource[] };
        if (!cancelled) {
          setBrandSources(Array.isArray(payload.brands) ? payload.brands : []);
        }
      } catch (_error) {
        if (!cancelled) {
          setBrandSources([]);
        }
      }
    };

    void loadBrandSources();

    return () => {
      cancelled = true;
    };
  }, [topicSlug]);

  useEffect(() => {
    if (!isDetailPage || typeof document === "undefined") {
      return undefined;
    }

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyHeight = body.style.height;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousHtmlHeight = documentElement.style.height;

    body.style.overflow = "hidden";
    body.style.height = "100dvh";
    documentElement.style.overflow = "hidden";
    documentElement.style.height = "100dvh";

    return () => {
      body.style.overflow = previousBodyOverflow;
      body.style.height = previousBodyHeight;
      documentElement.style.overflow = previousHtmlOverflow;
      documentElement.style.height = previousHtmlHeight;
    };
  }, [isDetailPage]);

  return (
    <motion.div
      key={topicSlug ? `knowledge-${topicSlug}` : "knowledge"}
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className={[
        isDetailPage
          ? "knowledge-detail-viewport fixed inset-0 h-[100dvh] w-screen overflow-hidden"
          : "relative h-dvh w-full overflow-hidden",
        shouldAnimate ? "" : "ambient-motion-paused",
      ].join(" ")}
    >
      <div
        className={
          isDetailPage
            ? "absolute left-4 top-4 z-50 sm:left-6 sm:top-6"
            : "absolute left-4 top-4 z-50 sm:left-6 sm:top-6"
        }
      >
        <button
          type="button"
          onClick={onBack}
          className="knowledge-detail-back-button inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>返回上一层</span>
        </button>
      </div>

      {isDetailPage ? (
        <section className="knowledge-detail-stage relative isolate h-[100dvh] overflow-hidden">
            <div className="knowledge-detail-stage-glow pointer-events-none absolute inset-0" />
            <div className="knowledge-detail-stage-stars pointer-events-none absolute inset-0 opacity-40 [background-size:170px_170px,230px_230px,190px_190px,260px_260px]" />
            <div className="cockpit-cruise-field pointer-events-none absolute inset-0 overflow-hidden">
              <div className="cockpit-cruise-stars cockpit-cruise-stars-a absolute inset-[-12%]" />
              <div className="cockpit-cruise-stars cockpit-cruise-stars-b absolute inset-[-18%]" />
              <div className="cockpit-cruise-depth absolute inset-[-8%]">
                <div className="cockpit-cruise-dust cockpit-cruise-dust-a absolute inset-0" />
                <div className="cockpit-cruise-dust cockpit-cruise-dust-b absolute inset-0" />
                <div className="cockpit-cruise-speedline cockpit-cruise-speedline-a absolute left-[58%] top-[18%] h-px w-[26vw] rotate-[-10deg]" />
                <div className="cockpit-cruise-speedline cockpit-cruise-speedline-b absolute left-[8%] top-[45%] h-px w-[34vw] rotate-[-12deg]" />
                <div className="cockpit-cruise-speedline cockpit-cruise-speedline-c absolute left-[46%] top-[72%] h-px w-[30vw] rotate-[-14deg]" />
              </div>
              <div className="cockpit-cruise-stream cockpit-cruise-stream-a absolute left-[-12%] top-[24%] h-px w-[42vw] rotate-[-13deg]" />
              <div className="cockpit-cruise-stream cockpit-cruise-stream-b absolute right-[-16%] top-[58%] h-px w-[48vw] rotate-[-17deg]" />
              <div className="cockpit-cruise-beacon absolute left-[18%] top-[18%] h-1 w-1 rounded-full bg-cyan-100/70" />
            </div>
            {detailSceneMeta ? (
              <TopicDetailScene3D
                topicSlug={topic.slug}
                nodeCount={topic.sections.length}
                meta={detailSceneMeta}
                viewport={detailViewport}
                className="pointer-events-none opacity-95"
              />
            ) : null}
            <div className="absolute inset-0 z-10">
              <KnowledgeNebulaTopicSections
                topic={topic}
                initialOpenSectionId={sectionId}
              />
            </div>
        </section>
      ) : (
        <div>
          <KnowledgeNebulaField
            topics={KNOWLEDGE_NEBULA_TOPICS.filter((candidate) => candidate.slug !== "brand")}
            selectedTopicSlug={topicSlug}
            onSelectTopic={onSelectTopic}
          />
        </div>
      )}
    </motion.div>
  );
}
