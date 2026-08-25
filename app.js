const DEFAULTS = Object.freeze({
  density: 96,
  sparkScale: 108,
  sourceOpacity: 14,
  colorMode: "electric",
  contrast: 72,
  dither: 64,
  previewBackground: "#061324",
  gridColumns: 4,
  gridRows: 3,
  gutter: 8,
  showSparks: true,
  showSource: false,
  showGrid: false,
  exportFormat: "png",
  printWidth: 12,
});

const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_RENDER_EDGE = 1800;
const PRINT_DPI = 300;
const MAX_EXPORT_EDGE = 10000;
const MAX_EXPORT_PIXELS = 64_000_000;
const HEX_ROW_RATIO = Math.sqrt(3) / 2;
const ELECTRIC_PALETTE = [
  [255, 43, 154],
  [239, 52, 42],
  [242, 186, 49],
  [76, 169, 67],
  [49, 82, 231],
  [0, 166, 147],
  [244, 239, 225],
  [111, 32, 91],
];
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const elements = {
  canvas: document.querySelector("#mosaicCanvas"),
  canvasWrap: document.querySelector("#canvasWrap"),
  colorMode: document.querySelector("#colorMode"),
  colorSection: document.querySelector("#colorSection"),
  contrast: document.querySelector("#contrast"),
  contrastValue: document.querySelector("#contrastValue"),
  controlsSection: document.querySelector("#controlsSection"),
  density: document.querySelector("#density"),
  densityValue: document.querySelector("#densityValue"),
  dither: document.querySelector("#dither"),
  ditherValue: document.querySelector("#ditherValue"),
  dropCard: document.querySelector("#dropCard"),
  dropOverlay: document.querySelector("#dropOverlay"),
  exportDetail: document.querySelector("#exportDetail"),
  exportButton: document.querySelector("#exportButton"),
  exportFormat: document.querySelector("#exportFormat"),
  exportSection: document.querySelector("#exportSection"),
  fileInput: document.querySelector("#fileInput"),
  fileMeta: document.querySelector("#fileMeta"),
  fileName: document.querySelector("#fileName"),
  fileThumb: document.querySelector("#fileThumb"),
  gridColumns: document.querySelector("#gridColumns"),
  gridColumnsValue: document.querySelector("#gridColumnsValue"),
  gridRows: document.querySelector("#gridRows"),
  gridRowsValue: document.querySelector("#gridRowsValue"),
  gridSection: document.querySelector("#gridSection"),
  gutter: document.querySelector("#gutter"),
  gutterValue: document.querySelector("#gutterValue"),
  layersSection: document.querySelector("#layersSection"),
  previewBackground: document.querySelector("#previewBackground"),
  printWidth: document.querySelector("#printWidth"),
  replaceButton: document.querySelector("#replaceButton"),
  resetButton: document.querySelector("#resetButton"),
  showGrid: document.querySelector("#showGrid"),
  showSource: document.querySelector("#showSource"),
  showSparks: document.querySelector("#showSparks"),
  sourceOpacity: document.querySelector("#sourceOpacity"),
  sourceOpacityValue: document.querySelector("#sourceOpacityValue"),
  sparkScale: document.querySelector("#sparkScale"),
  sparkScaleValue: document.querySelector("#sparkScaleValue"),
  stage: document.querySelector("#stage"),
  status: document.querySelector("#status"),
  uploadButton: document.querySelector("#uploadButton"),
};

const context = elements.canvas.getContext("2d", { alpha: true });
const sourceCanvas = document.createElement("canvas");
const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });

let sourceImage = null;
let sourcePixels = null;
let sourceObjectUrl = "";
let currentFileName = "";
let renderFrame = 0;
let dragDepth = 0;
let sparkPath = null;

