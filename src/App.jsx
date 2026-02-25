import { useState, useRef, useEffect, useCallback } from "react";
import JSZip from "jszip";

const DEFAULT_BG = "#FFE4E1";
const DEFAULT_FG = "#1a1a1a";
const DEFAULT_FONT_SIZE = 48;
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
  const lineHeight = fontSize * 1.5;
  const totalTextHeight = lines.length * lineHeight;
  const availableHeight = CANVAS_SIZE - padding * 2;
  let adjFontSize = fontSize;

  if (totalTextHeight > availableHeight) {
    adjFontSize = Math.floor(fontSize * (availableHeight / totalTextHeight));
    ctx.font = `${bold ? "700 " : ""}${adjFontSize}px ${fontStack}`;
  }

  const adjLineH = adjFontSize * 1.5;
  const totalH = lines.length * adjLineH;
  const startY = (CANVAS_SIZE - totalH) / 2 + adjLineH / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, CANVAS_SIZE / 2, startY + i * adjLineH);
  });
}

function SlidePreview({ text, bgColor, fgColor, fontSize, bold, index }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext("2d");

    drawSlideOnCanvas(ctx, text, bgColor, fgColor, fontSize, bold);
    document.fonts.ready.then(() => {
      drawSlideOnCanvas(ctx, text, bgColor, fgColor, fontSize, bold);
    });
  }, [text, bgColor, fgColor, fontSize, bold]);

  return (
    <div className="slide-preview-wrapper">
      <div className="slide-number">{index + 1}</div>
      <canvas ref={canvasRef} className="slide-canvas" />
    </div>
  );
}

export default function App() {
  const [slides, setSlides] = useState([{ id: 1, text: "" }]);
  const [bgColor, setBgColor] = useState(DEFAULT_BG);
  const [fgColor, setFgColor] = useState(DEFAULT_FG);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [bold, setBold] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const nextId = useRef(2);

  const addSlide = () => {
    if (slides.length >= 10) return;
    setSlides((prev) => [...prev, { id: nextId.current++, text: "" }]);
  };

  const removeSlide = (id) => {
    if (slides.length <= 1) return;
    setSlides((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSlide = (id, text) => {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
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
      drawSlideOnCanvas(ctx, slide.text, bgColor, fgColor, fontSize, bold);
      const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.95));
      blobs.push(blob);
    }
    return blobs;
  };

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
          .layout { grid-template-columns: 1fr; }
          .controls { position: static; }
          .preview-section { order: 2; }
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

            <div className="control-group">
              <div className="section-title">Frasi ({slides.length}/10)</div>
              <div className="slides-list">
                {slides.map((slide, idx) => (
                  <div key={slide.id} className="slide-input-row">
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
                ))}
              </div>
              <button className="add-btn" onClick={addSlide} disabled={slides.length >= 10}>
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
              {slides.map((slide, idx) => (
                slide.text.trim() ? (
                  <SlidePreview
                    key={`${slide.id}-${bgColor}-${fgColor}-${fontSize}`}
                    text={slide.text}
                    bgColor={bgColor}
                    fgColor={fgColor}
                    fontSize={fontSize}
                    bold={bold}
                    index={idx}
                  />
                ) : (
                  <div key={slide.id} className="empty-preview">{idx + 1}</div>
                )
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}