interface DxfEntity {
  type: "LINE" | "CIRCLE" | "ARC" | "LWPOLYLINE" | "POLYLINE" | "SPLINE";
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  cx?: number;
  cy?: number;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  vertices?: Array<{ x: number; y: number }>;
  closed?: boolean;
}

function getLine(lines: string[], idx: number): string {
  return lines[idx] ?? "";
}

function readPair(lines: string[], i: number): { code: number; value: string } {
  const code = parseInt(getLine(lines, i).trim(), 10);
  const value = getLine(lines, i + 1).trim();
  return { code, value };
}

function parseLine(
  lines: string[],
  startIdx: number,
): { entity: DxfEntity; nextIndex: number } {
  const entity: DxfEntity = { type: "LINE", x1: 0, y1: 0, x2: 0, y2: 0 };
  let i = startIdx;

  while (i < lines.length - 1) {
    const { code, value } = readPair(lines, i);
    if (code === 0) break;

    switch (code) {
      case 10: entity.x1 = parseFloat(value); break;
      case 20: entity.y1 = parseFloat(value); break;
      case 11: entity.x2 = parseFloat(value); break;
      case 21: entity.y2 = parseFloat(value); break;
    }
    i += 2;
  }

  return { entity, nextIndex: i };
}

function parseCircle(
  lines: string[],
  startIdx: number,
): { entity: DxfEntity; nextIndex: number } {
  const entity: DxfEntity = { type: "CIRCLE", cx: 0, cy: 0, radius: 0 };
  let i = startIdx;

  while (i < lines.length - 1) {
    const { code, value } = readPair(lines, i);
    if (code === 0) break;

    switch (code) {
      case 10: entity.cx = parseFloat(value); break;
      case 20: entity.cy = parseFloat(value); break;
      case 40: entity.radius = parseFloat(value); break;
    }
    i += 2;
  }

  return { entity, nextIndex: i };
}

function parseArc(
  lines: string[],
  startIdx: number,
): { entity: DxfEntity; nextIndex: number } {
  const entity: DxfEntity = {
    type: "ARC",
    cx: 0,
    cy: 0,
    radius: 0,
    startAngle: 0,
    endAngle: 360,
  };
  let i = startIdx;

  while (i < lines.length - 1) {
    const { code, value } = readPair(lines, i);
    if (code === 0) break;

    switch (code) {
      case 10: entity.cx = parseFloat(value); break;
      case 20: entity.cy = parseFloat(value); break;
      case 40: entity.radius = parseFloat(value); break;
      case 50: entity.startAngle = parseFloat(value); break;
      case 51: entity.endAngle = parseFloat(value); break;
    }
    i += 2;
  }

  return { entity, nextIndex: i };
}

function parseLwPolyline(
  lines: string[],
  startIdx: number,
): { entity: DxfEntity; nextIndex: number } {
  const entity: DxfEntity = {
    type: "LWPOLYLINE",
    vertices: [],
    closed: false,
  };
  let i = startIdx;
  let currentX: number | null = null;

  while (i < lines.length - 1) {
    const { code, value } = readPair(lines, i);
    if (code === 0) break;

    switch (code) {
      case 70: {
        const flags = parseInt(value, 10);
        entity.closed = (flags & 1) === 1;
        break;
      }
      case 10:
        currentX = parseFloat(value);
        break;
      case 20:
        if (currentX !== null) {
          entity.vertices!.push({ x: currentX, y: parseFloat(value) });
          currentX = null;
        }
        break;
    }
    i += 2;
  }

  return { entity, nextIndex: i };
}