const fallbackSparkPath =
  "M18.679 4.20264L20.8492 2.07936C21.3232 1.62437 22.0715 1.62437 22.5205 2.10464C22.9696 2.5849 22.9696 3.34322 22.4956 3.7982L19.0282 7.18534C15.9599 10.1933 16.0347 15.2235 19.2277 18.1303L22.7949 21.3911C23.2689 21.8461 23.3188 22.6044 22.8698 23.0847C22.4208 23.5649 21.6724 23.6155 21.1984 23.1605L17.756 20.0009L18.7288 24.6266C18.8785 25.2838 18.4544 25.9157 17.8059 26.0421C17.1573 26.1938 16.5336 25.764 16.4089 25.1068L15.4111 20.3295C14.5131 16.0829 10.2724 13.5046 6.15637 14.6927L1.51653 16.0323C0.892897 16.2093 0.219371 15.8554 0.0447538 15.1982C-0.129864 14.5663 0.219372 13.8838 0.867951 13.7068L3.8614 12.8474L1.21719 12.0386C0.593552 11.8363 0.244317 11.1791 0.418934 10.5472C0.618498 9.91527 1.26708 9.56139 1.89071 9.73833L6.50561 11.1539C10.5966 12.4177 14.8873 9.91527 15.8601 5.66871L16.9577 0.91661C17.1074 0.284681 17.731 -0.119753 18.3796 0.03191C19.0282 0.183573 19.4024 0.815501 19.2776 1.47271L18.679 4.12681V4.20264ZM14.5879 14.5157C14.4382 13.7068 14.3634 12.898 14.4133 12.0891C13.8395 12.5188 13.2159 12.8727 12.5923 13.1507C13.3157 13.5299 13.9892 13.9849 14.5879 14.5157Z";
let sparkPathData = fallbackSparkPath;

function getState() {
  return {
    density: Number(elements.density.value),
    sparkScale: Number(elements.sparkScale.value),
    sourceOpacity: Number(elements.sourceOpacity.value),
    colorMode: elements.colorMode.value,
    contrast: Number(elements.contrast.value),
    dither: Number(elements.dither.value),
    previewBackground: elements.previewBackground.value,
    gridColumns: Number(elements.gridColumns.value),
    gridRows: Number(elements.gridRows.value),
    gutter: Number(elements.gutter.value),
    showSparks: elements.showSparks.checked,
    showSource: elements.showSource.checked,
    showGrid: elements.showGrid.checked,
    exportFormat: elements.exportFormat.value,
    printWidth: Number(elements.printWidth.value),
  };
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function updateRange(input) {
  const minimum = Number(input.min);
  const maximum = Number(input.max);
  const progress = ((Number(input.value) - minimum) / (maximum - minimum)) * 100;
  input.style.setProperty("--range-progress", `${progress}%`);
}

function updateControlLabels() {
  elements.densityValue.value = elements.density.value;
  elements.sparkScaleValue.value = `${elements.sparkScale.value}%`;
  elements.sourceOpacityValue.value = `${elements.sourceOpacity.value}%`;
  elements.contrastValue.value = `${elements.contrast.value}%`;
  elements.ditherValue.value = `${elements.dither.value}%`;
  elements.gridColumnsValue.value = elements.gridColumns.value;
  elements.gridRowsValue.value = elements.gridRows.value;
  elements.gutterValue.value = `${elements.gutter.value}px`;

  document.querySelectorAll('input[type="range"]').forEach(updateRange);
  updateExportDetails();
}

function setControlsEnabled(enabled) {
  [
    elements.controlsSection,
    elements.colorSection,
    elements.gridSection,
    elements.layersSection,
    elements.exportSection,
  ].forEach((section) => section.setAttribute("aria-disabled", String(!enabled)));
  elements.resetButton.disabled = !enabled;
  updateExportDetails();
}

function resetTreatment() {
  Object.entries(DEFAULTS).forEach(([key, value]) => {
    const input = elements[key];
    if (!input) return;
    if (input.type === "checkbox") {
      input.checked = value;
    } else {
      input.value = value;
    }
  });
  updateControlLabels();
  setPreviewBackground(DEFAULTS.previewBackground);
  scheduleRender();
}

async function loadSparkPath() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch("sparkwhite.svg", { signal: controller.signal });
    if (!response.ok) throw new Error(`SVG request failed: ${response.status}`);
    const svgText = await response.text();
    const documentNode = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const pathData = documentNode.querySelector("path")?.getAttribute("d");
    sparkPathData = pathData || fallbackSparkPath;
    sparkPath = new Path2D(sparkPathData);
  } catch {
    sparkPathData = fallbackSparkPath;
    sparkPath = new Path2D(fallbackSparkPath);
  } finally {
    window.clearTimeout(timeout);
    scheduleRender();
  }
}

