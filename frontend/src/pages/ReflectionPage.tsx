import { motion } from "framer-motion";
import { Brain, Flower2, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "../lib/api";
import type {
  ReflectionPrompt,
  ReflectionQuestion,
  ReflectionQuote,
  ReflectionVideo,
} from "../lib/types";

const EASE = [0.22, 1, 0.36, 1] as const;
const reveal = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, ease: EASE },
};

const FALLBACK_QUOTES: ReflectionQuote[] = [
  {
    id: 1,
    text: "The soul becomes dyed with the color of its thoughts.",
    author: "Marcus Aurelius",
  },
  {
    id: 2,
    text: "How we spend our days is, of course, how we spend our lives.",
    author: "Annie Dillard",
  },
  {
    id: 3,
    text: "There is nothing noble in being superior to your fellow man; true nobility is being superior to your former self.",
    author: "Ernest Hemingway",
  },
  {
    id: 4,
    text: "Between stimulus and response there is a space. In that space is our power to choose our response.",
    author: "Viktor Frankl",
  },
];

const FALLBACK_PROMPTS: ReflectionPrompt[] = [
  {
    id: 1,
    text: "Take five slow breaths. On each exhale, unclench one thing you are carrying.",
  },
  {
    id: 2,
    text: "What are you making heavier in your mind than it needs to be right now?",
  },
  {
    id: 3,
    text: "If today only needed one good decision, what would it be?",
  },
  {
    id: 4,
    text: "Notice your body first. Where is the tension, and what would soften it by 5%?",
  },
];

const FALLBACK_QUESTIONS: ReflectionQuestion[] = [
  {
    id: 1,
    text: "What do you want more of in your life that your current schedule does not actually protect?",
  },
  {
    id: 2,
    text: "Are you chasing clarity, or are you avoiding commitment by waiting for perfect clarity?",
  },
  {
    id: 3,
    text: "What would your future self thank you for doing repeatedly, even when it feels small?",
  },
  {
    id: 4,
    text: "Which belief about yourself are you still acting from that may no longer be true?",
  },
];

const FALLBACK_VIDEOS: ReflectionVideo[] = [
  {
    id: 1,
    title: "Flower",
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  },
  {
    id: 2,
    title: "Rain",
    url: "https://www.w3schools.com/howto/rain.mp4",
  },
];

const LEGACY_PROMPTS = [
  "Take five slow breaths. On each exhale, unclench one thing you are carrying.",
  "What are you making heavier in your mind than it needs to be right now?",
  "If today only needed one good decision, what would it be?",
  "Notice your body first. Where is the tension, and what would soften it by 5%?",
];

const GRATITUDE_KEY = "personal-reflection-gratitude";
const REFLECTION_KEY = "personal-reflection-journal";