function parsePolyline(
  lines: string[],
  startIdx: number,
): { entity: DxfEntity; nextIndex: number } {
  const entity: DxfEntity = {
    type: "POLYLINE",
    vertices: [],
    closed: false,
  };
  let i = startIdx;

  while (i < lines.length - 1) {
    const { code, value } = readPair(lines, i);
    if (code === 0) break;

    if (code === 70) {
      const flags = parseInt(value, 10);
      entity.closed = (flags & 1) === 1;
    }
    i += 2;
  }

  while (i < lines.length - 1) {
    const { code, value } = readPair(lines, i);

    if (code === 0 && value === "SEQEND") {
      i += 2;
      break;
    }

    if (code === 0 && value === "VERTEX") {
      i += 2;
      let vx = 0;
      let vy = 0;
      while (i < lines.length - 1) {
        const vPair = readPair(lines, i);
        if (vPair.code === 0) break;
        if (vPair.code === 10) vx = parseFloat(vPair.value);
        if (vPair.code === 20) vy = parseFloat(vPair.value);
        i += 2;
      }
      entity.vertices!.push({ x: vx, y: vy });
    } else {
      i += 2;
    }
  }

  return { entity, nextIndex: i };
}

function parseSpline(
  lines: string[],
  startIdx: number,
): { entity: DxfEntity; nextIndex: number } {
  const fitPoints: Array<{ x: number; y: number }> = [];
  const controlPoints: Array<{ x: number; y: number }> = [];
  let i = startIdx;
  let currentFitX: number | null = null;
  let currentControlX: number | null = null;
  let closed = false;

  while (i < lines.length - 1) {
    const { code, value } = readPair(lines, i);
    if (code === 0) break;

    switch (code) {
      case 70: {
        const flags = parseInt(value, 10);
        closed = (flags & 1) === 1;
        break;
      }
      case 10:
        currentControlX = parseFloat(value);
        break;
      case 20:
        if (currentControlX !== null) {
          controlPoints.push({ x: currentControlX, y: parseFloat(value) });
          currentControlX = null;
        }
        break;
      case 11:
        currentFitX = parseFloat(value);
        break;
      case 21:
        if (currentFitX !== null) {
          fitPoints.push({ x: currentFitX, y: parseFloat(value) });
          currentFitX = null;
        }
        break;
    }

    i += 2;
  }

  return {
    entity: {
      type: "SPLINE",
      vertices: fitPoints.length >= 2 ? fitPoints : controlPoints,
      closed,
    },
    nextIndex: i,
  };
}

export function parseDxfEntities(dxfContent: string): DxfEntity[] {
  const entities: DxfEntity[] = [];
  const lines = dxfContent.split(/\r?\n/);

  let i = 0;
  while (i < lines.length) {
    if (getLine(lines, i).trim() === "ENTITIES") {
      i++;
      break;
    }
    i++;
  }

  if (i >= lines.length) {
    console.log("[dxf-parser] No ENTITIES section found");
    return entities;
  }

  while (i < lines.length - 1) {
    const { code, value } = readPair(lines, i);

    if (code === 0 && value === "ENDSEC") {
      break;
    }

    if (code === 0) {
      if (value === "LINE") {
        const result = parseLine(lines, i + 2);
        entities.push(result.entity);
        i = result.nextIndex;
      } else if (value === "CIRCLE") {
        const result = parseCircle(lines, i + 2);
        entities.push(result.entity);
        i = result.nextIndex;
      } else if (value === "ARC") {
        const result = parseArc(lines, i + 2);
        entities.push(result.entity);
        i = result.nextIndex;
      } else if (value === "LWPOLYLINE") {
        const result = parseLwPolyline(lines, i + 2);
        entities.push(result.entity);
        i = result.nextIndex;
      } else if (value === "POLYLINE") {
        const result = parsePolyline(lines, i + 2);
        entities.push(result.entity);
        i = result.nextIndex;
      } else if (value === "SPLINE") {
        const result = parseSpline(lines, i + 2);
        entities.push(result.entity);
        i = result.nextIndex;
      } else {
        i += 2;
      }
    } else {
      i += 2;
    }
  }

  console.log(`[dxf-parser] Parsed ${entities.length} entities`);
  return entities;
}