function makePanelPath(width, height, state) {
  const panelPath = new Path2D();
  const rectangles = [];
  const columns = state.showGrid ? state.gridColumns : 1;
  const rows = state.showGrid ? state.gridRows : 1;
  const gutter = state.showGrid ? state.gutter : 0;
  const cellWidth = width / columns;
  const cellHeight = height / rows;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const leftGap = column === 0 ? 0 : gutter / 2;
      const rightGap = column === columns - 1 ? 0 : gutter / 2;
      const topGap = row === 0 ? 0 : gutter / 2;
      const bottomGap = row === rows - 1 ? 0 : gutter / 2;
      const x = column * cellWidth + leftGap;
      const y = row * cellHeight + topGap;
      const panelWidth = Math.max(0, cellWidth - leftGap - rightGap);
      const panelHeight = Math.max(0, cellHeight - topGap - bottomGap);
      panelPath.rect(x, y, panelWidth, panelHeight);
      rectangles.push({ x, y, width: panelWidth, height: panelHeight });
    }
  }

  return { panelPath, rectangles, columns, rows, gutter, cellWidth, cellHeight };
}

function isInsidePanel(x, y, layout) {
  if (layout.gutter === 0) return true;

  const column = Math.min(layout.columns - 1, Math.floor(x / layout.cellWidth));
  const row = Math.min(layout.rows - 1, Math.floor(y / layout.cellHeight));
  const localX = x - column * layout.cellWidth;
  const localY = y - row * layout.cellHeight;
  const leftGap = column === 0 ? 0 : layout.gutter / 2;
  const rightEdge =
    layout.cellWidth - (column === layout.columns - 1 ? 0 : layout.gutter / 2);
  const topGap = row === 0 ? 0 : layout.gutter / 2;
  const bottomEdge =
    layout.cellHeight - (row === layout.rows - 1 ? 0 : layout.gutter / 2);

  return (
    localX >= leftGap &&
    localX <= rightEdge &&
    localY >= topGap &&
    localY <= bottomEdge
  );
}

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function parseHexColor(hex) {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function srgbToLinear(value) {
  const channel = value / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color) {
  return (
    0.2126 * srgbToLinear(color[0]) +
    0.7152 * srgbToLinear(color[1]) +
    0.0722 * srgbToLinear(color[2])
  );
}

function contrastRatio(first, second) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function rgbToOklab(color) {
  const red = srgbToLinear(color[0]);
  const green = srgbToLinear(color[1]);
  const blue = srgbToLinear(color[2]);
  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function colorDistance(first, second) {
  const firstLab = rgbToOklab(first);
  const secondLab = rgbToOklab(second);
  return Math.hypot(
    firstLab[0] - secondLab[0],
    firstLab[1] - secondLab[1],
    firstLab[2] - secondLab[2],
  );
}

function rgbToHsl(color) {
  const red = color[0] / 255;
  const green = color[1] / 255;
  const blue = color[2] / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;

  if (delta !== 0) {
    if (maximum === red) hue = ((green - blue) / delta) % 6;
    else if (maximum === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue /= 6;
    if (hue < 0) hue += 1;
  }

  const lightness = (maximum + minimum) / 2;
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return [hue, saturation, lightness];
}

function hslToRgb(color) {
  const [hue, saturation, lightness] = color;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hueSection = hue * 6;
  const secondary = chroma * (1 - Math.abs((hueSection % 2) - 1));
  let channels;

  if (hueSection < 1) channels = [chroma, secondary, 0];
  else if (hueSection < 2) channels = [secondary, chroma, 0];
  else if (hueSection < 3) channels = [0, chroma, secondary];
  else if (hueSection < 4) channels = [0, secondary, chroma];
  else if (hueSection < 5) channels = [secondary, 0, chroma];
  else channels = [chroma, 0, secondary];

  const offset = lightness - chroma / 2;
  return channels.map((channel) => Math.round((channel + offset) * 255));
}

function boostColor(sample, background, contrastAmount) {
  const amount = contrastAmount / 100;
  const [hue, saturation, lightness] = rgbToHsl(sample);
  const backgroundIsDark = relativeLuminance(background) < 0.38;
  const minimumRatio = 1.15 + amount * 2.35;
  let adjustedLightness = backgroundIsDark
    ? Math.max(lightness, 0.34 + amount * 0.2)
    : Math.min(lightness, 0.66 - amount * 0.22);
  const adjustedSaturation = clamp(saturation * (1.15 + amount * 0.85), 0, 1);
  let result = hslToRgb([hue, adjustedSaturation, adjustedLightness]);

  for (let attempt = 0; attempt < 8 && contrastRatio(result, background) < minimumRatio; attempt += 1) {
    adjustedLightness = clamp(
      adjustedLightness + (backgroundIsDark ? 0.055 : -0.055),
      0.04,
      0.96,
    );
    result = hslToRgb([hue, adjustedSaturation, adjustedLightness]);
  }

  return result;
}

function stableNoise(column, row) {
  const value = Math.sin(column * 127.1 + row * 311.7 + 74.7) * 43758.5453;
  return value - Math.floor(value);
}

function chooseElectricColor(sample, background, state, column, row) {
  const minimumRatio = 1.15 + (state.contrast / 100) * 2.35;
  let candidates = ELECTRIC_PALETTE.filter(
    (color) => contrastRatio(color, background) >= minimumRatio,
  );

  if (candidates.length < 2) {
    candidates = [...ELECTRIC_PALETTE]
      .sort((first, second) => contrastRatio(second, background) - contrastRatio(first, background))
      .slice(0, 2);
  }

  const ranked = candidates
    .map((color) => ({ color, distance: colorDistance(sample, color) }))
    .sort((first, second) => first.distance - second.distance);
  const first = ranked[0];
  const second = ranked[1] || first;
  const distanceTotal = first.distance + second.distance || 1;
  const secondProbability =
    (first.distance / distanceTotal) * (state.dither / 100);

  return stableNoise(column, row) < secondProbability ? second.color : first.color;
}

function treatedColor(sample, background, state, column, row) {
  if (state.colorMode === "sampled") return sample;
  if (state.colorMode === "boosted") {
    return boostColor(sample, background, state.contrast);
  }
  return chooseElectricColor(sample, background, state, column, row);
}

function averageSourceColor(x, y, radius, width, height) {
  const offsets = [
    [0, 0],
    [-radius, -radius],
    [radius, -radius],
    [-radius, radius],
    [radius, radius],
  ];
  const totals = [0, 0, 0, 0];

  offsets.forEach(([offsetX, offsetY]) => {
    const sampleX = Math.round(clamp(x + offsetX, 0, width - 1));
    const sampleY = Math.round(clamp(y + offsetY, 0, height - 1));
    const index = (sampleY * width + sampleX) * 4;
    totals[0] += sourcePixels[index];
    totals[1] += sourcePixels[index + 1];
    totals[2] += sourcePixels[index + 2];
    totals[3] += sourcePixels[index + 3];
  });

  return totals.map((total) => Math.round(total / offsets.length));
}

function buildSparkMarks(width, height, state, layout) {
  const background = parseHexColor(state.previewBackground);
  const pitchX = width / state.density;
  const pitchY = pitchX * HEX_ROW_RATIO;
  const sparkRows = Math.ceil(height / pitchY) + 1;
  const baseSize = pitchX * (state.sparkScale / 100);
  const sourceScaleX = sourceCanvas.width / width;
  const sourceScaleY = sourceCanvas.height / height;
  const sampleRadius = Math.max(1, (sourceCanvas.width / state.density) * 0.22);
  const backgroundLuminance = relativeLuminance(background);
  const marks = [];

  for (let row = -1; row < sparkRows; row += 1) {
    const y = (row + 0.5) * pitchY;
    const rowOffset = (row & 1) * 0.5;
    for (let column = -1; column <= state.density; column += 1) {
      const x = (column + 0.5 + rowOffset) * pitchX;
      if (x < 0 || x > width || y < 0 || y > height) continue;
      if (!isInsidePanel(x, y, layout)) continue;

      const sample = averageSourceColor(
        x * sourceScaleX,
        y * sourceScaleY,
        sampleRadius,
        sourceCanvas.width,
        sourceCanvas.height,
      );
      if (sample[3] < 12) continue;

      const sourceColor = sample.slice(0, 3);
      const color = treatedColor(sourceColor, background, state, column, row);
      const sourceLuminance = relativeLuminance(sourceColor);
      const tonalDifference = clamp(Math.abs(sourceLuminance - backgroundLuminance) * 2.2);
      const size = baseSize * (0.72 + tonalDifference * 0.34);
      const scale = size / 27;
      marks.push({ x, y, scale, color, opacity: 1 });
    }
  }

  return marks;
}

function drawTreatment(targetContext, width, height, state) {
  const scaleFactor = width / sourceCanvas.width;
  const renderState = { ...state, gutter: state.gutter * scaleFactor };
  const layout = makePanelPath(width, height, renderState);
  const marks = state.showSparks
    ? buildSparkMarks(width, height, renderState, layout)
    : [];

  targetContext.setTransform(1, 0, 0, 1, 0, 0);
  targetContext.globalAlpha = 1;
  targetContext.clearRect(0, 0, width, height);

  if (state.showSource && state.sourceOpacity > 0) {
    targetContext.save();
    targetContext.clip(layout.panelPath);
    targetContext.globalAlpha = state.sourceOpacity / 100;
    targetContext.drawImage(sourceCanvas, 0, 0, width, height);
    targetContext.restore();
  }

  if (state.showSparks) {
    targetContext.save();
    targetContext.clip(layout.panelPath);
    marks.forEach((mark) => {
      targetContext.globalAlpha = mark.opacity;
      targetContext.fillStyle =
        `rgb(${mark.color[0]} ${mark.color[1]} ${mark.color[2]})`;
      targetContext.setTransform(
        mark.scale,
        0,
        0,
        mark.scale,
        mark.x - 12 * mark.scale,
        mark.y - 13.5 * mark.scale,
      );
      targetContext.fill(sparkPath);
    });
    targetContext.restore();
  }

  targetContext.setTransform(1, 0, 0, 1, 0, 0);
  targetContext.globalAlpha = 1;
  return { layout, marks };
}

function render() {
  renderFrame = 0;
  if (!sourceImage || !sourcePixels || !sparkPath) return;

  const state = getState();
  const width = elements.canvas.width;
  const height = elements.canvas.height;
  const { marks } = drawTreatment(context, width, height, state);
  const dimensions = `${width} × ${height}`;
  const sparkSummary = state.showSparks
    ? ` • ${marks.length.toLocaleString()} hex sparks`
    : " • sparks hidden";
  setStatus(`${dimensions}${sparkSummary}`);
}

function scheduleRender() {
  if (!sourceImage || renderFrame) return;
  renderFrame = window.requestAnimationFrame(render);
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function decodeImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be decoded."));
    image.src = url;
  });
}

async function loadFile(file) {
  if (!file) return;

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    setStatus("Choose a PNG, JPG, WEBP, or GIF image", true);
    return;
  }

  if (file.size > MAX_FILE_BYTES) {
    setStatus("Image must be smaller than 40 MB", true);
    return;
  }

  setStatus("Preparing image…");
  const nextObjectUrl = URL.createObjectURL(file);

  try {
    const image = await decodeImage(nextObjectUrl);
    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
    const renderScale = Math.min(1, MAX_RENDER_EDGE / longestEdge);
    const width = Math.max(1, Math.round(image.naturalWidth * renderScale));
    const height = Math.max(1, Math.round(image.naturalHeight * renderScale));

    sourceCanvas.width = width;
    sourceCanvas.height = height;
    sourceContext.clearRect(0, 0, width, height);
    sourceContext.imageSmoothingEnabled = true;
    sourceContext.imageSmoothingQuality = "high";
    sourceContext.drawImage(image, 0, 0, width, height);
    sourcePixels = sourceContext.getImageData(0, 0, width, height).data;

    elements.canvas.width = width;
    elements.canvas.height = height;
    sourceImage = image;
    currentFileName = file.name;

    if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
    sourceObjectUrl = nextObjectUrl;

    elements.fileName.textContent = file.name;
    elements.fileMeta.textContent =
      `${image.naturalWidth} × ${image.naturalHeight} • ${formatFileSize(file.size)}`;
    elements.fileThumb.style.backgroundImage = `url("${nextObjectUrl}")`;
    elements.fileThumb.style.backgroundPosition = "center";
    elements.fileThumb.style.backgroundSize = "cover";
    elements.dropCard.hidden = true;
    elements.canvasWrap.hidden = false;
    setControlsEnabled(true);
    scheduleRender();
  } catch (error) {
    URL.revokeObjectURL(nextObjectUrl);
    setStatus(error instanceof Error ? error.message : "Unable to load image", true);
  } finally {
    elements.fileInput.value = "";
  }
}

