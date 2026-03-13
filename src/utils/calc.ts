export type ServiceLevel = 1.65 | 0.53;

export type CalcInput = {
  serviceFactor: ServiceLevel;
  leadTime: number;      // 日（数値）
  orderInterval: number; // 日（数値）
  quantities: number[];  // 週次使用量（空欄は0に変換済）
  useOutlierFilter?: boolean; // ★追加：外れ値除外 ON/OFF（未指定はON扱い）
};

function median(nums: number[]): number {
  const a = [...nums].sort((x, y) => x - y);
  const n = a.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (a[mid - 1] + a[mid]) / 2 : a[mid];
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, x) => s + x, 0) / nums.length;
}

// 母標準偏差（÷n）
function stdDevPopulation(nums: number[]): number {
  if (nums.length === 0) return 0;
  const m = mean(nums);
  const v = nums.reduce((s, x) => s + (x - m) ** 2, 0) / nums.length;
  return Math.sqrt(v);
}

/**
 * MADベースの外れ値除外
 * modified z = 0.6745 * (x - median) / MAD
 * |z| > 3.5 を外れ値扱い
 */
export function removeOutliersMAD(values: number[], threshold = 3.5): {
  cleaned: number[];
  excluded: { index: number; value: number }[];
} {
  if (values.length < 3) return { cleaned: values, excluded: [] };

  const med = median(values);
  const absDevs = values.map(v => Math.abs(v - med));
  const mad = median(absDevs);

  if (mad === 0) {
    return { cleaned: values, excluded: [] };
  }

  const excluded: { index: number; value: number }[] = [];
  const cleaned: number[] = [];

  values.forEach((v, i) => {
    const mz = (0.6745 * (v - med)) / mad;
    if (Math.abs(mz) > threshold) excluded.push({ index: i, value: v });
    else cleaned.push(v);
  });

  if (cleaned.length === 0) return { cleaned: values, excluded: [] };

  return { cleaned, excluded };
}

/**
 * 計算仕様（B方式：週のブレ基準）
 * - 安全在庫 = Z × SD(週) × sqrt((LT+間隔)/7)
 * - ROP = 平均日販 × LT(日) + 安全在庫
 * - 目標在庫（適正在庫）= ROP + 平均日販 × 発注間隔(日)
 */
export function calcStock(input: CalcInput) {
  const { serviceFactor, leadTime, orderInterval, quantities } = input;
  const useOutlierFilter = input.useOutlierFilter ?? true;

  const ltDays = Math.max(0, leadTime);
  const intervalDays = Math.max(0, orderInterval);
  const totalDays = ltDays + intervalDays;
  const periodWeeks = totalDays / 7;

  const outlierResult = useOutlierFilter
    ? removeOutliersMAD(quantities)
    : { cleaned: quantities, excluded: [] as { index: number; value: number }[] };

  const cleaned = outlierResult.cleaned;
  const excluded = outlierResult.excluded;

  const avgWeekly = mean(cleaned);
  const sdWeekly = stdDevPopulation(cleaned);
  const avgDaily = avgWeekly / 7;

  const safetyStock =
    periodWeeks <= 0 ? 0 : serviceFactor * sdWeekly * Math.sqrt(periodWeeks);

  const reorderPoint = avgDaily * ltDays + safetyStock;
  const targetStock = reorderPoint + avgDaily * intervalDays;

  return {
    cleaned,
    excluded,

    avgWeekly,
    sdWeekly,
    avgDaily,

    periodWeeks,

    safetyStock,
    reorderPoint,
    targetStock
  };
}