export function entitiesToSvg(entities: DxfEntity[]): string {
  if (entities.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>';
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function updateBounds(x: number, y: number) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  for (const entity of entities) {
    switch (entity.type) {
      case "LINE":
        updateBounds(entity.x1 ?? 0, entity.y1 ?? 0);
        updateBounds(entity.x2 ?? 0, entity.y2 ?? 0);
        break;
      case "CIRCLE":
        updateBounds((entity.cx ?? 0) - (entity.radius ?? 0), (entity.cy ?? 0) - (entity.radius ?? 0));
        updateBounds((entity.cx ?? 0) + (entity.radius ?? 0), (entity.cy ?? 0) + (entity.radius ?? 0));
        break;
      case "ARC":
        updateBounds((entity.cx ?? 0) - (entity.radius ?? 0), (entity.cy ?? 0) - (entity.radius ?? 0));
        updateBounds((entity.cx ?? 0) + (entity.radius ?? 0), (entity.cy ?? 0) + (entity.radius ?? 0));
        break;
      case "LWPOLYLINE":
      case "POLYLINE":
      case "SPLINE":
        for (const vertex of entity.vertices ?? []) {
          updateBounds(vertex.x, vertex.y);
        }
        break;
    }
  }

  const margin = 10;
  const width = maxX - minX || 100;
  const height = maxY - minY || 100;
  const vbX = minX - margin;
  const vbY = minY - margin;
  const vbW = width + margin * 2;
  const vbH = height + margin * 2;

  const svgParts: string[] = [];
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}">`,
  );
  svgParts.push(
    `<g transform="scale(1,-1) translate(0,${-(minY + maxY)})" stroke="black" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" fill="none">`,
  );

  for (const entity of entities) {
    switch (entity.type) {
      case "LINE":
        svgParts.push(
          `<line x1="${entity.x1 ?? 0}" y1="${entity.y1 ?? 0}" x2="${entity.x2 ?? 0}" y2="${entity.y2 ?? 0}" />`,
        );
        break;
      case "CIRCLE":
        svgParts.push(
          `<circle cx="${entity.cx ?? 0}" cy="${entity.cy ?? 0}" r="${entity.radius ?? 0}" />`,
        );
        break;
      case "ARC": {
        const r = entity.radius ?? 0;
        const startRad = ((entity.startAngle ?? 0) * Math.PI) / 180;
        const endRad = ((entity.endAngle ?? 360) * Math.PI) / 180;
        const cx = entity.cx ?? 0;
        const cy = entity.cy ?? 0;
        const sx = cx + r * Math.cos(startRad);
        const sy = cy + r * Math.sin(startRad);
        const ex = cx + r * Math.cos(endRad);
        const ey = cy + r * Math.sin(endRad);
        let sweep = (entity.endAngle ?? 360) - (entity.startAngle ?? 0);
        if (sweep < 0) sweep += 360;
        const largeArcFlag = sweep > 180 ? 1 : 0;

        svgParts.push(
          `<path d="M ${sx} ${sy} A ${r} ${r} 0 ${largeArcFlag} 1 ${ex} ${ey}" />`,
        );
        break;
      }
      case "LWPOLYLINE":
      case "POLYLINE":
      case "SPLINE": {
        const vertices = entity.vertices ?? [];
        if (vertices.length >= 2) {
          const points = vertices.map((vertex) => `${vertex.x},${vertex.y}`).join(" ");
          svgParts.push(
            entity.closed
              ? `<polygon points="${points}" />`
              : `<polyline points="${points}" />`,
          );
        }
        break;
      }
    }
  }

  svgParts.push("</g>");
  svgParts.push("</svg>");

  return svgParts.join("\n");
}

export function convertDxfToSvgString(dxfContent: string): string {
  return entitiesToSvg(parseDxfEntities(dxfContent));
}