function openFilePicker() {
  elements.fileInput.click();
}

function setPreviewBackground(color) {
  elements.previewBackground.value = color;
  elements.canvas.style.backgroundColor = color;
  document.querySelectorAll(".color-swatch").forEach((swatch) => {
    swatch.classList.toggle(
      "is-selected",
      swatch.dataset.color.toLowerCase() === color.toLowerCase(),
    );
  });
  scheduleRender();
}

function getExportDimensions() {
  if (!sourceImage) return null;

  const printWidth = Number(elements.printWidth.value);
  if (!Number.isFinite(printWidth) || printWidth < 2 || printWidth > 20) {
    return { valid: false };
  }

  const printHeight = printWidth * (sourceCanvas.height / sourceCanvas.width);
  const pixelWidth = Math.round(printWidth * PRINT_DPI);
  const pixelHeight = Math.round(printHeight * PRINT_DPI);
  const tooLarge =
    Math.max(pixelWidth, pixelHeight) > MAX_EXPORT_EDGE ||
    pixelWidth * pixelHeight > MAX_EXPORT_PIXELS;

  return {
    valid: true,
    printWidth,
    printHeight,
    pixelWidth,
    pixelHeight,
    tooLarge,
  };
}

function formatInches(value) {
  return Number(value.toFixed(2)).toLocaleString();
}

