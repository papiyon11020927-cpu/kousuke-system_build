import { useState, useMemo, useRef, useEffect } from 'react';
import { LucideSearch, LucideX, LucideChevronDown } from 'lucide-react';
import type { Customer, Project } from '@/types';

// ─────────────────────────────────────────────────────────────
// 案件の曖昧検索ユーティリティ
// ─────────────────────────────────────────────────────────────

const norm = (s: string) => s.toLowerCase().normalize('NFKC');

function matchScore(query: string, project: Project, customerName: string): number {
  const q = norm(query);
  if (!q) return 0;
  const title = norm(project.title);
  const cust  = norm(customerName);
  if (title.startsWith(q) || cust.startsWith(q)) return 3;
  if (title.includes(q)  || cust.includes(q))    return 2;
  // 文字単位の部分一致（順序維持の緩いあいまい検索）
  let qi = 0;
  const hay = `${title}${cust}`;
  for (const ch of hay) { if (ch === q[qi]) qi++; if (qi >= q.length) return 1; }
  return 0;
}

function searchProjects(query: string, projects: Project[], customers: Customer[]): Project[] {
  const custName = (id: string) => customers.find(c => c.customerId === id)?.name ?? '';
  if (!query.trim()) return projects;
  return projects
    .map(p => ({ p, score: matchScore(query, p, custName(p.customerId)) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(r => r.p);
}

// ─────────────────────────────────────────────────────────────
// 全件検索モーダル（件数が多い場合用）
// ─────────────────────────────────────────────────────────────

function ProjectSearchModal({ projects, customers, onSelect, onClose }: {
  projects: Project[]; customers: Customer[];
  onSelect: (p: Project) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchProjects(query, projects, customers), [query, projects, customers]);
  const custName = (id: string) => customers.find(c => c.customerId === id)?.name ?? '';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111A35] border border-[#C5A059]/30 rounded-xl w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col">
        <div className="bg-[#0B132B] px-5 py-3 border-b border-[#C5A059]/20 flex justify-between items-center rounded-t-xl shrink-0">
          <h3 className="text-sm font-bold text-white">案件を検索</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><LucideX size={16} /></button>
        </div>
        <div className="p-3 border-b border-gray-800 shrink-0">
          <div className="relative">
            <LucideSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text" autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="案件名・顧客名で検索"
              className="w-full bg-[#0B132B] border border-gray-700 text-white text-sm rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-[#C5A059]"
            />
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-gray-600">該当する案件がありません</div>
          ) : results.map(p => (
            <button key={p.projectId} type="button" onClick={() => onSelect(p)}
              className="w-full text-left px-4 py-2.5 border-b border-gray-800/60 hover:bg-[#1C284D]/60 transition">
              <div className="text-sm text-white font-semibold truncate">{p.title}</div>
              <div className="text-[11px] text-gray-500 truncate">{custName(p.customerId)}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ProjectPicker — コンボボックス（曖昧検索）+ 全件検索モーダルのハイブリッド
// ─────────────────────────────────────────────────────────────

interface Props {
  projects: Project[];
  customers: Customer[];
  projectId: string;
  onSelect: (project: Project | null) => void;
  /** true の場合、入力UIを出さずに選択済みラベルのみ表示（案件詳細からの自動選択時など） */
  locked?: boolean;
  placeholder?: string;
}

export default function ProjectPicker({ projects, customers, projectId, onSelect, locked, placeholder = '案件名・顧客名で検索' }: Props) {
  const [query,      setQuery]      = useState('');
  const [isOpen,     setIsOpen]     = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const custName = (id: string) => customers.find(c => c.customerId === id)?.name ?? '';
  const selected = projects.find(p => p.projectId === projectId) ?? null;

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const results = useMemo(
    () => searchProjects(query, projects, customers).slice(0, 8),
    [query, projects, customers],
  );

  const handlePick = (p: Project | null) => {
    onSelect(p);
    setQuery('');
    setIsOpen(false);
    setShowModal(false);
  };

  if (locked && selected) {
    return (
      <div className="flex items-center justify-between bg-[#0B132B] border border-gray-700 rounded-lg px-3 py-2">
        <div className="min-w-0">
          <div className="text-xs text-white font-semibold truncate">{selected.title}</div>
          <div className="text-[10px] text-gray-500 truncate">{custName(selected.customerId)}</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      {selected && !isOpen ? (
        <button type="button" onClick={() => setIsOpen(true)}
          className="w-full flex items-center justify-between bg-[#0B132B] border border-gray-700 rounded-lg px-3 py-2 text-left hover:border-[#C5A059]/50 transition">
          <div className="min-w-0">
            <div className="text-xs text-white font-semibold truncate">{selected.title}</div>
            <div className="text-[10px] text-gray-500 truncate">{custName(selected.customerId)}</div>
          </div>
          <LucideChevronDown size={14} className="text-gray-500 shrink-0" />
        </button>
      ) : (
        <div className="relative">
          <LucideSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text" value={query} autoFocus={isOpen}
            onFocus={() => setIsOpen(true)}
            onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
            placeholder={placeholder}
            className="w-full bg-[#0B132B] border border-gray-700 text-white text-xs rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:border-[#C5A059]"
          />
        </div>
      )}

      {isOpen && (
        <div className="absolute z-30 mt-1 w-full bg-[#111A35] border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          {selected && (
            <button type="button" onClick={() => handlePick(null)}
              className="w-full text-left px-3 py-2 text-[11px] text-red-400 hover:bg-[#1C284D]/60 border-b border-gray-800 flex items-center gap-1.5">
              <LucideX size={11} /> 選択を解除
            </button>
          )}
          <div className="max-h-56 overflow-y-auto">
            {results.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-gray-600">該当する案件がありません</div>
            ) : results.map(p => (
              <button key={p.projectId} type="button" onClick={() => handlePick(p)}
                className="w-full text-left px-3 py-2 hover:bg-[#1C284D]/60 transition border-b border-gray-800/60 last:border-0">
                <div className="text-xs text-white font-semibold truncate">{p.title}</div>
                <div className="text-[10px] text-gray-500 truncate">{custName(p.customerId)}</div>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setShowModal(true)}
            className="w-full text-center px-3 py-2 text-[11px] text-[#E6C687] hover:bg-[#1C284D]/60 border-t border-gray-800 transition">
            🔍 全件から探す（{projects.length}件）
          </button>
        </div>
      )}

      {showModal && (
        <ProjectSearchModal
          projects={projects} customers={customers}
          onSelect={handlePick}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
