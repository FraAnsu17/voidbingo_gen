import { useState, useRef, useEffect, useCallback } from "react";
import JSZip from "jszip";

const DEFAULT_BG = "#FFE4E1";
const DEFAULT_FG = "#1a1a1a";
const DEFAULT_FONT_SIZE = 74;
const CANVAS_SIZE = 1080;

// Aspetta che tutti i font CSS (incluso DM Sans da Google Fonts in index.html)
// siano pronti anche per il Canvas
async function ensureFontLoaded() {
  await document.fonts.ready;
}

function drawSlideOnCanvas(ctx, text, bgColor, fgColor, fontSize, bold = false) {
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  if (!text.trim()) return;

  const fontStack = `"DM Sans", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif`;
  ctx.fillStyle = fgColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const padding = CANVAS_SIZE * 0.12;
  const maxWidth = CANVAS_SIZE - padding * 2;

  ctx.font = `${bold ? "700 " : ""}${fontSize}px ${fontStack}`;

  // Word wrap
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Auto-shrink se il testo è troppo lungo
  const lineHeight = fontSize * 1.2;
  const totalTextHeight = lines.length * lineHeight;
  const availableHeight = CANVAS_SIZE - padding * 2;
  let adjFontSize = fontSize;

  if (totalTextHeight > availableHeight) {
    adjFontSize = Math.floor(fontSize * (availableHeight / totalTextHeight));
    ctx.font = `${bold ? "700 " : ""}${adjFontSize}px ${fontStack}`;
  }

  const adjLineH = adjFontSize * 1.2;
  const totalH = lines.length * adjLineH;
  const startY = (CANVAS_SIZE - totalH) / 2 + adjLineH / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, CANVAS_SIZE / 2, startY + i * adjLineH);
  });
}

function SlidePreview({ text, bgColor, fgColor, fontSize, bold, fontSizeOverride, boldOverride, index, onDownload }) {
  const canvasRef = useRef(null);
  const effFs = fontSizeOverride ?? fontSize;
  const effBold = boldOverride ?? bold;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext("2d");

    drawSlideOnCanvas(ctx, text, bgColor, fgColor, effFs, effBold);
    document.fonts.ready.then(() => {
      drawSlideOnCanvas(ctx, text, bgColor, fgColor, effFs, effBold);
    });
  }, [text, bgColor, fgColor, effFs, effBold]);

  return (
    <div className="slide-preview-wrapper">
      <div className="slide-number">{index + 1}</div>
      <canvas ref={canvasRef} className="slide-canvas" />
      {onDownload && (
        <button
          className="slide-dl-btn"
          onClick={(e) => { e.stopPropagation(); onDownload(); }}
          title="Scarica questa slide"
        >↓</button>
      )}
    </div>
  );
}

function LightboxCanvas({ text, bgColor, fgColor, fontSize, bold, fontSizeOverride, boldOverride, onClick }) {
  const canvasRef = useRef(null);
  const effFs = fontSizeOverride ?? fontSize;
  const effBold = boldOverride ?? bold;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext("2d");
    drawSlideOnCanvas(ctx, text, bgColor, fgColor, effFs, effBold);
    document.fonts.ready.then(() => {
      drawSlideOnCanvas(ctx, text, bgColor, fgColor, effFs, effBold);
    });
  }, [text, bgColor, fgColor, effFs, effBold]);

  return (
    <canvas
      ref={canvasRef}
      className="lightbox-img"
      onClick={onClick}
    />
  );
}