function updateExportDetails() {
  const isSvg = elements.exportFormat.value === "svg";
  elements.exportButton.textContent = isSvg ? "Export SVG" : "Export 300 DPI PNG";

  const dimensions = getExportDimensions();
  if (!dimensions) {
    elements.exportDetail.textContent = "Upload an image to calculate size";
    elements.exportButton.disabled = true;
    return;
  }

  if (!dimensions.valid) {
    elements.exportDetail.textContent = "Enter a print width from 2–20 in";
    elements.exportButton.disabled = true;
    return;
  }

  if (!isSvg && dimensions.tooLarge) {
    elements.exportDetail.textContent = "Output is too large — reduce print width";
    elements.exportButton.disabled = true;
    return;
  }

  const physicalSize =
    `${formatInches(dimensions.printWidth)} × ${formatInches(dimensions.printHeight)} in`;
  elements.exportDetail.textContent = isSvg
    ? `${physicalSize} • editable vector`
    : `${physicalSize} • ${dimensions.pixelWidth.toLocaleString()} × ` +
      `${dimensions.pixelHeight.toLocaleString()} px`;
  elements.exportButton.disabled = false;
}

function safeBaseName() {
  return (
    currentFileName
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .slice(0, 80) || "spark-mosaic"
  );
}

function downloadBlob(blob, filename) {
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

function canvasToBlob(canvas, type) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create export file."));
    }, type);
  });
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function makePngDensityChunk(dpi) {
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  const pixelsPerMeter = Math.round(dpi / 0.0254);
  const typeAndData = chunk.subarray(4, 17);

  view.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4);
  view.setUint32(8, pixelsPerMeter);
  view.setUint32(12, pixelsPerMeter);
  chunk[16] = 1;
  view.setUint32(17, crc32(typeAndData));
  return chunk;
}

