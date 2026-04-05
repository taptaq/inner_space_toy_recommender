/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { products, questions, AnswerState, Product } from "./data/mock";
import {
  Orbit,
  Hexagon,
  Triangle,
  CircleDashed,
  Sparkles,
  ShieldCheck,
  VolumeX,
  Droplets,
  Zap,
  ChevronRight,
} from "lucide-react";

export default function App() {
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<AnswerState>({ tags: [] });
  const [topProducts, setTopProducts] = useState<
    (Product & { score: number })[]
  >([]);

  const handleOptionSelect = (field: string, value: any, tag: string) => {
    setAnswers((prev) => ({
      ...prev,
      [field]: value,
      tags: [...prev.tags, tag],
    }));

    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      setStep(questions.length); // Loading state
      calculateResults();
    }
  };

  const calculateResults = () => {
    // Wait for the state to update, then calculate
    setTimeout(() => {
      setAnswers((currentAnswers) => {
        // Step 1: Absolute Filter
        const filtered = products.filter((p) => {
          // Budget
          if (currentAnswers.budget) {
            if (
              p.price < currentAnswers.budget[0] ||
              p.price > currentAnswers.budget[1]
            )
              return false;
          }
          // Auditory
          if (currentAnswers.maxDb && p.maxDb > currentAnswers.maxDb)
            return false;
          // Visual
          if (
            currentAnswers.appearance === "high_disguise" &&
            p.appearance !== "high_disguise"
          )
            return false;
          return true;
        });

        // Step 2: Weighted Scoring
        const scored = filtered.map((p) => {
          let score = 0;
          if (p.physicalForm === currentAnswers.physicalForm) score += 100;
          if (p.motorType === currentAnswers.motorType) score += 20;
          if (
            currentAnswers.waterproof &&
            p.waterproof >= currentAnswers.waterproof
          )
            score += 20;
          return { ...p, score };
        });

        scored.sort((a, b) => b.score - a.score);

        // If filtered is empty, fallback to top scored overall (relaxing budget/strict filters)
        if (scored.length === 0) {
          const fallbackScored = products
            .map((p) => {
              let score = 0;
              if (p.physicalForm === currentAnswers.physicalForm) score += 100;
              if (p.motorType === currentAnswers.motorType) score += 20;
              if (
                currentAnswers.waterproof &&
                p.waterproof >= currentAnswers.waterproof
              )
                score += 20;
              return { ...p, score };
            })
            .sort((a, b) => b.score - a.score);
          setTopProducts(fallbackScored.slice(0, 3));
        } else {
          setTopProducts(scored.slice(0, 3));
        }

        return currentAnswers;
      });

      // Transition to result page after 3 seconds
      setTimeout(() => {
        setStep(questions.length + 1);
      }, 3000);
    }, 0);
  };

  const resetQuiz = () => {
    setStep(0);
    setAnswers({ tags: [] });
    setTopProducts([]);
  };

  // Animation variants
  const pageVariants = {
    initial: { opacity: 0, x: 20, scale: 0.95 },
    in: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    },
    out: {
      opacity: 0,
      x: -20,
      scale: 0.95,
      transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 relative overflow-hidden">
      {/* Background ambient elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-cyan-900/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        <AnimatePresence mode="wait">
          {/* Welcome Screen */}
          {step === -1 && (
            <motion.div
              key="welcome"
              variants={pageVariants}
              initial="initial"
              animate="in"
              exit="out"
              className="w-full flex flex-col items-center"
            >
              <div className="relative mb-12 flex justify-center items-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="absolute w-32 h-32 border border-cyan-500/20 rounded-full"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{
                    duration: 30,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="absolute w-40 h-40 border border-indigo-500/20 rounded-full border-dashed"
                />
                <div className="w-20 h-20 glass-panel rounded-full flex items-center justify-center relative z-10">
                  <Orbit className="w-10 h-10 text-cyan-300 opacity-90" />
                </div>
              </div>

              <div className="glass-panel rounded-3xl p-8 w-full text-center relative overflow-hidden flex flex-col items-center">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-50"></div>

                <h1 className="text-3xl font-light tracking-widest mb-2 text-white">
                  内太空智能选品向导
                </h1>
                <h2 className="text-xs tracking-widest text-cyan-500/80 mb-8 font-mono">
                  SELECTION GUIDE
                </h2>

                <p className="text-sm text-slate-300 mb-10 leading-relaxed max-w-[260px]">
                  跳过复杂难懂的参数陷阱与营销词汇。只需回答几个简单的偏好问题，我们将基于严密的过滤体系，为你精准匹配出最契合自身需求的私密设备。
                </p>

                <button
                  onClick={() => setStep(0)}
                  className="group relative w-full py-4 rounded-2xl bg-cyan-900/30 hover:bg-cyan-800/50 border border-cyan-500/30 text-cyan-50 transition-all overflow-hidden flex items-center justify-center gap-2"
                >
                  <motion.div
                    className="absolute inset-0 bg-cyan-400/5"
                    animate={{ scale: [1, 1.2, 1], opacity: [0, 0.8, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  />
                  <span className="relative z-10 flex items-center gap-2 tracking-widest text-sm font-medium">
                    开始匹配{" "}
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>

                <div className="mt-6 flex justify-center items-center gap-6 text-[10px] text-slate-500 font-mono tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-800" />{" "}
                    绝对隐秘
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-cyan-800" /> 量化推荐
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Question Cards */}
          {step >= 0 && step < questions.length && (
            <motion.div
              key={`q-${step}`}
              variants={pageVariants}
              initial="initial"
              animate="in"
              exit="out"
              className="w-full"
            >
              <div className="mb-8 flex justify-between items-center px-2">
                <span className="text-xs font-mono text-cyan-500/70 tracking-widest">
                  PHASE 0{step + 1}
                </span>
                <div className="flex gap-1">
                  {questions.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 rounded-full transition-all duration-500 ${i === step ? "w-6 bg-cyan-400" : i < step ? "w-2 bg-cyan-800" : "w-2 bg-white/10"}`}
                    />
                  ))}
                </div>
              </div>

              <div className="glass-panel rounded-3xl p-6 sm:p-8">
                <h2 className="text-xl font-medium text-white mb-2">
                  {questions[step].title}
                </h2>
                <p className="text-sm text-slate-400 mb-8">
                  {questions[step].subtitle}
                </p>

                <div className="space-y-3">
                  {questions[step].options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() =>
                        handleOptionSelect(
                          questions[step].field,
                          option.value,
                          option.tag,
                        )
                      }
                      className="w-full text-left glass-button rounded-2xl p-5 flex items-center gap-4 group"
                    >
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                        {idx === 0 ? (
                          <CircleDashed className="w-4 h-4 text-cyan-300" />
                        ) : idx === 1 ? (
                          <Hexagon className="w-4 h-4 text-indigo-300" />
                        ) : (
                          <Triangle className="w-4 h-4 text-purple-300" />
                        )}
                      </div>
                      <span className="text-sm text-slate-200 group-hover:text-white transition-colors">
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Loading State */}
          {step === questions.length && (
            <motion.div
              key="loading"
              variants={pageVariants}
              initial="initial"
              animate="in"
              exit="out"
              className="flex flex-col items-center justify-center py-12"
            >
              <div className="radar-container mb-12">
                <div className="radar-sweep"></div>
                <Orbit className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-cyan-500/50" />
              </div>

              <div className="text-center space-y-4 h-24">
                <p className="text-xs font-mono text-cyan-500/70 tracking-widest mb-4">
                  解析物理标签中...
                </p>
                {answers.tags.slice(0, 3).map((tag, i) => (
                  <motion.div
                    key={tag}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.8 }}
                    className="text-lg font-light text-white tag-flash"
                  >
                    {tag}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Result Page */}
          {step === questions.length + 1 && (
            <motion.div
              key="result"
              variants={pageVariants}
              initial="initial"
              animate="in"
              exit="out"
              className="w-full space-y-6"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-light text-white mb-2">
                  匹配完成
                </h2>
                <p className="text-sm text-slate-400">
                  基于你的探索偏好，我们找到了以下装备
                </p>
              </div>

              {topProducts.length > 0 ? (
                <div className="space-y-4">
                  {/* Top 1 Product */}
                  <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-cyan-950/20 backdrop-blur-xl p-1">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>
                    <div
                      className={`h-32 w-full rounded-2xl ${topProducts[0].imagePlaceholder} flex items-center justify-center mb-4`}
                    >
                      <Sparkles className="w-8 h-8 text-white/50" />
                    </div>
                    <div className="px-5 pb-5">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="inline-block px-2 py-1 rounded-md bg-cyan-500/20 text-cyan-300 text-[10px] font-mono mb-2">
                            算法最匹配 (TOP 1)
                          </span>
                          <h3 className="text-lg font-medium text-white">
                            {topProducts[0].name}
                          </h3>
                        </div>
                        <span className="text-lg font-semibold text-cyan-400">
                          ¥{topProducts[0].price}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-4">
                        <div className="flex items-center gap-1 text-xs text-slate-300 bg-white/5 px-2 py-1 rounded">
                          <VolumeX className="w-3 h-3" /> &lt;
                          {topProducts[0].maxDb}dB
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-300 bg-white/5 px-2 py-1 rounded">
                          <Droplets className="w-3 h-3" /> IPX
                          {topProducts[0].waterproof}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-300 bg-white/5 px-2 py-1 rounded">
                          <Zap className="w-3 h-3" />{" "}
                          {topProducts[0].motorType === "gentle"
                            ? "温柔"
                            : "强力"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top 2 & 3 Products */}
                  <div className="grid grid-cols-2 gap-4">
                    {topProducts.slice(1, 3).map((product, idx) => (
                      <div
                        key={product.id}
                        className="glass-panel rounded-2xl p-4 flex flex-col"
                      >
                        <div
                          className={`h-20 w-full rounded-xl ${product.imagePlaceholder} flex items-center justify-center mb-3`}
                        >
                          <Hexagon className="w-5 h-5 text-white/30" />
                        </div>
                        <span className="inline-block px-2 py-0.5 rounded bg-white/10 text-slate-300 text-[10px] w-fit mb-1">
                          {idx === 0 ? "最具性价比" : "探索备选"}
                        </span>
                        <h3 className="text-sm font-medium text-white mb-1 truncate">
                          {product.name}
                        </h3>
                        <span className="text-sm text-cyan-400 mt-auto">
                          ¥{product.price}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="glass-panel rounded-3xl p-8 text-center">
                  <p className="text-slate-300">
                    未找到完全匹配的装备，请尝试放宽条件。
                  </p>
                </div>
              )}

              <button
                onClick={resetQuiz}
                className="w-full py-4 mt-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors text-sm"
              >
                重新校准
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
