import { useEffect, useState } from "react";
import { BookOpenCheck, ShieldCheck, X } from "lucide-react";
import type { DashboardEvidence } from "@shuanglong/contracts";
import { EvidenceList } from "./EvidenceList";
import "./evidence.css";

interface EvidenceDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  evidence: DashboardEvidence[];
}

export function EvidenceDrawer({ open, onClose, title, evidence }: EvidenceDrawerProps) {
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (!visible) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  });

  function close() {
    setVisible(false);
    onClose();
  }

  return (
    <>
      <button className="evidence-trigger" type="button" onClick={() => setVisible(true)} aria-label="查看依据">
        <BookOpenCheck size={14} />查看依据<span>{evidence.length}</span>
      </button>
      {visible ? (
        <div className="drawer-layer">
          <button className="drawer-scrim" type="button" onClick={close} aria-label="点击遮罩关闭" tabIndex={-1} />
          <aside className="evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="evidence-title">
            <header className="evidence-head">
              <div><span className="section-kicker">SOURCE TRACE</span><h2 id="evidence-title">{title}</h2><p>仅展示与经营结论直接相关的摘要字段</p></div>
              <button className="drawer-close" type="button" onClick={close} aria-label="关闭依据"><X size={19} /></button>
            </header>
            <div className="privacy-note"><ShieldCheck size={16} /><span><strong>隐私保护</strong>原始消息与隐藏元数据不会在工作台直接展示。</span></div>
            <EvidenceList evidence={evidence} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
