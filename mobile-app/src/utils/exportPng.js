export function getTextSelectionFrame(entry) {
  if (
    Number.isFinite(entry?.boxX) &&
    Number.isFinite(entry?.boxY) &&
    Number.isFinite(entry?.boxWidth) &&
    Number.isFinite(entry?.boxHeight)
  ) {
    return {
      x: Number(entry.boxX),
      y: Number(entry.boxY),
      width: Number(entry.boxWidth),
      height: Number(entry.boxHeight),
    };
  }

  const fontSize = Number(entry?.fontSize) || 16;
  const textLength = String(entry?.text || '').length;
  const textWidth = Math.max(120, textLength * fontSize * 0.58 + 16);
  const textHeight = Math.max(34, fontSize + 14);

  return {
    x: Number(entry?.x || 0) - 8,
    y: Number(entry?.y || 0) - fontSize - 8,
    width: textWidth,
    height: textHeight,
  };
}

export async function exportDrawingAsPng({
  isWeb,
  drawing,
  canvasContainerRef,
  notify,
  fallbackSave,
}) {
  if (!isWeb) {
    fallbackSave?.();
    return;
  }

  const host = canvasContainerRef?.current;
  const measuredWidth = Math.round(host?.getBoundingClientRect?.().width || 0);
  const measuredHeight = Math.round(host?.getBoundingClientRect?.().height || 0);
  const width = Math.max(1, measuredWidth || 1280);
  const height = Math.max(1, measuredHeight || 720);

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;

  const ctx = exportCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('No canvas context');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  drawing.paths.forEach((entry) => {
    const isTextEntry =
      entry?.kind === 'text' ||
      (typeof entry?.text === 'string' && Number.isFinite(entry?.x) && Number.isFinite(entry?.y));

    if (isTextEntry) {
      const frame = getTextSelectionFrame(entry);
      const fontSize = Number(entry?.fontSize) || 16;
      const fontFamily = String(entry?.fontFamily || 'Helvetica');
      const fontWeight = entry?.isBold ? '700' : '400';
      const fontStyle = entry?.isItalic ? 'italic' : 'normal';
      const textAlign = entry?.textAlign || 'left';
      const textValue = String(entry?.text || '');

      if (entry?.backgroundFill) {
        ctx.fillStyle = String(entry?.backgroundColor || '#ffffff');
        ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
      }

      ctx.save();
      ctx.fillStyle = String(entry?.color || '#111827');
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = textAlign === 'center' ? 'center' : textAlign === 'right' ? 'right' : 'left';

      const textX =
        textAlign === 'center'
          ? frame.x + frame.width / 2
          : textAlign === 'right'
            ? frame.x + frame.width - 8
            : frame.x + 8;
      const textY = frame.y + fontSize + 6;
      ctx.fillText(textValue, textX, textY);
      ctx.restore();
      return;
    }

    if (!entry?.path) {
      if (entry?.kind === 'dot' && Number.isFinite(entry?.x) && Number.isFinite(entry?.y)) {
        const radius = Math.max(0.75, Number(entry?.radius) || 1);
        ctx.save();
        ctx.globalAlpha = Number.isFinite(entry?.strokeOpacity) ? Number(entry.strokeOpacity) : 1;
        ctx.fillStyle = String(entry?.color || '#111827');
        ctx.beginPath();
        ctx.arc(Number(entry.x), Number(entry.y), radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      return;
    }

    ctx.save();
    ctx.globalAlpha = Number.isFinite(entry?.strokeOpacity) ? Number(entry.strokeOpacity) : 1;
    ctx.strokeStyle = String(entry?.color || '#111827');
    ctx.lineWidth = Math.max(1, Number(entry?.strokeWidth) || 1);
    ctx.lineCap = entry?.lineCap || 'round';
    ctx.lineJoin = entry?.lineJoin || 'round';
    ctx.stroke(new Path2D(entry.path));
    ctx.restore();
  });

  const blob = await new Promise((resolve) => {
    exportCanvas.toBlob(resolve, 'image/png');
  });

  if (!blob) {
    throw new Error('Cannot create PNG blob');
  }

  const projectName = String(drawing.currentProject?.name || 'drawing')
    .trim()
    .replace(/[^\w.-]+/g, '_');
  const fileName = `${projectName || 'drawing'}-${Date.now()}.png`;

  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);

  notify?.({ type: 'success', message: `Saved PNG: ${fileName}` });
}