export default function App() {
  const [slides, setSlides] = useState([{ id: 1, text: "" }]);
  const [bgColor, setBgColor] = useState(DEFAULT_BG);
  const [fgColor, setFgColor] = useState(DEFAULT_FG);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [bold, setBold] = useState(false);
  const [lightbox, setLightbox] = useState(null); // index of expanded slide
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(`Sei il ghostwriter di una pagina Instagram italiana gestita da una ragazza. Il tuo compito è generare 10 frasi per un carosello, nello stile esatto descritto qui sotto.

STILE E TONO:
- Voce narrante sempre femminile, in prima persona
- Ironia e sarcasmo sono il registro base, mai aggressività gratuita
- Autoironia frequente: la protagonista ride di sé stessa quanto degli altri
- Linguaggio colloquiale, diretto, a tratti volgare ma con intelligenza — la volgarità è puntuale, non ridondante
- Tono da amica che ti dice le cose in faccia, non da influencer
- Italiano parlato, non scritto: frasi brevi, ritmo spezzato, niente subordinate complesse

STRUTTURA DELLE FRASI:
- Brevi: idealmente 1-2 righe, massimo 20 parole
- Spesso hanno una struttura a sorpresa: setup banale → conclusione inaspettata
- Alcune funzionano per contrasto (es. "Vuole che cucini come sua madre, ma so solo bere come suo padre")
- Alcune per esagerazione comica (es. "Mal di schiena perché porto il peso di avere tette fantastiche")
- Alcune per understatement (es. "boh raga, come si va avanti?")
- Evita le frasi motivazionali, i consigli, le morale della storia

PRIMA FRASE — REGOLA SPECIALE:
La prima frase è la più importante: è quella che appare in anteprima nel feed e deve agganciare immediatamente. Deve essere:
- La più forte, originale o scioccante del set
- Costruita in modo che chi legge pensi automaticamente a qualcuno di specifico nella sua vita (es. "Ripenso a quell\'amica che...", oppure una situazione talmente riconoscibile che scatta il riflesso "questa sono io" o "questa è esattamente X") — la condivisione deve venire naturale, senza essere mai esplicitamente sollecitata
- Può fare riferimento a dinamiche relazionali universali: amicizie, ex, colleghi, famiglia

COSA EVITARE:
- Frasi già viste, citazioni famose, aforismi da calendario
- Anglicismi inutili
- Hashtag, emoji, punteggiatura eccessiva
- Tono vittimistico o lamentoso senza ironia
- Frasi lunghe o elaborate
- Moralismo di qualsiasi tipo

OUTPUT:
Rispondi SOLO con un array JSON di 10 stringhe. Nessun altro testo.`);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [status, setStatus] = useState("");
  const nextId = useRef(2);

  const addSlide = () => {
    if (slides.length >= 15) return;
    setSlides((prev) => [...prev, { id: nextId.current++, text: "", fontSizeOverride: null, boldOverride: null }]);
  };

  const removeSlide = (id) => {
    if (slides.length <= 1) return;
    setSlides((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSlide = (id, text) => {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
  };

  const updateSlideField = (id, field, value) => {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  // Genera i blob delle immagini
  const generateBlobs = async (filledSlides) => {
    await ensureFontLoaded();
    const blobs = [];
    for (let idx = 0; idx < filledSlides.length; idx++) {
      const slide = filledSlides[idx];
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext("2d");
      const sFs = slide.fontSizeOverride ?? fontSize;
      const sBold = slide.boldOverride ?? bold;
      drawSlideOnCanvas(ctx, slide.text, bgColor, fgColor, sFs, sBold);
      const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.95));
      blobs.push(blob);
    }
    return blobs;
  };

  const generateWithAI = useCallback(async () => {
    setIsGeneratingAI(true);
    setAiStatus("Gemini sta scrivendo...");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, systemPrompt }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { phrases } = await res.json();
      // Sostituisce le slide con le frasi generate (max 10)
      const newSlides = phrases.slice(0, 10).map((text, i) => ({
        id: nextId.current++,
        text,
        fontSizeOverride: null,
        boldOverride: null,
      }));
      setSlides(newSlides);
      setAiStatus(`✓ ${newSlides.length} frasi generate!`);
    } catch (err) {
      console.error(err);
      setAiStatus("Errore. Controlla la API key su Vercel.");
    } finally {
      setIsGeneratingAI(false);
      setTimeout(() => setAiStatus(""), 4000);
    }
  }, [aiPrompt]);

  const downloadSingle = useCallback(async (slide, idx) => {
    await ensureFontLoaded();
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext("2d");
    const sFs = slide.fontSizeOverride ?? fontSize;
    const sBold = slide.boldOverride ?? bold;
    drawSlideOnCanvas(ctx, slide.text, bgColor, fgColor, sFs, sBold);

    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.95));
    const file = new File([blob], `slide_${String(idx + 1).padStart(2, "0")}.jpg`, { type: "image/jpeg" });

    // Web Share su mobile se supportato
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }

    // Fallback: download diretto
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }, [bgColor, fgColor, fontSize, bold]);

  const generateAndDownload = useCallback(async () => {
    const filledSlides = slides.filter((s) => s.text.trim());
    if (filledSlides.length === 0) {
      setStatus("Aggiungi almeno una frase!");
      return;
    }

    setIsGenerating(true);
    setStatus("Generazione in corso...");

    try {
      const blobs = await generateBlobs(filledSlides);
      const files = blobs.map((blob, idx) => {
        const num = String(idx + 1).padStart(2, "0");
        return new File([blob], `slide_${num}.jpg`, { type: "image/jpeg" });
      });

      // Web Share API: su Safari iOS bisogna chiamare share() subito,
      // senza altri await tra la generazione e la chiamata
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const supportsFileShare = navigator.share && navigator.canShare && navigator.canShare({ files });

      if (supportsFileShare) {
        // Su iOS passiamo solo i file senza title/text per massima compatibilità
        const sharePayload = isIOS ? { files } : { files, title: "Carosello Instagram" };
        await navigator.share(sharePayload);
        setStatus(`✓ ${filledSlides.length} slide condivise!`);
        return;
      }

      // Fallback: ZIP per desktop o browser senza Web Share API
      const zip = new JSZip();
      blobs.forEach((blob, idx) => {
        const num = String(idx + 1).padStart(2, "0");
        zip.file(`slide_${num}.jpg`, blob);
      });
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "carosello_ig.zip";
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`✓ ${filledSlides.length} slide scaricate!`);

    } catch (err) {
      if (err.name === "AbortError") {
        setStatus("Condivisione annullata.");
      } else {
        console.error(err);
        setStatus("Errore durante la generazione. Riprova.");
      }
    } finally {
      setIsGenerating(false);
      setTimeout(() => setStatus(""), 4000);
    }
  }, [slides, bgColor, fgColor, fontSize, bold]);

  const filledCount = slides.filter((s) => s.text.trim()).length;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #0f0f0f;
          color: #f0f0f0;
          font-family: "DM Sans", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
          min-height: 100vh;
        }

        .app {
          max-width: 1400px;
          margin: 0 auto;
          padding: 40px 24px;
        }

        .header {
          text-align: center;
          margin-bottom: 48px;
        }

        .header h1 {
          font-size: clamp(28px, 5vw, 48px);
          font-weight: 700;
          letter-spacing: -1.5px;
          background: linear-gradient(135deg, #fff 0%, #888 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .header p {
          color: #666;
          margin-top: 8px;
          font-size: 15px;
        }

        .layout {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 32px;
          align-items: start;
        }

        @media (max-width: 900px) {
          .layout {
            grid-template-columns: 1fr;
            display: flex;
            flex-direction: column;
          }
          .controls {
            position: static !important;
            order: 1;
          }
          .preview-section {
            order: 2;
          }
        }

        .controls {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 20px;
          padding: 28px;
          position: sticky;
          top: 24px;
        }

        .preview-section {
          min-width: 0;
        }

        .section-title {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #555;
          margin-bottom: 16px;
        }

        .control-group { margin-bottom: 28px; }

        .color-row { display: flex; gap: 12px; }

        .color-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .color-label { font-size: 13px; color: #888; }

        .color-picker-wrapper {
          position: relative;
          height: 52px;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #333;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .color-picker-wrapper:hover { border-color: #555; }

        .color-picker-wrapper input[type="color"] {
          position: absolute;
          inset: -10px;
          width: calc(100% + 20px);
          height: calc(100% + 20px);
          border: none;
          cursor: pointer;
          opacity: 0;
        }

        .color-swatch {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          pointer-events: none;
        }

        .slider-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .slider-value {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          min-width: 42px;
          text-align: right;
          font-variant-numeric: tabular-nums;
        }

        input[type="range"] {
          -webkit-appearance: none;
          flex: 1;
          height: 4px;
          background: #333;
          border-radius: 2px;
          outline: none;
        }

        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          background: #fff;
          border-radius: 50%;
          cursor: pointer;
          transition: transform 0.15s;
        }

        input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.2); }

        .slides-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 340px;
          overflow-y: auto;
          padding-right: 4px;
          scrollbar-width: thin;
          scrollbar-color: #333 transparent;
        }

        .slide-input-row {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          animation: slideIn 0.2s ease;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .slide-num {
          width: 26px;
          height: 26px;
          background: #2a2a2a;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: #666;
          flex-shrink: 0;
          margin-top: 10px;
        }

        .slide-textarea {
          flex: 1;
          background: #111;
          border: 1px solid #2a2a2a;
          border-radius: 10px;
          color: #f0f0f0;
          font-family: "DM Sans", -apple-system, sans-serif;
          font-size: 13px;
          line-height: 1.5;
          padding: 10px 12px;
          resize: none;
          min-height: 44px;
          transition: border-color 0.2s;
          overflow: hidden;
        }

        .slide-textarea:focus { outline: none; border-color: #444; }
        .slide-textarea::placeholder { color: #444; }

        .remove-btn {
          width: 26px;
          height: 26px;
          background: transparent;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          color: #555;
          cursor: pointer;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 9px;
          transition: all 0.15s;
          line-height: 1;
        }

        .remove-btn:hover { background: #2a1515; border-color: #553333; color: #ff6b6b; }

        .add-btn {
          width: 100%;
          padding: 10px;
          background: transparent;
          border: 1px dashed #2a2a2a;
          border-radius: 10px;
          color: #555;
          font-family: "DM Sans", -apple-system, sans-serif;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 8px;
        }

        .add-btn:hover { border-color: #444; color: #888; background: #1a1a1a; }
        .add-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .download-btn {
          width: 100%;
          padding: 16px;
          background: #fff;
          color: #000;
          border: none;
          border-radius: 14px;
          font-family: "DM Sans", -apple-system, sans-serif;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 8px;
          letter-spacing: -0.3px;
        }

        .download-btn:hover { background: #e8e8e8; transform: translateY(-1px); }
        .download-btn:active { transform: translateY(0); }
        .download-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

        .status {
          text-align: center;
          font-size: 13px;
          color: #888;
          margin-top: 12px;
          min-height: 20px;
        }

        .status.success { color: #6bcb6b; }

        .preview-header {
          display: flex;
          align-items: baseline;
          gap: 12px;
          margin-bottom: 20px;
        }

        .preview-header h2 {
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #555;
        }

        .preview-count { font-size: 12px; color: #444; }

        .preview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 12px;
        }

        @media (max-width: 600px) {
          .preview-grid { grid-template-columns: repeat(2, 1fr); }
        }

        .slide-preview-wrapper {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          aspect-ratio: 1;
          border: 1px solid #2a2a2a;
          transition: transform 0.2s;
          cursor: zoom-in;
        }

        .slide-preview-wrapper:hover { transform: scale(1.02); }

        .slide-canvas { width: 100%; height: 100%; display: block; }

        .slide-number {
          position: absolute;
          top: 8px;
          left: 8px;
          background: rgba(0,0,0,0.5);
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          width: 22px;
          height: 22px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(4px);
        }

        .empty-preview {
          border: 1px dashed #222;
          border-radius: 12px;
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #333;
          font-size: 13px;
        }

        .divider { height: 1px; background: #2a2a2a; margin: 24px 0; }
        /* LIGHTBOX */
        .lightbox-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.92);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: zoom-out;
          animation: fadeIn 0.2s ease;
          padding: 24px;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .lightbox-img {
          max-width: min(90vw, 90vh);
          max-height: min(90vw, 90vh);
          width: auto;
          height: auto;
          border-radius: 16px;
          box-shadow: 0 32px 80px rgba(0,0,0,0.8);
          animation: scaleIn 0.2s ease;
          cursor: default;
        }

        @keyframes scaleIn {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .lightbox-close {
          position: fixed;
          top: 20px;
          right: 20px;
          width: 40px;
          height: 40px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 50%;
          color: #fff;
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
          z-index: 1001;
        }

        .lightbox-close:hover { background: rgba(255,255,255,0.2); }

        .lightbox-counter {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 20px;
          padding: 6px 16px;
          font-size: 13px;
          color: rgba(255,255,255,0.7);
          backdrop-filter: blur(8px);
        }

        .lightbox-nav {
          position: fixed;
          top: 50%;
          transform: translateY(-50%);
          width: 44px;
          height: 44px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 50%;
          color: #fff;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
          z-index: 1001;
        }

        .lightbox-nav:hover { background: rgba(255,255,255,0.25); }
        .lightbox-nav.prev { left: 16px; }
        .lightbox-nav.next { right: 16px; }

        .bold-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 14px;
          cursor: pointer;
          user-select: none;
        }

        .bold-row input[type="checkbox"] {
          appearance: none;
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border: 1.5px solid #444;
          border-radius: 6px;
          background: #111;
          cursor: pointer;
          position: relative;
          flex-shrink: 0;
          transition: all 0.15s;
        }

        .bold-row input[type="checkbox"]:checked {
          background: #fff;
          border-color: #fff;
        }

        .bold-row input[type="checkbox"]:checked::after {
          content: "";
          position: absolute;
          left: 5px;
          top: 2px;
          width: 5px;
          height: 9px;
          border: 2px solid #000;
          border-top: none;
          border-left: none;
          transform: rotate(45deg);
        }

        .bold-label {
          font-size: 14px;
          color: #aaa;
          font-weight: 400;
          transition: color 0.15s;
        }

        .bold-row:has(input:checked) .bold-label {
          color: #fff;
          font-weight: 700;
        }


        /* SYSTEM PROMPT */
        .sp-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: #555;
          font-family: "DM Sans", -apple-system, sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          cursor: pointer;
          padding: 0;
          margin-bottom: 12px;
          transition: color 0.15s;
          width: 100%;
          text-align: left;
          justify-content: space-between;
        }

        .sp-toggle:hover { color: #888; }

        .sp-toggle .sp-arrow {
          font-size: 10px;
          transition: transform 0.2s;
          display: inline-block;
        }

        .sp-toggle.open .sp-arrow { transform: rotate(180deg); }

        .sp-box {
          background: #0d0d0d;
          border: 1px solid #2a2a2a;
          border-radius: 10px;
          overflow: hidden;
          max-height: 0;
          transition: max-height 0.3s ease, opacity 0.2s;
          opacity: 0;
        }

        .sp-box.open {
          max-height: 300px;
          opacity: 1;
        }

        .sp-textarea {
          width: 100%;
          background: transparent;
          border: none;
          color: #c0c0c0;
          font-family: "DM Sans", -apple-system, sans-serif;
          font-size: 12px;
          line-height: 1.6;
          padding: 12px;
          resize: none;
          min-height: 100px;
        }

        .sp-textarea:focus { outline: none; }
        .sp-textarea::placeholder { color: #444; }

        .sp-hint {
          padding: 0 12px 10px;
          font-size: 11px;
          color: #444;
          line-height: 1.4;
        }


        /* PER-SLIDE OVERRIDES */
        .slide-overrides {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 5px;
          padding-left: 34px;
        }

        .override-btn {
          background: none;
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          color: #555;
          font-family: "DM Sans", -apple-system, sans-serif;
          font-size: 11px;
          padding: 3px 7px;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .override-btn:hover { border-color: #444; color: #888; }
        .override-btn.active { border-color: #fff; color: #fff; background: #1f1f1f; }

        .override-fs-input {
          width: 44px;
          background: #111;
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          color: #fff;
          font-family: "DM Sans", -apple-system, sans-serif;
          font-size: 12px;
          font-weight: 700;
          padding: 3px 6px;
          text-align: center;
          -moz-appearance: textfield;
        }

        .override-fs-input::-webkit-inner-spin-button,
        .override-fs-input::-webkit-outer-spin-button { -webkit-appearance: none; }
        .override-fs-input:focus { outline: none; border-color: #555; }

        .override-reset {
          background: none;
          border: none;
          color: #333;
          cursor: pointer;
          font-size: 14px;
          padding: 0 2px;
          line-height: 1;
          transition: color 0.15s;
        }

        .override-reset:hover { color: #ff6b6b; }


        /* SINGLE DOWNLOAD BUTTON ON PREVIEW */
        .slide-preview-wrapper {
          position: relative;
        }

        .slide-dl-btn {
          position: absolute;
          bottom: 8px;
          right: 8px;
          width: 30px;
          height: 30px;
          background: rgba(0,0,0,0.55);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(6px);
          opacity: 0;
          transition: opacity 0.15s, background 0.15s;
          z-index: 2;
        }

        .slide-preview-wrapper:hover .slide-dl-btn { opacity: 1; }
        .slide-dl-btn:hover { background: rgba(0,0,0,0.8); }

        @media (max-width: 900px) {
          .slide-dl-btn { opacity: 1; }
        }

        /* AI SECTION */
        .ai-section {
          margin-bottom: 0;
        }

        .ai-input-row {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }

        .ai-textarea {
          flex: 1;
          background: #111;
          border: 1px solid #2a2a2a;
          border-radius: 10px;
          color: #f0f0f0;
          font-family: "DM Sans", -apple-system, sans-serif;
          font-size: 13px;
          line-height: 1.5;
          padding: 10px 12px;
          resize: none;
          min-height: 44px;
          transition: border-color 0.2s;
        }

        .ai-textarea:focus { outline: none; border-color: #444; }
        .ai-textarea::placeholder { color: #444; }

        .ai-btn {
          padding: 10px 16px;
          background: linear-gradient(135deg, #4f8ef7, #7c5cbf);
          color: #fff;
          border: none;
          border-radius: 10px;
          font-family: "DM Sans", -apple-system, sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity 0.2s, transform 0.15s;
          flex-shrink: 0;
        }

        .ai-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .ai-btn:active { transform: translateY(0); }
        .ai-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

        .ai-status {
          font-size: 12px;
          color: #666;
          margin-top: 8px;
          min-height: 18px;
          text-align: center;
        }

        .ai-status.success { color: #6bcb6b; }

      `}</style>

      <div className="app">
        <div className="header">
          <h1>Carousel Generator</h1>
          <p>Crea le slide del tuo carosello Instagram in un click</p>
        </div>

        <div className="layout">
          <div className="controls">
            <div className="control-group">
              <div className="section-title">Colori</div>
              <div className="color-row">
                <div className="color-item">
                  <span className="color-label">Sfondo</span>
                  <div className="color-picker-wrapper" style={{ background: bgColor }}>
                    <div className="color-swatch" style={{ color: fgColor }}>{bgColor.toUpperCase()}</div>
                    <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
                  </div>
                </div>
                <div className="color-item">
                  <span className="color-label">Testo</span>
                  <div className="color-picker-wrapper" style={{ background: fgColor }}>
                    <div className="color-swatch" style={{ color: bgColor }}>{fgColor.toUpperCase()}</div>
                    <input type="color" value={fgColor} onChange={(e) => setFgColor(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="divider" />

            <div className="control-group">
              <div className="section-title">Dimensione font</div>
              <div className="slider-row">
                <input
                  type="range"
                  min={24}
                  max={120}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                />
                <span className="slider-value">{fontSize}</span>
              </div>
              <label className="bold-row">
                <input
                  type="checkbox"
                  checked={bold}
                  onChange={(e) => setBold(e.target.checked)}
                />
                <span className="bold-label">Grassetto</span>
              </label>
            </div>

            <div className="divider" />

            <div className="control-group ai-section">
              <div className="section-title">✦ Genera con AI</div>

              {/* System prompt collapsible */}
              <button
                className={`sp-toggle ${showSystemPrompt ? "open" : ""}`}
                onClick={() => setShowSystemPrompt((v) => !v)}
              >
                <span>System prompt</span>
                <span className="sp-arrow">▼</span>
              </button>
              <div className={`sp-box ${showSystemPrompt ? "open" : ""}`}>
                <textarea
                  className="sp-textarea"
                  placeholder="Definisci stile, tono e formato delle frasi..."
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                />
                <div className="sp-hint">
                  Queste istruzioni vengono inviate a Gemini ad ogni generazione.
                  Il campo "tema" qui sotto aggiunge il contesto specifico.
                </div>
              </div>

              {/* Prompt + generate button */}
              <div className="ai-input-row" style={{marginTop: "12px"}}>
                <textarea
                  className="ai-textarea"
                  placeholder="Tema o contesto opzionale... (es. lunedì mattina)"
                  value={aiPrompt}
                  rows={2}
                  onChange={(e) => {
                    setAiPrompt(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = e.target.scrollHeight + "px";
                  }}
                />
                <button
                  className="ai-btn"
                  onClick={generateWithAI}
                  disabled={isGeneratingAI}
                >
                  {isGeneratingAI ? "..." : "Genera"}
                </button>
              </div>
              {aiStatus && (
                <div className={`ai-status ${aiStatus.startsWith("✓") ? "success" : ""}`}>
                  {aiStatus}
                </div>
              )}
            </div>

            <div className="divider" />

            <div className="control-group">
              <div className="section-title">Frasi ({slides.length}/15)</div>
              <div className="slides-list">
                {slides.map((slide, idx) => (
                  <div key={slide.id}>
                    <div className="slide-input-row">
                      <div className="slide-num">{idx + 1}</div>
                      <textarea
                        className="slide-textarea"
                        placeholder={`Frase ${idx + 1}...`}
                        value={slide.text}
                        rows={2}
                        onChange={(e) => {
                          updateSlide(slide.id, e.target.value);
                          e.target.style.height = "auto";
                          e.target.style.height = e.target.scrollHeight + "px";
                        }}
                      />
                      <button className="remove-btn" onClick={() => removeSlide(slide.id)} title="Rimuovi">×</button>
                    </div>
                    <div className="slide-overrides">
                      <span style={{fontSize:"10px",color:"#444",letterSpacing:"1px",textTransform:"uppercase"}}>Override:</span>
                      <input
                        className="override-fs-input"
                        type="number"
                        min={12}
                        max={150}
                        placeholder={String(fontSize)}
                        value={slide.fontSizeOverride ?? ""}
                        onChange={(e) => updateSlideField(slide.id, "fontSizeOverride", e.target.value ? Number(e.target.value) : null)}
                        title="Font size per questa slide"
                      />
                      <button
                        className={`override-btn ${slide.boldOverride === true ? "active" : slide.boldOverride === false ? "active" : ""}`}
                        onClick={() => {
                          if (slide.boldOverride === null || slide.boldOverride === undefined) {
                            updateSlideField(slide.id, "boldOverride", !bold);
                          } else {
                            updateSlideField(slide.id, "boldOverride", null);
                          }
                        }}
                        title={slide.boldOverride !== null && slide.boldOverride !== undefined ? "Rimuovi override grassetto" : "Imposta override grassetto"}
                      >
                        {slide.boldOverride !== null && slide.boldOverride !== undefined
                          ? slide.boldOverride ? "B ✓" : "B ✗"
                          : "B"}
                      </button>
                      {(slide.fontSizeOverride !== null || (slide.boldOverride !== null && slide.boldOverride !== undefined)) && (
                        <button
                          className="override-reset"
                          onClick={() => {
                            updateSlideField(slide.id, "fontSizeOverride", null);
                            updateSlideField(slide.id, "boldOverride", null);
                          }}
                          title="Rimuovi tutti gli override"
                        >↺</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button className="add-btn" onClick={addSlide} disabled={slides.length >= 15}>
                + Aggiungi frase
              </button>
            </div>

            <div className="divider" />

            <button
              className="download-btn"
              onClick={generateAndDownload}
              disabled={isGenerating || filledCount === 0}
            >
              {isGenerating
                ? "Generazione..."
                : navigator.share
                  ? `↑ Condividi ${filledCount > 0 ? filledCount : ""} slide`
                  : `↓ Scarica ${filledCount > 0 ? filledCount : ""} slide`
              }
            </button>
            <div className={`status ${status.startsWith("✓") ? "success" : ""}`}>{status}</div>
          </div>

          <div>
            <div className="preview-header">
              <h2>Anteprima</h2>
              <span className="preview-count">Aggiornamento in tempo reale</span>
            </div>
            <div className="preview-grid">
              {(() => {
                let filledIdx = -1;
                return slides.map((slide, idx) => {
                  if (slide.text.trim()) filledIdx++;
                  const fi = filledIdx;
                  return slide.text.trim() ? (
                  <div key={slide.id} onClick={() => setLightbox(fi)} style={{cursor:"zoom-in"}}>
                  <SlidePreview
                    key={`${slide.id}-${bgColor}-${fgColor}-${fontSize}-${slide.fontSizeOverride}-${slide.boldOverride}`}
                    text={slide.text}
                    bgColor={bgColor}
                    fgColor={fgColor}
                    fontSize={fontSize}
                    bold={bold}
                    fontSizeOverride={slide.fontSizeOverride}
                    boldOverride={slide.boldOverride}
                    index={fi}
                    onDownload={() => downloadSingle(slide, fi)}
                  />
                  </div>
                ) : (
                  <div key={slide.id} className="empty-preview">{idx + 1}</div>
                );
                });
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* LIGHTBOX */}
      {lightbox !== null && (() => {
        const filledSlides = slides.filter((s) => s.text.trim());
        const total = filledSlides.length;
        if (total === 0) return null;
        const idx = Math.min(lightbox, total - 1);
        const slide = filledSlides[idx];
        // Get canvas dataURL for lightbox display
        return (
          <div
            className="lightbox-overlay"
            onClick={() => setLightbox(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setLightbox(null);
              if (e.key === "ArrowRight") setLightbox((i) => Math.min(i + 1, total - 1));
              if (e.key === "ArrowLeft") setLightbox((i) => Math.max(i - 1, 0));
            }}
            tabIndex={0}
            ref={(el) => el && el.focus()}
          >
            <button className="lightbox-close" onClick={(e) => { e.stopPropagation(); setLightbox(null); }}>×</button>
            {idx > 0 && (
              <button className="lightbox-nav prev" onClick={(e) => { e.stopPropagation(); setLightbox(idx - 1); }}>‹</button>
            )}
            <LightboxCanvas
              text={slide.text}
              bgColor={bgColor}
              fgColor={fgColor}
              fontSize={fontSize}
              bold={bold}
              fontSizeOverride={slide.fontSizeOverride}
              boldOverride={slide.boldOverride}
              onClick={(e) => e.stopPropagation()}
            />
            {idx < total - 1 && (
              <button className="lightbox-nav next" onClick={(e) => { e.stopPropagation(); setLightbox(idx + 1); }}>›</button>
            )}
            <div className="lightbox-counter">{idx + 1} / {total}</div>
          </div>
        );
      })()}
    </>
  );
}