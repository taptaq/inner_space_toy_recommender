import { motion, useReducedMotion } from "motion/react";
import {
  buildFloatingKnowledgeItems,
  type FloatingKnowledgeVariant,
} from "../lib/floating-knowledge-field.ts";
import type { LoadingFunFact } from "../lib/loading-fun-facts.ts";

export function FloatingKnowledgeField({
  facts,
  variant,
  className = "",
}: {
  facts: LoadingFunFact[];
  variant: FloatingKnowledgeVariant;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const desktopItems = buildFloatingKnowledgeItems(facts, {
    variant,
    viewport: "desktop",
  });
  const mobileItems = buildFloatingKnowledgeItems(facts, {
    variant,
    viewport: "mobile",
  });

  if (desktopItems.length === 0) {
    return null;
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetX = (event.clientX - bounds.left) / bounds.width - 0.5;
    const offsetY = (event.clientY - bounds.top) / bounds.height - 0.5;

    event.currentTarget.style.setProperty(
      "--floating-knowledge-hover-x",
      `${(offsetX * 12).toFixed(2)}px`,
    );
    event.currentTarget.style.setProperty(
      "--floating-knowledge-hover-y",
      `${(offsetY * 12).toFixed(2)}px`,
    );
    event.currentTarget.style.setProperty(
      "--floating-knowledge-hover-rotate-x",
      `${(-offsetY * 5).toFixed(2)}deg`,
    );
    event.currentTarget.style.setProperty(
      "--floating-knowledge-hover-rotate-y",
      `${(offsetX * 7).toFixed(2)}deg`,
    );
  };

  const handlePointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty("--floating-knowledge-hover-x", "0px");
    event.currentTarget.style.setProperty("--floating-knowledge-hover-y", "0px");
    event.currentTarget.style.setProperty("--floating-knowledge-hover-rotate-x", "0deg");
    event.currentTarget.style.setProperty("--floating-knowledge-hover-rotate-y", "0deg");
  };

  return (
    <div
      className={`floating-knowledge-field floating-knowledge-field-${variant} ${className}`.trim()}
      aria-hidden="true"
    >
      {[...desktopItems, ...mobileItems].map((item, index) => {
        const isMobileLayer = index >= desktopItems.length;
        const layerClassName = isMobileLayer
          ? "floating-knowledge-mobile-only"
          : "floating-knowledge-desktop-only";
        const targetOpacity =
          item.slot.depth === "near"
            ? isMobileLayer
              ? 0.7
              : 0.8
            : isMobileLayer
              ? 0.54
              : 0.58;

        return (
          <motion.div
            key={`${layerClassName}-${item.fact.id}-${item.slot.id}`}
            className={[
              "floating-knowledge-capsule",
              `floating-knowledge-capsule-${item.slot.depth}`,
              item.slot.className,
              item.slot.shapeClassName,
              item.slot.motionClassName,
              layerClassName,
            ].join(" ")}
            initial={{ opacity: 0 }}
            animate={{ opacity: prefersReducedMotion ? targetOpacity * 0.9 : targetOpacity }}
            whileHover={{
              opacity: prefersReducedMotion
                ? Math.min(targetOpacity * 0.98, 0.94)
                : Math.min(targetOpacity + 0.24, 0.94),
            }}
            transition={{
              duration: prefersReducedMotion ? 0.2 : 0.7,
              delay: prefersReducedMotion ? 0 : item.slot.delayMs / 1000,
              ease: "easeOut",
            }}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
          >
            <span>{item.fact.title}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