async function setPngDensity(blob, dpi) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const densityChunk = makePngDensityChunk(dpi);
  const parts = [bytes.slice(0, 8)];
  let offset = 8;
  let inserted = false;

  while (offset + 12 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
    const dataLength = view.getUint32(0);
    const chunkLength = dataLength + 12;
    if (offset + chunkLength > bytes.length) return blob;

    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    );

    if (type !== "pHYs") parts.push(bytes.slice(offset, offset + chunkLength));
    if (type === "IHDR" && !inserted) {
      parts.push(densityChunk);
      inserted = true;
    }
    offset += chunkLength;
    if (type === "IEND") break;
  }

  return inserted ? new Blob(parts, { type: "image/png" }) : blob;
}

async function exportPrintPng(dimensions) {
  setStatus(`Rendering ${dimensions.pixelWidth.toLocaleString()} × ` +
    `${dimensions.pixelHeight.toLocaleString()} px…`);
  elements.exportButton.disabled = true;
  await new Promise((resolve) => window.requestAnimationFrame(resolve));

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = dimensions.pixelWidth;
  exportCanvas.height = dimensions.pixelHeight;
  const exportContext = exportCanvas.getContext("2d", { alpha: true });
  drawTreatment(
    exportContext,
    dimensions.pixelWidth,
    dimensions.pixelHeight,
    getState(),
  );

  const pngBlob = await canvasToBlob(exportCanvas, "image/png");
  const printBlob = await setPngDensity(pngBlob, PRINT_DPI);
  downloadBlob(printBlob, `${safeBaseName()}-spark-mosaic-300dpi.png`);
  exportCanvas.width = 1;
  exportCanvas.height = 1;
  setStatus(`Transparent ${PRINT_DPI} DPI PNG exported`);
}

