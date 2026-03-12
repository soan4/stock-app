export type ServiceLevel = 1.65 | 0.53;

export type CalcInput = {
  serviceFactor: ServiceLevel;
  leadTime: number;      // 日（数値）
  orderInterval: number; // 日（数値）
  quantities: number[];  // 週次使用量（空欄は0に変換済）
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

// 母標準偏差（÷n）。小標本でも暴れにくい
function stdDevPopulation(nums: number[]): number {
  if (nums.length === 0) return 0;
  const m = mean(nums);
  const v = nums.reduce((s, x) => s + (x - m) ** 2, 0) / nums.length;
  return Math.sqrt(v);
}

/**
 * MADベースの外れ値除外（少数データに強い）
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
    // MAD=0（全部同じ等）なら外れ値判定できないので除外なし
    return { cleaned: values, excluded: [] };
  }

  const excluded: { index: number; value: number }[] = [];
  const cleaned: number[] = [];

  values.forEach((v, i) => {
    const mz = (0.6745 * (v - med)) / mad;
    if (Math.abs(mz) > threshold) excluded.push({ index: i, value: v });
    else cleaned.push(v);
  });

  // すべて除外になるのは困るので、その場合は元に戻す
  if (cleaned.length === 0) return { cleaned: values, excluded: [] };

  return { cleaned, excluded };
}

/**
 * 計算仕様（B方式：週のブレ基準）
 * - 入力：週次使用量（4〜8点）
 * - LT/発注間隔：日
 * - 平均：単純平均（週）
 * - 安全在庫 = z × SD(週) × sqrt((LT+間隔)/7)
 * - ROP = 平均日販 × LT(日) + 安全在庫
 * - 目標在庫（適正在庫）= ROP + 平均日販 × 発注間隔(日)
 */
export function calcStock(input: CalcInput) {
  const { serviceFactor, leadTime, orderInterval, quantities } = input;

  const ltDays = Math.max(0, leadTime);
  const intervalDays = Math.max(0, orderInterval);
  const totalDays = ltDays + intervalDays;
  const periodWeeks = totalDays / 7; // 日→週換算

  const { cleaned, excluded } = removeOutliersMAD(quantities);

  // quantities は「週次使用量」
  const avgWeekly = mean(cleaned);
  const sdWeekly = stdDevPopulation(cleaned);

  // 日販（ROP・目標在庫で使う）
  const avgDaily = avgWeekly / 7;

  // B方式：週のブレで安全在庫を作る
  const safetyStock =
    periodWeeks <= 0 ? 0 : serviceFactor * sdWeekly * Math.sqrt(periodWeeks);

  // 発注点（ROP）
  const reorderPoint = avgDaily * ltDays + safetyStock;

  // 目標在庫（適正在庫として大きく表示）
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
