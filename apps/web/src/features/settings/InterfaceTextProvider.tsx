import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { interfaceTextCatalog } from "./interfaceText";
type TextContextValue = { values: Record<string, string>; setValues: (values: Record<string, string>) => void; loading: boolean };
const TextContext = createContext<TextContextValue>({ values: {}, setValues: () => undefined, loading: true });
export function InterfaceTextProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<Record<string, string>>({}); const [loading, setLoading] = useState(true);
  const originalTexts = useRef(new WeakMap<Node, string>());
  useEffect(() => { const load=()=>fetch("/api/settings/texts").then(async r => { if (r.ok) setValues((await r.json()).values ?? {}); }).finally(() => setLoading(false));void load();window.addEventListener("sl-auth-changed",load);return()=>window.removeEventListener("sl-auth-changed",load); }, []);
  const replacements = useMemo(() => new Map(interfaceTextCatalog.flatMap(item => values[item.key] && values[item.key] !== item.defaultValue ? [[item.defaultValue, values[item.key]] as const] : [])), [values]);
  useEffect(() => { const defaults=new Set(interfaceTextCatalog.map(item=>item.defaultValue));const update=(root:Node)=>{const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node:Node|null;while((node=walker.nextNode())){const shown=node.textContent?.trim();if(!shown)continue;const original=originalTexts.current.get(node)??shown;if(defaults.has(original))originalTexts.current.set(node,original);const desired=replacements.get(original)??original;if(node.textContent&&shown!==desired)node.textContent=node.textContent.replace(shown,desired)}};update(document.body);const observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(update)));observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect(); }, [replacements]);
  return <TextContext.Provider value={{values,setValues,loading}}>{children}</TextContext.Provider>;
}
export const useInterfaceTexts=()=>useContext(TextContext);
