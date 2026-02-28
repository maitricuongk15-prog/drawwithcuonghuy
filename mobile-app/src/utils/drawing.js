export function getStrokeColor(mode, color) {
  return mode === 'eraser' ? '#ffffff' : color;
}

function buildArrowHead(x1, y1, x2, y2) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLength = 14;
  const headAngle = Math.PI / 7;

  const leftX = x2 - headLength * Math.cos(angle - headAngle);
  const leftY = y2 - headLength * Math.sin(angle - headAngle);
  const rightX = x2 - headLength * Math.cos(angle + headAngle);
  const rightY = y2 - headLength * Math.sin(angle + headAngle);

  return `M ${leftX} ${leftY} L ${x2} ${y2} L ${rightX} ${rightY}`;
}

export function buildShapePath(type, start, end) {
  const x1 = start.x;
  const y1 = start.y;
  const x2 = end.x;
  const y2 = end.y;

  if (type === 'line') {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  if (type === 'rectangle') {
    return `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2} L ${x1} ${y2} Z`;
  }

  if (type === 'triangle') {
    const topX = (x1 + x2) / 2;
    const topY = y1;
    const leftX = x1;
    const leftY = y2;
    const rightX = x2;
    const rightY = y2;
    return `M ${topX} ${topY} L ${rightX} ${rightY} L ${leftX} ${leftY} Z`;
  }

  if (type === 'diamond') {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    return `M ${cx} ${y1} L ${x2} ${cy} L ${cx} ${y2} L ${x1} ${cy} Z`;
  }

  if (type === 'arrow') {
    return `M ${x1} ${y1} L ${x2} ${y2} ${buildArrowHead(x1, y1, x2, y2)}`;
  }

  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const rx = Math.abs(x2 - x1) / 2;
  const ry = Math.abs(y2 - y1) / 2;

  if (rx === 0 || ry === 0) {
    return `M ${x1} ${y1}`;
  }

  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
}
