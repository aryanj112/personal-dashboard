import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, FileCode2 } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";

import { api } from "../lib/api";

const EASE = [0.22, 1, 0.36, 1] as const;
const reveal = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, ease: EASE },
};

const RESUME_STORAGE_KEY = "personal-resume-documents";
const RESUME_SELECTED_STORAGE_KEY = "personal-resume-selected";
const RESUME_SIDEBAR_STORAGE_KEY = "personal-resume-sidebar-collapsed";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

type ResumeDocument = {
  id: string;
  name: string;
  source: string;
};

type PreviewStatus = "idle" | "rendering" | "ready" | "error";

const DEFAULT_RESUMES: ResumeDocument[] = [
  {
    id: "main",
    name: "Main",
    source: String.raw`\documentclass[11pt]{article}
\usepackage[margin=0.75in]{geometry}
\usepackage[hidelinks]{hyperref}
\usepackage{enumitem}
\pagenumbering{gobble}
\setlength{\parindent}{0pt}
\setlist[itemize]{topsep=2pt,itemsep=2pt,leftmargin=1.2em}

\begin{document}

\begin{center}
    {\LARGE Your Name} \\
    City, ST \quad|\quad email@example.com \quad|\quad (555) 555-5555 \\
    \href{https://linkedin.com/in/your-profile}{linkedin.com/in/your-profile}
\end{center}

\section*{Experience}
\textbf{Company Name} \hfill City, ST \\
Role Title \hfill May 2025 -- Aug 2025
\begin{itemize}
    \item Add a resume bullet here.
    \item Add another impact-focused bullet here.
\end{itemize}

\section*{Projects}
\textbf{Project Name}
\begin{itemize}
    \item Add a project bullet with the stack and the result.
\end{itemize}

\section*{Education}
\textbf{University Name} \hfill Graduation Date \\
Degree, relevant details

\end{document}
`,
  },
];