function formatSvgNumber(value) {
  return Number(value.toFixed(4));
}

function exportSvg(dimensions) {
  const state = getState();
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const layout = makePanelPath(width, height, state);
  const marks = state.showSparks
    ? buildSparkMarks(width, height, state, layout)
    : [];
  const clipRects = layout.rectangles
    .map(
      (rectangle) =>
        `<rect x="${formatSvgNumber(rectangle.x)}" y="${formatSvgNumber(rectangle.y)}" ` +
        `width="${formatSvgNumber(rectangle.width)}" ` +
        `height="${formatSvgNumber(rectangle.height)}"/>`,
    )
    .join("");
  const sourceLayer =
    state.showSource && state.sourceOpacity > 0
      ? `<image href="${sourceCanvas.toDataURL("image/png")}" width="${width}" ` +
        `height="${height}" opacity="${state.sourceOpacity / 100}" ` +
        `preserveAspectRatio="none"/>`
      : "";
  const sparkLayer = marks
    .map((mark) => {
      const translateX = mark.x - 12 * mark.scale;
      const translateY = mark.y - 13.5 * mark.scale;
      const color = `rgb(${mark.color[0]},${mark.color[1]},${mark.color[2]})`;
      const opacity = mark.opacity < 0.999
        ? ` fill-opacity="${formatSvgNumber(mark.opacity)}"`
        : "";
      return (
        `<path d="${sparkPathData}" fill="${color}"${opacity} ` +
        `transform="matrix(${formatSvgNumber(mark.scale)} 0 0 ` +
        `${formatSvgNumber(mark.scale)} ${formatSvgNumber(translateX)} ` +
        `${formatSvgNumber(translateY)})"/>`
      );
    })
    .join("");
  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${formatSvgNumber(dimensions.printWidth)}in" ` +
    `height="${formatSvgNumber(dimensions.printHeight)}in" ` +
    `viewBox="0 0 ${width} ${height}" fill="none">` +
    `<title>Spark mosaic</title>` +
    `<desc>Transparent, print-ready spark mosaic with editable vector marks.</desc>` +
    `<defs><clipPath id="artwork-panels">${clipRects}</clipPath></defs>` +
    `<g clip-path="url(#artwork-panels)">${sourceLayer}${sparkLayer}</g>` +
    `</svg>`;

  downloadBlob(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    `${safeBaseName()}-spark-mosaic.svg`,
  );
  setStatus(`SVG exported • ${marks.length.toLocaleString()} editable sparks`);
}