export function ReflectionPage() {
  const [quotes, setQuotes] = useState<ReflectionQuote[]>(FALLBACK_QUOTES);
  const [prompts, setPrompts] = useState<ReflectionPrompt[]>(FALLBACK_PROMPTS);
  const [questions, setQuestions] = useState<ReflectionQuestion[]>(FALLBACK_QUESTIONS);
  const [videos, setVideos] = useState<ReflectionVideo[]>(FALLBACK_VIDEOS);
  const [quoteIndex, setQuoteIndex] = useState(() => getDailySeed() % FALLBACK_QUOTES.length);
  const [promptIndex, setPromptIndex] = useState(() => getPromptSeed() % FALLBACK_PROMPTS.length);
  const [questionIndex, setQuestionIndex] = useState(() => getQuestionSeed() % FALLBACK_QUESTIONS.length);
  const [videoIndex, setVideoIndex] = useState(() => getPromptSeed() % FALLBACK_VIDEOS.length);
  const [gratitude, setGratitude] = useState(() => getStoredValue(GRATITUDE_KEY));
  const [reflection, setReflection] = useState(() => getStoredValue(REFLECTION_KEY));

  useEffect(() => {
    let isActive = true;

    api
      .getReflection()
      .then((payload) => {
        if (!isActive) {
          return;
        }

        const nextQuotes = payload.quotes.length > 0 ? payload.quotes : FALLBACK_QUOTES;
        const nextPrompts = payload.prompts.length > 0 ? payload.prompts : FALLBACK_PROMPTS;
        const nextQuestions = payload.questions.length > 0 ? payload.questions : FALLBACK_QUESTIONS;
        const nextVideos = payload.videos.length > 0 ? payload.videos : FALLBACK_VIDEOS;

        setQuotes(nextQuotes);
        setPrompts(nextPrompts);
        setQuestions(nextQuestions);
        setVideos(nextVideos);
        setQuoteIndex(getDailySeed() % nextQuotes.length);
        setPromptIndex(getPromptSeed() % nextPrompts.length);
        setQuestionIndex(getQuestionSeed() % nextQuestions.length);
        setVideoIndex(getPromptSeed() % nextVideos.length);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }
        setPrompts(
          FALLBACK_PROMPTS.length > 0
            ? FALLBACK_PROMPTS
            : LEGACY_PROMPTS.map((text, index) => ({ id: index + 1, text })),
        );
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(GRATITUDE_KEY, gratitude);
  }, [gratitude]);

  useEffect(() => {
    window.localStorage.setItem(REFLECTION_KEY, reflection);
  }, [reflection]);

  const quote = quotes[quoteIndex] ?? FALLBACK_QUOTES[0];
  const prompt = prompts[promptIndex] ?? FALLBACK_PROMPTS[0];
  const thoughtQuestion = questions[questionIndex] ?? FALLBACK_QUESTIONS[0];
  const video = videos[videoIndex] ?? FALLBACK_VIDEOS[0];

  function cycleQuote() {
    setQuoteIndex((current) => nextIndex(current, quotes.length));
  }

  function cyclePrompt() {
    setPromptIndex((current) => nextIndex(current, prompts.length));
    setVideoIndex((current) => nextIndex(current, videos.length));
  }

  function cycleQuestion() {
    setQuestionIndex((current) => nextIndex(current, questions.length));
  }

  return (
    <section className="page reflection-page">
      <motion.div className="page-heading" {...reveal}>
        <div>
          <h2 className="hero-title">Reflection</h2>
        </div>
      </motion.div>

      <motion.section className="reflection-quote-banner" {...reveal}>
        <div className="reflection-quote-banner-top">
          <span />
          <button className="icon-button" onClick={cycleQuote} aria-label="Rotate quote">
            <RefreshCw size={16} />
          </button>
        </div>
        <motion.div
          key={quote.id}
          className="reflection-quote-banner-copy"
          initial={{
            opacity: 0.2,
            filter: "blur(12px)",
            clipPath: "inset(0 100% 0 0)",
          }}
          animate={{
            opacity: 1,
            filter: "blur(0px)",
            clipPath: "inset(0 0% 0 0)",
          }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <blockquote>{quote.text}</blockquote>
          <small>{quote.author}</small>
        </motion.div>
      </motion.section>

      <motion.section className="reflection-video-stage" {...reveal}>
        <video
          key={video.id}
          className="reflection-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          src={video.url}
        />
        <div className="reflection-video-overlay" />
        <div className="reflection-video-top">
          <span />
          <button className="icon-button" onClick={cyclePrompt} aria-label="Rotate prompt">
            <Flower2 size={16} />
          </button>
        </div>
        <motion.div
          className="reflection-video-copy"
          initial={{ opacity: 0, y: 36 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.45 }}
          transition={{ duration: 0.65, ease: EASE }}
        >
          <p>{prompt.text}</p>
        </motion.div>
      </motion.section>

      <div className="content-grid reflection-grid">
        <motion.section className="surface-card reflection-equal-card" {...reveal}>
          <div className="surface-header">
            <div>
              <h3>Gratitude</h3>
            </div>
            <Sparkles size={16} />
          </div>
          <label className="reflection-field reflection-grow-field">
            <textarea
              className="field-textarea reflection-grow-textarea"
              value={gratitude}
              onChange={(event) => setGratitude(event.target.value)}
              placeholder="What felt unexpectedly good today?"
            />
          </label>
        </motion.section>

        <motion.section className="surface-card reflection-equal-card" {...reveal}>
          <div className="surface-header">
            <div>
              <h3>Thought question</h3>
            </div>
            <button className="icon-button" onClick={cycleQuestion} aria-label="Rotate thought question">
              <Brain size={16} />
            </button>
          </div>
          <p className="reflection-thought-copy">{thoughtQuestion.text}</p>
          <label className="reflection-field reflection-followup-field reflection-grow-field">
            <textarea
              className="field-textarea reflection-grow-textarea"
              value={reflection}
              onChange={(event) => setReflection(event.target.value)}
              placeholder="Write the thought you want to keep, not the whole spiral."
            />
          </label>
        </motion.section>
      </div>
    </section>
  );
}

function getStoredValue(key: string) {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(key) ?? "";
}

function getDailySeed() {
  return new Date().getDate();
}

function getPromptSeed() {
  const now = new Date();
  return now.getDate() + now.getHours();
}

function getQuestionSeed() {
  const now = new Date();
  return now.getDate() + now.getHours() + now.getMinutes();
}

function nextIndex(current: number, length: number) {
  if (length <= 0) {
    return 0;
  }
  return (current + 1) % length;
}