export function ResumePage() {
  const [resumes, setResumes] = useState<ResumeDocument[]>(() => getStoredResumes());
  const [selectedResumeId, setSelectedResumeId] = useState<string>(() =>
    getStoredValue(RESUME_SELECTED_STORAGE_KEY, DEFAULT_RESUMES[0].id),
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    getStoredBoolean(RESUME_SIDEBAR_STORAGE_KEY, false),
  );
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [hasEditorSelection, setHasEditorSelection] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewShellRef = useRef<HTMLDivElement | null>(null);
  const editorTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editorHighlightRef = useRef<HTMLPreElement | null>(null);

  const activeResume = useMemo(
    () => resumes.find((resume) => resume.id === selectedResumeId) ?? resumes[0] ?? null,
    [resumes, selectedResumeId],
  );
  const deferredSource = useDeferredValue(activeResume?.source ?? "");
  const highlightedSource = useMemo(() => highlightLatex(activeResume?.source ?? ""), [activeResume?.source]);

  useEffect(() => {
    const frame = document.querySelector(".page-frame");
    frame?.classList.add("page-frame-resume");
    return () => {
      frame?.classList.remove("page-frame-resume");
    };
  }, []);

  useEffect(() => {
    if (resumes.length === 0) {
      setResumes(DEFAULT_RESUMES);
      setSelectedResumeId(DEFAULT_RESUMES[0].id);
      return;
    }
    if (!resumes.some((resume) => resume.id === selectedResumeId)) {
      setSelectedResumeId(resumes[0].id);
    }
  }, [resumes, selectedResumeId]);

  useEffect(() => {
    window.localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(resumes));
  }, [resumes]);

  useEffect(() => {
    window.localStorage.setItem(RESUME_SELECTED_STORAGE_KEY, selectedResumeId);
  }, [selectedResumeId]);

  useEffect(() => {
    window.localStorage.setItem(RESUME_SIDEBAR_STORAGE_KEY, JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!activeResume || !deferredSource.trim()) {
      setPreviewStatus("idle");
      setPreviewError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPreviewStatus("rendering");
      setPreviewError(null);

      api
        .compileResumePdf(activeResume.name, deferredSource, controller.signal)
        .then((blob) => {
          setPreviewBlob(blob);
          setPreviewStatus("ready");
        })
        .catch((caught) => {
          if (caught instanceof DOMException && caught.name === "AbortError") {
            return;
          }
          setPreviewStatus("error");
          setPreviewError(caught instanceof Error ? caught.message : "Could not render the PDF.");
        });
    }, 550);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeResume?.name, deferredSource]);

  useEffect(() => {
    if (!previewBlob || !previewCanvasRef.current || !previewShellRef.current) {
      return;
    }

    let cancelled = false;

    async function renderPreview() {
      const canvas = previewCanvasRef.current;
      const shell = previewShellRef.current;
      const blob = previewBlob;
      if (!canvas || !shell || !blob) {
        return;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      try {
        const data = new Uint8Array(await blob.arrayBuffer());
        const loadingTask = getDocument({ data });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        if (cancelled) {
          await pdf.destroy();
          return;
        }

        const shellWidth = Math.max(shell.clientWidth - 24, 320);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = shellWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const deviceScale = window.devicePixelRatio || 1;

        canvas.width = Math.floor(viewport.width * deviceScale);
        canvas.height = Math.floor(viewport.height * deviceScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
        context.clearRect(0, 0, viewport.width, viewport.height);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        await pdf.destroy();
      } catch (caught) {
        if (!cancelled) {
          setPreviewStatus("error");
          setPreviewError(caught instanceof Error ? caught.message : "Could not render the PDF preview.");
        }
      }
    }

    void renderPreview();

    return () => {
      cancelled = true;
    };
  }, [previewBlob]);

  function updateActiveResumeSource(nextSource: string) {
    if (!activeResume) {
      return;
    }
    setResumes((current) =>
      current.map((resume) =>
        resume.id === activeResume.id
          ? {
              ...resume,
              source: nextSource,
            }
          : resume,
      ),
    );
  }

  function syncEditorScroll() {
    const textarea = editorTextareaRef.current;
    const highlight = editorHighlightRef.current;
    if (!textarea || !highlight) {
      return;
    }
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
  }

  function syncEditorSelection() {
    const textarea = editorTextareaRef.current;
    if (!textarea) {
      return;
    }
    setHasEditorSelection(textarea.selectionStart !== textarea.selectionEnd);
  }

  async function exportPdf() {
    if (!activeResume) {
      return;
    }

    setExporting(true);
    try {
      const blob = await api.compileResumePdf(activeResume.name, activeResume.source);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${slugifyResumeName(activeResume.name)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      setPreviewError(null);
    } catch (caught) {
      setPreviewError(caught instanceof Error ? caught.message : "Could not export the PDF.");
      setPreviewStatus("error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="page resume-page">
      <div className="page-heading resume-page-heading">
        <div>
          <h2>Resume tailoring</h2>
        </div>
        <div className="resume-top-actions">
          <span className={`resume-status-chip is-${previewStatus}`}>{getPreviewLabel(previewStatus)}</span>
          <button className="primary-button" onClick={() => void exportPdf()} disabled={!activeResume || exporting}>
            <Download size={16} />
            <span>{exporting ? "Exporting..." : "Export PDF"}</span>
          </button>
        </div>
      </div>

      {previewError ? <div className="resume-error-banner">{previewError}</div> : null}

      <div className={`resume-workspace ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
        <motion.aside className={`surface-card resume-sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`} {...reveal}>
          <div className="surface-header resume-panel-header">
            {!sidebarCollapsed ? <h3>Resumes</h3> : <span className="sr-only">Resume list</span>}
            <button
              type="button"
              className="secondary-button resume-sidebar-toggle"
              onClick={() => setSidebarCollapsed((current) => !current)}
              aria-label={sidebarCollapsed ? "Expand resume list" : "Collapse resume list"}
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          <div className="resume-sidebar-list" role="tablist" aria-label="Resume list">
            {resumes.map((resume) => {
              const active = activeResume?.id === resume.id;
              return (
                <button
                  key={resume.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`resume-sidebar-item ${active ? "is-active" : ""}`}
                  onClick={() => setSelectedResumeId(resume.id)}
                  title={sidebarCollapsed ? resume.name : undefined}
                >
                  <span className="resume-sidebar-item-mark">
                    <FileCode2 size={15} />
                  </span>
                  {!sidebarCollapsed ? (
                    <span className="resume-sidebar-item-text">
                      <strong>{resume.name}</strong>
                      <span>LaTeX draft</span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </motion.aside>

        <motion.section className="surface-card resume-editor-panel" {...reveal}>
          <div className="resume-editor-shell">
            <pre
              ref={editorHighlightRef}
              className={`resume-code-highlight ${hasEditorSelection ? "is-muted-for-selection" : ""}`}
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: highlightedSource }}
            />
            <textarea
              ref={editorTextareaRef}
              className={`resume-code-editor ${hasEditorSelection ? "is-showing-selection" : ""}`}
              spellCheck={false}
              value={activeResume?.source ?? ""}
              onChange={(event) => updateActiveResumeSource(event.target.value)}
              onScroll={syncEditorScroll}
              onSelect={syncEditorSelection}
              onKeyUp={syncEditorSelection}
              onMouseUp={syncEditorSelection}
              onBlur={() => setHasEditorSelection(false)}
              aria-label="Resume LaTeX source"
            />
          </div>
        </motion.section>

        <motion.section className="resume-preview-panel" {...reveal}>
          <div className="resume-preview-shell">
            {previewBlob ? (
              <div className="resume-preview-canvas-shell" ref={previewShellRef}>
                <canvas className="resume-preview-canvas" ref={previewCanvasRef} aria-label="Rendered resume preview" />
              </div>
            ) : previewStatus === "rendering" ? (
              <div className="empty-state resume-preview-empty">
                <h4>Rendering preview</h4>
                <p>Compiling your LaTeX into a PDF.</p>
              </div>
            ) : previewError ? (
              <div className="empty-state resume-preview-empty error-state">
                <h4>Compile issue</h4>
                <pre className="resume-compile-error">{previewError}</pre>
              </div>
            ) : (
              <div className="empty-state resume-preview-empty">
                <h4>Preview ready when you are</h4>
                <p>Your selected resume stays open here as you edit the source.</p>
              </div>
            )}
          </div>
        </motion.section>
      </div>
    </section>
  );
}

function getStoredResumes(): ResumeDocument[] {
  if (typeof window === "undefined") {
    return DEFAULT_RESUMES;
  }
  const stored = window.localStorage.getItem(RESUME_STORAGE_KEY);
  if (!stored) {
    return DEFAULT_RESUMES;
  }
  try {
    const parsed = JSON.parse(stored) as ResumeDocument[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_RESUMES;
    }
    const sanitized = parsed.filter(
      (entry) =>
        typeof entry?.id === "string" &&
        typeof entry?.name === "string" &&
        typeof entry?.source === "string" &&
        entry.id.trim() &&
        entry.name.trim(),
    );
    return sanitized.length > 0 ? sanitized : DEFAULT_RESUMES;
  } catch {
    return DEFAULT_RESUMES;
  }
}

function getStoredValue(storageKey: string, fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }
  return window.localStorage.getItem(storageKey) || fallback;
}

function getStoredBoolean(storageKey: string, fallback: boolean): boolean {
  if (typeof window === "undefined") {
    return fallback;
  }
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) {
    return fallback;
  }
  try {
    return JSON.parse(stored) as boolean;
  } catch {
    return fallback;
  }
}

function getPreviewLabel(status: PreviewStatus): string {
  if (status === "rendering") {
    return "Rendering";
  }
  if (status === "ready") {
    return "Ready";
  }
  if (status === "error") {
    return "Compile issue";
  }
  return "Idle";
}

function slugifyResumeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "resume";
}

function highlightLatex(source: string): string {
  const escaped = escapeHtml(source);
  const tokenPattern = /(%[^\n]*|\\[a-zA-Z@]+|\\.|[{}[\]])/g;

  return escaped.replace(tokenPattern, (token) => {
    if (token.startsWith("%")) {
      return `<span class="resume-token-comment">${token}</span>`;
    }
    if (token.startsWith("\\")) {
      return `<span class="resume-token-command">${token}</span>`;
    }
    return `<span class="resume-token-brace">${token}</span>`;
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