async function exportArtwork() {
  const dimensions = getExportDimensions();
  if (
    !dimensions?.valid ||
    (dimensions.tooLarge && elements.exportFormat.value === "png")
  ) {
    updateExportDetails();
    return;
  }

  try {
    if (elements.exportFormat.value === "svg") exportSvg(dimensions);
    else await exportPrintPng(dimensions);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Export failed", true);
  } finally {
    updateExportDetails();
  }
}

function isFileDrag(event) {
  return Array.from(event.dataTransfer?.types || []).includes("Files");
}

function bindEvents() {
  elements.uploadButton.addEventListener("click", openFilePicker);
  elements.replaceButton.addEventListener("click", openFilePicker);
  elements.fileInput.addEventListener("change", () => loadFile(elements.fileInput.files?.[0]));
  elements.exportButton.addEventListener("click", exportArtwork);
  elements.resetButton.addEventListener("click", resetTreatment);
  elements.exportFormat.addEventListener("change", updateExportDetails);
  elements.printWidth.addEventListener("input", updateExportDetails);

  [
    elements.density,
    elements.sparkScale,
    elements.sourceOpacity,
    elements.colorMode,
    elements.contrast,
    elements.dither,
    elements.gridColumns,
    elements.gridRows,
    elements.gutter,
    elements.showSparks,
    elements.showSource,
    elements.showGrid,
  ].forEach((input) => {
    input.addEventListener("input", () => {
      updateControlLabels();
      scheduleRender();
    });
  });

  document.querySelectorAll(".color-swatch").forEach((swatch) => {
    swatch.style.setProperty("--swatch-color", swatch.dataset.color);
    swatch.addEventListener("click", () => setPreviewBackground(swatch.dataset.color));
  });

  elements.previewBackground.addEventListener("input", () => {
    setPreviewBackground(elements.previewBackground.value);
  });

  window.addEventListener("dragenter", (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth += 1;
    elements.stage.classList.add("is-dragging");
  });

  window.addEventListener("dragover", (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  });

  window.addEventListener("dragleave", (event) => {
    if (!isFileDrag(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) elements.stage.classList.remove("is-dragging");
  });

  window.addEventListener("drop", (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth = 0;
    elements.stage.classList.remove("is-dragging");
    loadFile(event.dataTransfer?.files?.[0]);
  });

  window.addEventListener("beforeunload", () => {
    if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
  });
}

updateControlLabels();
setPreviewBackground(DEFAULTS.previewBackground);
setControlsEnabled(false);
bindEvents();
loadSparkPath();
