// React UI components for ghminer.
// UMD-style: works in browser (window.GhMinerComponents) and Node/Jest (module.exports).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('react'), require('./core.js'));
  } else {
    root.GhMinerComponents = factory(root.React, root.GhMinerCore);
  }
}(typeof self !== 'undefined' ? self : this, function (React, Core) {
  const { useState, useRef, useMemo, useEffect } = React;
  const {
    BUCKET_ORDER, langIcon, escapeHtml, formatSize,
    parseHierarchicalQuery, applyTsNodeFilter,
  } = Core;

  const MAX_ITEMS_PER_TYPE = 10;

  // ── LangIcon ───────────────────────────────────────────────────────────────

  function LangIcon({ name, className = '' }) {
    const cls = langIcon(name);
    if (!cls) return null;
    return React.createElement('i', { className: `${cls} ${className}`, 'aria-hidden': 'true' });
  }

  // ── StatCard ───────────────────────────────────────────────────────────────

  function StatCard({ label, value }) {
    return (
      <div className="stat-card">
        <span className="stat-card__label">{label}</span>
        <span className="stat-card__value">{value}</span>
      </div>
    );
  }

  // ── SectionHeading ─────────────────────────────────────────────────────────

  function SectionHeading({ children }) {
    return <h2 className="section-heading">{children}</h2>;
  }

  // ── Section ────────────────────────────────────────────────────────────────

  function Section({ title, defaultOpen = true, children }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="section-toggle"
          aria-expanded={open}
        >
          <span className={`section-arrow${open ? ' open' : ''}`}>▶</span>
          <span>{title}</span>
        </button>
        {open && <div>{children}</div>}
      </div>
    );
  }

  // ── BarChartCSS ────────────────────────────────────────────────────────────

  function BarChartCSS({ data, valueKey, labelKey, colors, formatValue }) {
    const max = Math.max(...data.map(d => d[valueKey]), 1);
    return (
      <div className="bar-chart">
        {data.map((d, i) => (
          <div key={d[labelKey]} className="bar-chart__row">
            <span className="bar-chart__label">{d[labelKey]}</span>
            <div className="bar-chart__track">
              <div
                className="bar-chart__fill"
                style={{
                  width: `${(d[valueKey] / max) * 100}%`,
                  backgroundColor: Array.isArray(colors) ? colors[i % colors.length] : colors,
                }}
              />
            </div>
            <span className="bar-chart__value">{formatValue ? formatValue(d[valueKey]) : d[valueKey].toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }

  // ── TopBar ─────────────────────────────────────────────────────────────────

  function TopBar({ onHome }) {
    return (
      <div className="top-bar">
        <button
          onClick={onHome}
          title="Home"
          aria-label="Home"
          className="top-bar-btn"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12L12 3l9 9" />
            <path d="M5 10v10h14V10" />
          </svg>
          Home
        </button>
        <a
          href="https://github.com/andrehora/ghminer"
          target="_blank"
          rel="noopener noreferrer"
          title="ghminer on GitHub"
          className="top-bar-btn"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.27-.01-1-.02-1.96-3.2.69-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.67.8.56C20.71 21.39 24 17.08 24 12 24 5.65 18.85.5 12 .5z" />
          </svg>
          ghminer
        </a>
      </div>
    );
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  function Header() {
    return (
      <div className="app-header">
        <h1 className="app-header__title">
          <span className="accent">gh</span>miner
        </h1>
        <p className="app-header__tagline">Analyze GitHub repositories</p>
      </div>
    );
  }

  // ── RepoInput ──────────────────────────────────────────────────────────────

  function RepoInput({ url, onUrlChange, onSubmit, error, disabled, repoList }) {
    const [suggestions, setSuggestions] = useState([]);
    const [suggestionIndex, setSuggestionIndex] = useState(-1);
    const suggestionsRef = useRef(null);

    const selectSuggestion = (name) => {
      onUrlChange('https://github.com/' + name);
      setSuggestions([]);
      setSuggestionIndex(-1);
    };

    return (
      <div className="repo-input">
        <div className="repo-input__row">
          <div className="repo-input__field-wrap">
            <input
              className="repo-input__field"
              placeholder="https://github.com/user/repo"
              value={url}
              onChange={e => {
                const val = e.target.value;
                onUrlChange(val);
                setSuggestionIndex(-1);
                if (val.length < 2) { setSuggestions([]); return; }
                const q = val.replace(/^https?:\/\/github\.com\//i, '').toLowerCase();
                setSuggestions(repoList.filter(r => r.name.toLowerCase().includes(q)).slice(0, 8));
              }}
              onKeyDown={e => {
                if (suggestions.length > 0) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestionIndex(i => Math.min(i + 1, suggestions.length - 1)); return; }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestionIndex(i => Math.max(i - 1, -1)); return; }
                  if (e.key === 'Enter' && suggestionIndex >= 0) { e.preventDefault(); selectSuggestion(suggestions[suggestionIndex].name); return; }
                  if (e.key === 'Escape') { setSuggestions([]); setSuggestionIndex(-1); return; }
                }
                if (e.key === 'Enter') onSubmit();
              }}
              onBlur={() => setTimeout(() => setSuggestions([]), 150)}
              disabled={disabled}
            />
            {suggestions.length > 0 && (
              <ul ref={suggestionsRef} className="autocomplete">
                {suggestions.map((s, i) => (
                  <li
                    key={s.name}
                    className={`autocomplete__item${i === suggestionIndex ? ' active' : ''}`}
                    onMouseDown={() => selectSuggestion(s.name)}
                  >
                    <span>{s.name}</span>
                    {s.language && (
                      <span className="autocomplete__lang">
                        {s.language}
                        <LangIcon name={s.language} className="icon-base" />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button onClick={onSubmit} className="btn-primary">Analyze</button>
        </div>
        {error && <p className="repo-input__error">{error}</p>}
      </div>
    );
  }

  // ── LoadingProgress ────────────────────────────────────────────────────────

  function LoadingProgress({ phase, progress, onCancel }) {
    return (
      <div className="loading">
        {phase === 'loading' ? (
          <>
            <p className="loading__text">
              Fetching {progress.done.toLocaleString()} / {progress.total.toLocaleString()} files…
            </p>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%' }}
              />
            </div>
          </>
        ) : (
          <p className="loading__text">Parsing source files with tree-sitter…</p>
        )}
        <button onClick={onCancel} className="btn-cancel">Cancel</button>
      </div>
    );
  }

  // ── Results ────────────────────────────────────────────────────────────────

  function Results({ result, repoInfo, errors, tsResults, tsError }) {
    const { totalFiles, totalLines, totalSize, avgSize, languages, top10, buckets } = result;
    const [nodeQuery, setNodeQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [showAllTypes, setShowAllTypes] = useState(false);
    const [errorsDismissed, setErrorsDismissed] = useState(false);
    const [activeLangId, setActiveLangId] = useState(tsResults[0]?.id || '');
    const nodeInputRef = useRef(null);
    const [nodeSugIndex, setNodeSugIndex] = useState(-1);
    const nodeSugRef = useRef(null);

    useEffect(() => {
      if (nodeSugIndex >= 0 && nodeSugRef.current) {
        const item = nodeSugRef.current.children[nodeSugIndex];
        if (item) item.scrollIntoView({ block: 'nearest' });
      }
    }, [nodeSugIndex]);

    useEffect(() => {
      const t = setTimeout(() => setDebouncedQuery(nodeQuery), 150);
      return () => clearTimeout(t);
    }, [nodeQuery]);

    useEffect(() => {
      setNodeQuery('');
      setShowAllTypes(false);
      if (tsResults.length > 0 && !tsResults.some(r => r.id === activeLangId)) {
        setActiveLangId(tsResults[0].id);
      }
    }, [tsResults]);

    const activeLang = tsResults.find(r => r.id === activeLangId) || tsResults[0];
    const tsNodes = activeLang ? activeLang.nodes : [];
    const activeLangError = activeLang ? activeLang.error : '';

    const customNodeTypes = new Set(tsNodes.filter(n => n.custom).map(n => n.type));
    const builtInNodes = tsNodes.filter(n => !n.custom);
    const customNodes = tsNodes.filter(n => n.custom);
    const allNodeTypes = builtInNodes.map(n => n.type);
    const topNodeTypes = showAllTypes ? allNodeTypes : allNodeTypes.slice(0, 15);
    const hiddenCount = allNodeTypes.length - 15;

    const badgeTypes = useMemo(() => {
      const parts = nodeQuery.split(':');
      const types = [];
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i].trim();
        if (part && tsNodes.some(n => n.typeLower === part.toLowerCase())) {
          types.push(parts[i]);
        } else {
          break;
        }
      }
      return types;
    }, [nodeQuery, tsNodes]);

    const inputText = badgeTypes.length > 0
      ? nodeQuery.slice(badgeTypes.join(':').length + 1)
      : nodeQuery;

    const typeSuggestions = useMemo(() => {
      if (!inputText.startsWith('/')) return [];
      const prefix = inputText.slice(1).trim().toLowerCase();
      return tsNodes
        .filter(n => !prefix || n.typeLower.startsWith(prefix))
        .map(n => ({ type: n.type, count: n.count, custom: n.custom }))
        .sort((a, b) => b.count - a.count);
    }, [inputText, tsNodes]);
    const typeSuggestion = typeSuggestions[0]?.type || '';

    const handleInputChange = (e) => {
      const v = e.target.value;
      const prefix = badgeTypes.length > 0 ? badgeTypes.join(':') + ':' : '';
      setNodeQuery(prefix + v);
      setNodeSugIndex(-1);
    };

    const selectNodeSuggestion = (type) => {
      const prefix = badgeTypes.length > 0 ? badgeTypes.join(':') + ':' : '';
      setNodeQuery(prefix + type + ':');
      setNodeSugIndex(-1);
      if (nodeInputRef.current) nodeInputRef.current.focus();
    };

    const handleNodeQueryKeyDown = (e) => {
      if (typeSuggestions.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setNodeSugIndex(i => Math.min(i + 1, typeSuggestions.length - 1)); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setNodeSugIndex(i => Math.max(i - 1, -1)); return; }
        if (e.key === 'Enter' && nodeSugIndex >= 0) { e.preventDefault(); selectNodeSuggestion(typeSuggestions[nodeSugIndex].type); return; }
        if (e.key === 'Tab' && typeSuggestion) { e.preventDefault(); selectNodeSuggestion(typeSuggestion); return; }
        if (e.key === 'Escape') {
          e.preventDefault();
          const prefix = badgeTypes.length > 0 ? badgeTypes.join(':') + ':' : '';
          setNodeQuery(prefix);
          setNodeSugIndex(-1);
          return;
        }
      }
      if (e.key === 'Backspace' && badgeTypes.length > 0 && e.target.selectionStart === 0 && e.target.selectionEnd === 0) {
        e.preventDefault();
        const remaining = badgeTypes.slice(0, -1);
        const prefix = remaining.length > 0 ? remaining.join(':') + ':' : '';
        setNodeQuery(prefix + inputText);
      }
    };

    const removeBadge = (index) => {
      const remaining = badgeTypes.filter((_, i) => i !== index);
      const prefix = remaining.length > 0 ? remaining.join(':') + ':' : '';
      setNodeQuery(prefix + inputText);
      if (nodeInputRef.current) nodeInputRef.current.focus();
    };

    const bucketData = BUCKET_ORDER.map(b => ({ name: b, count: buckets[b] || 0 }));

    const HLJS_LANG = { javascript: 'javascript', typescript: 'typescript', tsx: 'typescript', python: 'python' };

    const highlightCode = (code, langId, query) => {
      const hljsLang = HLJS_LANG[langId];
      let html;
      if (hljsLang && typeof window !== 'undefined' && window.hljs && window.hljs.getLanguage(hljsLang)) {
        try {
          html = window.hljs.highlight(code, { language: hljsLang, ignoreIllegals: true }).value;
        } catch {
          html = escapeHtml(code);
        }
      } else {
        html = escapeHtml(code);
      }
      if (!query) return html;
      const container = document.createElement('div');
      container.innerHTML = html;
      const lowerQ = query.toLowerCase();
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
      const textNodes = [];
      let n;
      while ((n = walker.nextNode())) textNodes.push(n);
      for (const node of textNodes) {
        const text = node.nodeValue;
        const lower = text.toLowerCase();
        let i = 0, idx;
        if ((idx = lower.indexOf(lowerQ)) === -1) continue;
        const frag = document.createDocumentFragment();
        while (idx !== -1) {
          if (idx > i) frag.appendChild(document.createTextNode(text.slice(i, idx)));
          const mark = document.createElement('mark');
          mark.className = 'hl-match';
          mark.textContent = text.slice(idx, idx + query.length);
          frag.appendChild(mark);
          i = idx + query.length;
          idx = lower.indexOf(lowerQ, i);
        }
        if (i < text.length) frag.appendChild(document.createTextNode(text.slice(i)));
        node.parentNode.replaceChild(frag, node);
      }
      return container.innerHTML;
    };

    const filteredNodes = useMemo(() => {
      const raw = debouncedQuery.trim().toLowerCase();
      if (!raw) {
        return tsNodes.map(n => {
          const first = n.sources[0] || { text: '', file: '' };
          return { ...n, items: [first], matches: n.count };
        });
      }
      const { filterTypes, textQ } = parseHierarchicalQuery(raw, tsNodes);
      return applyTsNodeFilter(tsNodes, filterTypes, textQ, MAX_ITEMS_PER_TYPE);
    }, [tsNodes, debouncedQuery]);

    return (
      <div className="results">
        {repoInfo && (
          <div className="results__repo-header">
            <LangIcon name={repoInfo.user} className="icon-lg" />
            <a
              href={`https://github.com/${repoInfo.user}/${repoInfo.repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="results__repo-link"
            >
              <span className="repo-user">{repoInfo.user}</span>
              <span className="repo-sep">/</span>
              <span>{repoInfo.repo}</span>
            </a>
          </div>
        )}
        <Section title="Overview" defaultOpen={false}>
          <div className="stat-grid">
            <StatCard label="Files" value={totalFiles.toLocaleString()} />
            <StatCard label="Lines of Code" value={totalLines.toLocaleString()} />
            <StatCard label="Total Size" value={formatSize(totalSize)} />
            <StatCard label="Languages" value={languages.length} />
          </div>
        </Section>

        <Section title="Language Breakdown" defaultOpen={false}>
          <div className="panel">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Language</th>
                  <th className="col-right">Files</th>
                  <th className="col-right">Lines</th>
                  <th className="col-right">%</th>
                </tr>
              </thead>
              <tbody>
                {languages.map((l) => (
                  <tr key={l.lang} className="data-table__row">
                    <td className="data-table__cell-lang">
                      <LangIcon name={l.lang} className="icon-cell" />
                      {l.lang}
                    </td>
                    <td className="data-table__cell text-right">{l.files.toLocaleString()}</td>
                    <td className="data-table__cell text-right">{l.lines.toLocaleString()}</td>
                    <td className="data-table__cell text-right">{l.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="File Size Distribution" defaultOpen={false}>
          <div className="two-col-grid">
            <div className="panel-padded">
              <p className="panel-label">Files by size bucket</p>
              <BarChartCSS
                data={bucketData}
                valueKey="count"
                labelKey="name"
                colors="#FE4A60"
                formatValue={v => `${v} files`}
              />
            </div>
            <div className="panel-padded">
              <p className="panel-label">Average file size: <strong>{formatSize(avgSize)}</strong></p>
              <p className="panel-label">Largest files (top 10)</p>
              <ol className="file-list">
                {top10.map((f, i) => (
                  <li key={f.path} className="file-list__item">
                    <span className="file-list__name" title={f.path}>
                      <span className="file-list__rank">{i + 1}.</span>{f.path.split('/').pop()}
                    </span>
                    <span className="file-list__size">{formatSize(f.size)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Section>

        {tsError && (
          <div className="alert-warning">
            <p className="alert-warning__text">{tsError}</p>
          </div>
        )}

        {tsResults.length > 0 && (
          <Section title="AST Node Types (tree-sitter)">
            {tsResults.length > 1 && (
              <div className="lang-tabs">
                {tsResults.map(r => {
                  const active = r.id === activeLang?.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setActiveLangId(r.id)}
                      className={`lang-tab${active ? ' active' : ''}`}
                    >
                      <LangIcon name={r.label} className="icon-xs" />
                      {r.label} <span className="tab-count">({r.fileCount})</span>
                    </button>
                  );
                })}
              </div>
            )}
            {activeLangError && (
              <div className="alert-warning compact">
                <p className="alert-warning__text small">Failed to parse {activeLang.label}: {activeLangError}</p>
              </div>
            )}
            {tsNodes.length === 0 ? (
              <div className="panel-empty">
                No nodes parsed for {activeLang?.label}.
              </div>
            ) : (
              <>
                <div
                  onClick={() => nodeInputRef.current && nodeInputRef.current.focus()}
                  className="node-filter"
                >
                  {badgeTypes.map((bt, idx) => (
                    <span
                      key={idx}
                      className={`node-badge ${customNodeTypes.has(bt) ? 'custom' : 'builtin'}`}
                    >
                      {bt}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeBadge(idx); }}
                        className="node-badge__remove"
                        aria-label="Remove node type filter"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    ref={nodeInputRef}
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={handleNodeQueryKeyDown}
                    onBlur={() => setTimeout(() => {
                      if (inputText.startsWith('/')) {
                        const prefix = badgeTypes.length > 0 ? badgeTypes.join(':') + ':' : '';
                        setNodeQuery(prefix);
                      }
                      setNodeSugIndex(-1);
                    }, 150)}
                    placeholder={badgeTypes.length > 0 ? 'Filter text or type / to add another node type…' : 'Search text or type / to filter by node type…'}
                    className="node-filter__input"
                  />
                  {typeSuggestions.length > 0 && (
                    <ul ref={nodeSugRef} className="node-suggestions">
                      {typeSuggestions.map((s, i) => (
                        <li
                          key={s.type}
                          className={`node-suggestion${i === nodeSugIndex ? ' active' : ''}`}
                          onMouseDown={() => selectNodeSuggestion(s.type)}
                        >
                          <span className="node-suggestion__label">
                            <span className={`node-suggestion__prefix${s.custom ? ' custom' : ''}`}>/</span>
                            {s.type}
                            {s.custom && <span className="custom-tag">custom</span>}
                          </span>
                          <span className="node-suggestion__count">{s.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {customNodes.length > 0 && (
                  <div className="node-type-row top">
                    <span className="node-type-label custom">Custom Nodes:</span>
                    {customNodes.map(n => {
                      const active = badgeTypes.some(bt => bt.toLowerCase() === n.type.toLowerCase());
                      return (
                        <button
                          key={`custom-${n.type}`}
                          type="button"
                          onClick={() => {
                            if (active) {
                              const remaining = badgeTypes.filter(bt => bt.toLowerCase() !== n.type.toLowerCase());
                              const prefix = remaining.length > 0 ? remaining.join(':') + ':' : '';
                              setNodeQuery(prefix + inputText);
                            } else {
                              const prefix = badgeTypes.length > 0 ? badgeTypes.join(':') + ':' : '';
                              setNodeQuery(prefix + n.type + ':');
                            }
                            if (nodeInputRef.current) nodeInputRef.current.focus();
                          }}
                          className={`node-pill custom${active ? ' active' : ''}`}
                          title={`Custom: ${n.node} containing "${n.substring}"`}
                        >
                          {n.type}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="node-type-row bottom">
                  <span className="node-type-label builtin">Language Nodes:</span>
                  {topNodeTypes.map(t => {
                    const active = badgeTypes.some(bt => bt.toLowerCase() === t.toLowerCase());
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          if (active) {
                            const remaining = badgeTypes.filter(bt => bt.toLowerCase() !== t.toLowerCase());
                            const prefix = remaining.length > 0 ? remaining.join(':') + ':' : '';
                            setNodeQuery(prefix + inputText);
                          } else {
                            const prefix = badgeTypes.length > 0 ? badgeTypes.join(':') + ':' : '';
                            setNodeQuery(prefix + t + ':');
                          }
                          if (nodeInputRef.current) nodeInputRef.current.focus();
                        }}
                        className={`node-pill builtin${active ? ' active' : ''}`}
                      >
                        {t}
                      </button>
                    );
                  })}
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllTypes(s => !s)}
                      className="node-pill more"
                    >
                      {showAllTypes ? '− less' : `+ ${hiddenCount} more`}
                    </button>
                  )}
                </div>
                <div className="panel">
                  <table className="data-table node-table">
                    <thead>
                      <tr>
                        <th className="col-type">Node Type</th>
                        <th className="col-right col-count">Count</th>
                        <th>{debouncedQuery.trim() ? 'Results' : 'Examples'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredNodes.map(({ type, count, items, matches, custom, substring }) => {
                        const raw = debouncedQuery.trim().toLowerCase();
                        const colon = raw.indexOf(':');
                        const textQ = colon !== -1 ? raw.slice(colon + 1).trim() : raw;
                        const customSub = custom && substring ? substring.split(',')[0].trim().toLowerCase() : '';
                        const q = textQ || customSub;
                        const displayCount = raw ? matches : count;
                        const truncated = !!raw && matches > items.length;
                        const uniqueShown = new Set(items.map(it => `${it.file || ''}\0${it.text || ''}`)).size;
                        const isCustom = custom || customNodeTypes.has(type);
                        return (
                          <tr key={type} className={`data-table__row${isCustom ? ' custom' : ''}`}>
                            <td className={`data-table__cell-type${isCustom ? ' custom' : ''}`}>
                              {type}
                              {isCustom && <span className="custom-badge">custom</span>}
                            </td>
                            <td className="data-table__cell text-right">{displayCount.toLocaleString()}</td>
                            <td className="data-table__cell">
                              {truncated && (
                                <div className="node-match-info">
                                  Showing first {uniqueShown.toLocaleString()} of {matches.toLocaleString()} matches
                                </div>
                              )}
                              <div className="node-items">
                                {(() => {
                                  const groups = [];
                                  const idx = new Map();
                                  for (const it of items) {
                                    const key = it.file || '';
                                    if (!idx.has(key)) {
                                      idx.set(key, groups.length);
                                      groups.push({ file: key, texts: [], seen: new Set() });
                                    }
                                    const g = groups[idx.get(key)];
                                    const t = it.text || '';
                                    if (!g.seen.has(t)) { g.seen.add(t); g.texts.push(t); }
                                  }
                                  groups.sort((a, b) => b.texts.length - a.texts.length);
                                  return groups.map((g, gi) => (
                                    <div key={gi} className="node-group">
                                      {g.file && (
                                        <div className="node-group__header">
                                          <span className="node-group__file" title={g.file}>{g.file}</span>
                                          {g.texts.length > 1 && (
                                            <span className="node-group__count">{g.texts.length}</span>
                                          )}
                                        </div>
                                      )}
                                      <div className="node-group__texts">
                                        {g.texts.map((text, ti) => {
                                          const truncated = text.length > 200 ? text.slice(0, 200) + '…' : text;
                                          return (
                                            <pre
                                              key={ti}
                                              className="code-preview hljs"
                                              title={text}
                                              dangerouslySetInnerHTML={{ __html: highlightCode(truncated, activeLang?.id, q) }}
                                            />
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ));
                                })()}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredNodes.length === 0 && (
                        <tr>
                          <td colSpan="3" className="table-empty">No matches</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Section>
        )}

        {errors.length > 0 && !errorsDismissed && (
          <div className="alert-error">
            <button
              onClick={() => setErrorsDismissed(true)}
              aria-label="Dismiss"
              className="alert-error__dismiss"
            >
              ×
            </button>
            <p className="alert-error__title">Failed to fetch {errors.length} file(s):</p>
            <ul className="alert-error__list">
              {errors.map(e => <li key={e}>{e}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return {
    LangIcon,
    StatCard,
    SectionHeading,
    Section,
    BarChartCSS,
    TopBar,
    Header,
    RepoInput,
    LoadingProgress,
    Results,
  };
}));
