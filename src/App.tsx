import React, { useMemo, useState } from "react";
import { calcStock } from "./utils/calc";
import type { ServiceLevel } from "./utils/calc";

const LABELS_BASE = ["-3週の使用量", "-2週の使用量", "-1週の使用量", "当週の使用量"] as const;
const LABELS_LAST = ["同週の使用量", "+1週の使用量", "+2週の使用量", "+3週の使用量"] as const;

function toNumberOrZero(s: string): number {
  const t = s.trim();
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round0(n: number) {
  return Math.round(n);
}

export default function App() {
  const [serviceFactor, setServiceFactor] = useState<ServiceLevel>(1.65);
  const [leadTime, setLeadTime] = useState<string>("");
  const [orderInterval, setOrderInterval] = useState<string>("");
  const [showLastYear, setShowLastYear] = useState(false);
  const [qty, setQty] = useState<string[]>(["", "", "", "", "", "", "", ""]);

  const labels = useMemo(() => {
    const base = [...LABELS_BASE];
    const last = showLastYear ? [...LABELS_LAST] : [];
    return [...base, ...last];
  }, [showLastYear]);

  const quantitiesForCalc = useMemo(() => {
    const sliceLen = showLastYear ? 8 : 4;
    return qty.slice(0, sliceLen).map(toNumberOrZero);
  }, [qty, showLastYear]);

  const calc = useMemo(() => {
    return calcStock({
      serviceFactor,
      leadTime: toNumberOrZero(leadTime),
      orderInterval: toNumberOrZero(orderInterval),
      quantities: quantitiesForCalc
    });
  }, [serviceFactor, leadTime, orderInterval, quantitiesForCalc]);

  const excludedNames = useMemo(() => {
    const sliceLen = showLastYear ? 8 : 4;
    const allLabels = [...LABELS_BASE, ...LABELS_LAST].slice(0, sliceLen);
    return calc.excluded.map(e => allLabels[e.index]);
  }, [calc.excluded, showLastYear]);

  const onClearQuantities = () => setQty(["", "", "", "", "", "", "", ""]);

  const levelLabel =
    serviceFactor === 1.65
      ? { text: "Aランク:5%（1.65）", cls: "badge badgeA" }
      : { text: "Cランク:30%（0.53）", cls: "badge badgeC" };

  return (
    <div className="page">
      <header className="header">
        <div className="title">適正在庫 計算</div>
        <div className="subtitle">結論（適正在庫）を最優先表示</div>
      </header>

      <section className="card">
        <div className="row">
          <label className="label">
            安全係数（サービス水準）
            <span className={levelLabel.cls}>{levelLabel.text}</span>
          </label>
          <select
            className="select"
            value={String(serviceFactor)}
            onChange={(e) => setServiceFactor(Number(e.target.value) as ServiceLevel)}
          >
            <option value="1.65">Aランク:5%（1.65）</option>
            <option value="0.53">Cランク:30%（0.53）</option>
          </select>
        </div>

        <div className="grid2">
          <div className="row">
            <label className="label">発注リードタイム（日）</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder="例：3"
              value={leadTime}
              onChange={(e) => setLeadTime(e.target.value)}
            />
          </div>

          <div className="row">
            <label className="label">発注間隔（日）</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder="例：7"
              value={orderInterval}
              onChange={(e) => setOrderInterval(e.target.value)}
            />
          </div>
        </div>

        <div className="actions">
          <button className="btn" onClick={() => setShowLastYear(v => !v)}>
            {showLastYear ? "昨年データ入力欄を隠す" : "昨年の売上データ入力を追加"}
          </button>

          <button className="btn btnGhost" onClick={onClearQuantities}>
            売上数量を削除（クリア）
          </button>
        </div>
      </section>

      <section className="card">
        <div className="sectionTitle">売上数量（週次）</div>
        <div className="inputs">
          {labels.map((lab, i) => (
            <div className="row" key={lab}>
              <label className="label">{lab}</label>
              <input
                className="input"
                inputMode="numeric"
                placeholder="空欄は0として計算"
                value={qty[i]}
                onChange={(e) => {
                  const next = [...qty];
                  next[i] = e.target.value;
                  setQty(next);
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="sectionTitle">計算結果</div>

        <div className="result">
          <div className="hero">
            <div className="heroTop">
              <div className="heroLabel">適正在庫（目標在庫）</div>
              <div className="heroNumber">{round0(calc.targetStock)}</div>
            </div>
          </div>

          {/* ROPは“注意”として枠線を強める（色は増やさず濃淡で） */}
          <div className="resultRow resultWarn">
            <div className="resultLabel">発注点（ROP）</div>
            <div className="resultValue">{round0(calc.reorderPoint)}</div>
          </div>

          <div className="resultRow">
            <div className="resultLabel">安全在庫</div>
            <div className="resultValue">{round1(calc.safetyStock)}</div>
          </div>
        </div>

        <div className="meta">
          <div className="metaLine">
            平均日販：<b>{round1(calc.avgDaily)}</b>（週平均：<b>{round1(calc.avgWeekly)}</b>）
          </div>
          <div className="metaLine">
            標準偏差（週）：<b>{round1(calc.sdWeekly)}</b> / 期間：<b>{round1(calc.periodWeeks)}</b>週
          </div>
          <div className="metaLine">
            外れ値除外：{excludedNames.length === 0 ? "なし" : excludedNames.join("、")}
          </div>
          <div className="smallNote">
            ヒント：在庫が「発注点（ROP）」を下回ったら発注。発注後は「適正在庫（目標在庫）」を目安に補充量を調整。
          </div>
        </div>
      </section>
    </div>
  );
}