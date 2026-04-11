// Reusable pure functions for ghminer.
// UMD-style: works in browser (window.GhMinerCore) and Node/Jest (module.exports).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GhMinerCore = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // Single source of truth for every language ghminer knows about.
  // To add or modify a language, edit this object — everything else
  // (SOURCE_EXTENSIONS, EXT_TO_LANG, TREE_SITTER_LANGUAGES) is derived from it.
  //
  //   extensions  — file extensions (with leading dot) that map to this language
  //   treeSitter  — optional URL of the web-tree-sitter wasm grammar.
  //                 Languages with this field show up as AST tabs in the UI.
  const LANGUAGES = {
    'JavaScript': {
      extensions: ['.js', '.mjs', '.cjs', '.jsx'],
      treeSitter: 'https://cdn.jsdelivr.net/npm/tree-sitter-javascript@0.25.0/tree-sitter-javascript.wasm',
    },
    'TypeScript': {
      extensions: ['.ts'],
      treeSitter: 'https://cdn.jsdelivr.net/npm/tree-sitter-typescript@0.23.2/tree-sitter-typescript.wasm',
    },
    'TSX': {
      extensions: ['.tsx'],
      treeSitter: 'https://cdn.jsdelivr.net/npm/tree-sitter-typescript@0.23.2/tree-sitter-tsx.wasm',
    },
    'Python': {
      extensions: ['.py', '.py3'],
      treeSitter: 'https://cdn.jsdelivr.net/npm/tree-sitter-python@0.25.0/tree-sitter-python.wasm',
    },
    'Java': {
      extensions: ['.java'],
      treeSitter: 'https://cdn.jsdelivr.net/npm/tree-sitter-java@0.23.5/tree-sitter-java.wasm',
    },
    'C/C++': { extensions: ['.c', '.cpp', '.h'] },
    'C#': { extensions: ['.cs'] },
    'Ruby': { extensions: ['.rb'] },
    'Go': { extensions: ['.go'] },
    'Rust': { extensions: ['.rs'] },
    'PHP': { extensions: ['.php'] },
    'Swift': { extensions: ['.swift'] },
    'Kotlin': { extensions: ['.kt'] },
    'Scala': { extensions: ['.scala'] },
    'Shell': { extensions: ['.sh', '.bash', '.zsh'] },
    'Vue': { extensions: ['.vue'] },
    'Svelte': { extensions: ['.svelte'] },
    'CSS': { extensions: ['.css', '.scss', '.less'] },
    'HTML': { extensions: ['.html', '.htm'] },
    'XML': { extensions: ['.xml'] },
    'JSON': { extensions: ['.json'] },
    'YAML': { extensions: ['.yaml', '.yml'] },
    'TOML': { extensions: ['.toml'] },
    'Markdown': { extensions: ['.md'] },
    'SQL': { extensions: ['.sql'] },
  };

  // ── Derived lookups ──────────────────────────────────────────────────────────
  const EXT_TO_LANG = {};
  for (const [name, def] of Object.entries(LANGUAGES)) {
    for (const ext of def.extensions) EXT_TO_LANG[ext] = name;
  }

  const SOURCE_EXTENSIONS = new Set(Object.keys(EXT_TO_LANG));

  const TREE_SITTER_LANGUAGES = Object.entries(LANGUAGES)
    .filter(([, def]) => def.treeSitter)
    .map(([name, def]) => ({
      id: name.toLowerCase(),
      label: name,
      extensions: def.extensions.slice(),
      wasmUrl: def.treeSitter,
    }));

  const _extToTsLang = {};
  for (const lang of TREE_SITTER_LANGUAGES) {
    for (const ext of lang.extensions) {
      if (!_extToTsLang[ext]) _extToTsLang[ext] = lang;
    }
  }

  // ── Devicon language icon ────────────────────────────────────────────────────
  const DEVICON_ALIASES = {
    'c++': 'cplusplus', cpp: 'cplusplus', 'c/c++': 'cplusplus',
    'c#': 'csharp',
    tsx: 'typescript',
    shell: 'bash',
    vue: 'vuejs',
    html: 'html5',
    css: 'css3',
    sql: 'mysql',
    golang: 'go',
    'rust-lang': 'rust',
    googlecloudplatform: 'googlecloud',
    facebookresearch: 'facebook',
    meta: 'facebook',
    amazon: 'amazonwebservices',
    aws: 'amazonwebservices',
    sveltejs: 'svelte',
    tailwindlabs: 'tailwindcss',
    yarnpkg: 'yarn',
    jenkinsci: 'jenkins',
    'rust_lang': 'rust',
  };

  // Returns a devicon CSS class string for `name`, or null if not mappable.
  function langIcon(name) {
    if (!name) return null;
    const raw = String(name).toLowerCase().trim();
    const key = DEVICON_ALIASES[raw] || raw.replace(/[^a-z0-9]/g, '');
    if (!key) return null;
    return `devicon-${key}-plain colored`;
  }

  // ── HTML escaping ────────────────────────────────────────────────────────────
  const _htmlEscapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => _htmlEscapes[c]);
  }

  // ── Tree-sitter node summary ─────────────────────────────────────────────────
  // Converts a sources map (type → [{text, textLower, file, startIndex, endIndex}])
  // into a sorted array of node entries, descending by count.
  function summarizeNodes(sources) {
    return Object.entries(sources)
      .sort(([, a], [, b]) => b.length - a.length)
      .map(([type, arr]) => ({ type, typeLower: type.toLowerCase(), count: arr.length, sources: arr, custom: false }));
  }

  function tsLangForPath(path) {
    return _extToTsLang[extOf(path)] || null;
  }

  function groupFilesByTsLang(files) {
    const groups = new Map();
    for (const f of files) {
      const lang = tsLangForPath(f.path);
      if (!lang) continue;
      if (!groups.has(lang.id)) groups.set(lang.id, { lang, files: [] });
      groups.get(lang.id).files.push(f);
    }
    return groups;
  }

  function parseRepoUrl(url) {
    if (typeof url !== 'string') return null;
    let s = url.trim();
    if (!s) return null;

    // Strip protocol if present (http, https, git, ssh, etc.)
    s = s.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
    // Strip git@ user prefix (e.g. git@github.com:user/repo)
    s = s.replace(/^[^@\s]+@/, '');
    // Normalize SCP-style colon to slash (github.com:user/repo → github.com/user/repo)
    s = s.replace(/^([^/]+):/, '$1/');
    // Strip leading www.
    s = s.replace(/^www\./, '');
    // If it starts with github.com, drop it
    s = s.replace(/^github\.com\//, '');
    // Trim leading/trailing slashes
    s = s.replace(/^\/+/, '').replace(/\/+$/, '');

    const parts = s.split('/');
    if (parts.length < 2) return null;
    const user = parts[0];
    let repo = parts[1];
    if (!user || !repo) return null;
    // Strip trailing .git
    repo = repo.replace(/\.git$/, '');
    return { user, repo };
  }

  function extOf(path) {
    const dot = path.lastIndexOf('.');
    if (dot === -1) return '';
    return path.slice(dot).toLowerCase();
  }

  function langOf(path) {
    return EXT_TO_LANG[extOf(path)] || 'Other';
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function flattenTree(nodes, prefix = '') {
    const out = [];
    for (const n of nodes) {
      const path = prefix ? `${prefix}/${n.name}` : n.name;
      if (n.type === 'directory' && Array.isArray(n.files)) {
        out.push(...flattenTree(n.files, path));
      } else if (n.type === 'file' || !n.type) {
        out.push({ path, size: n.size || 0 });
      }
    }
    return out;
  }

  async function withConcurrency(tasks, concurrency, onDone) {
    const results = [];
    let idx = 0;
    async function worker() {
      while (idx < tasks.length) {
        const i = idx++;
        const r = await tasks[i]();
        results[i] = r;
        if (onDone) onDone(i, r);
      }
    }
    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
    await Promise.all(workers);
    return results;
  }

  function analyze(files) {
    const langMap = {};
    let totalLines = 0;
    let totalSize = 0;

    for (const f of files) {
      const lang = langOf(f.path);
      const lines = f.content ? (f.content.match(/\n/g) || []).length + (f.content.length > 0 ? 1 : 0) : 0;
      totalLines += lines;
      totalSize += f.size;

      if (!langMap[lang]) langMap[lang] = { lang, files: 0, lines: 0, size: 0 };
      langMap[lang].files++;
      langMap[lang].lines += lines;
      langMap[lang].size += f.size;
      f.lines = lines;
    }

    const languages = Object.values(langMap).sort((a, b) =>
      b.lines !== a.lines ? b.lines - a.lines : b.files - a.files
    );
    languages.forEach(l => {
      l.pct = l.lines > 0 ? (totalLines > 0 ? ((l.lines / totalLines) * 100).toFixed(1) : '0.0') : '-';
    });

    return { totalFiles: files.length, totalLines, totalSize, languages };
  }

  // ── Tree-sitter hierarchical search helpers ─────────────────────────────────

  // Parse a user query into hierarchical type filters and a free-text term.
  // Input query is expected to already be trimmed and lowercased.
  // Format: "type1:type2:…:text" where each leading segment that matches a known
  // node type becomes a filter level; the remainder becomes the text query.
  // Returns { filterTypes: string[], textQ: string }.
  function parseHierarchicalQuery(rawLower, tsNodes) {
    const parts = rawLower.split(':');
    const filterTypes = [];
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i].trim();
      if (part && tsNodes.some(n => n.typeLower === part)) {
        filterTypes.push(part);
      } else {
        break;
      }
    }
    let textQ = filterTypes.length > 0
      ? parts.slice(filterTypes.length).join(':').trim().replace(/^\//, '')
      : rawLower;

    // No colon: if the query exactly matches a known node type, treat it as a type-only filter.
    if (filterTypes.length === 0 && tsNodes.some(n => n.typeLower === textQ)) {
      filterTypes.push(textQ);
      textQ = '';
    }

    return { filterTypes, textQ };
  }

  // Builds a containment hierarchy from filterTypes and returns the final-level ranges,
  // sources, and node entry. Returns null if any type is not found in tsNodes.
  // filterTypes must be non-empty and lowercased.
  function buildContainerRanges(tsNodes, filterTypes) {
    let containerRanges = null;
    let lastSources = null;
    let lastNode = null;
    for (const typeFilter of filterTypes) {
      const matchingNode = tsNodes.find(n => n.typeLower === typeFilter);
      if (!matchingNode) return null;
      let sources = matchingNode.sources;
      if (containerRanges) {
        sources = sources.filter(s => {
          const ranges = containerRanges.get(s.file);
          if (!ranges) return false;
          return ranges.some(r => s.startIndex >= r.start && s.endIndex <= r.end);
        });
      }
      containerRanges = new Map();
      for (const s of sources) {
        if (!containerRanges.has(s.file)) containerRanges.set(s.file, []);
        containerRanges.get(s.file).push({ start: s.startIndex, end: s.endIndex });
      }
      lastSources = sources;
      lastNode = matchingNode;
    }
    return { containerRanges, lastSources, lastNode };
  }

  // Compute per-type node counts within the container defined by filterTypes.
  // filterTypes: ordered array of lowercased node-type names (same as badge types).
  // Returns Map<type, count> with only types that have count > 0, or null if filterTypes is empty
  // or a type in filterTypes is not found.
  function computeContextualCounts(tsNodes, filterTypes) {
    if (!filterTypes.length) return null;
    const built = buildContainerRanges(tsNodes, filterTypes);
    if (!built) return null;
    const { containerRanges } = built;
    const counts = new Map();
    for (const n of tsNodes) {
      let count = 0;
      for (const s of n.sources) {
        const ranges = containerRanges.get(s.file);
        if (ranges && ranges.some(r => s.startIndex >= r.start && s.endIndex <= r.end)) count++;
      }
      if (count > 0) counts.set(n.type, count);
    }
    return counts;
  }

  // Apply hierarchical containment filtering to tsNodes.
  // filterTypes: ordered array of lowercased node-type names.
  // textQ: free-text substring filter (already lowercased), may be empty.
  // maxItems: max result items per type (default 10).
  // Returns an array of { ...nodeEntry, items, matches } sorted by matches desc.
  function applyTsNodeFilter(tsNodes, filterTypes, textQ, maxItems) {
    const MAX = maxItems || 10;
    const out = [];

    if (filterTypes.length > 0) {
      const built = buildContainerRanges(tsNodes, filterTypes);
      if (!built) return [];
      const { lastSources: lastLevelSources, lastNode: lastLevelNode } = built;

      if (!textQ) {
        // Type-only filter — deduplicate by (file, text)
        const seen = new Set();
        const deduped = [];
        for (const s of lastLevelSources) {
          const key = `${s.file || ''}\0${s.text || ''}`;
          if (!seen.has(key)) {
            seen.add(key);
            if (deduped.length < MAX) deduped.push(s);
          }
        }
        out.push({ ...lastLevelNode, items: deduped, matches: seen.size });
      } else {
        // Type + text filter
        const items = [];
        const seenKeys = new Set();
        for (const s of lastLevelSources) {
          if (s.textLower.includes(textQ)) {
            const key = `${s.file || ''}\0${s.text || ''}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              if (items.length < MAX) items.push(s);
            }
          }
        }
        if (seenKeys.size > 0) {
          out.push({ ...lastLevelNode, items, matches: seenKeys.size });
        }
      }
    } else {
      // No type filter — text search across all nodes
      for (const n of tsNodes) {
        const items = [];
        const seenKeys = new Set();
        for (const s of n.sources) {
          if (s.textLower.includes(textQ)) {
            const key = `${s.file || ''}\0${s.text || ''}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              if (items.length < MAX) items.push(s);
            }
          }
        }
        if (seenKeys.size > 0) {
          out.push({ ...n, items, matches: seenKeys.size });
        }
      }
    }

    out.sort((a, b) => b.matches - a.matches);
    return out;
  }

  return {
    LANGUAGES,
    SOURCE_EXTENSIONS,
    EXT_TO_LANG,
    TREE_SITTER_LANGUAGES,
    DEVICON_ALIASES,
    tsLangForPath,
    groupFilesByTsLang,
    parseRepoUrl,
    extOf,
    langOf,
    formatSize,
    flattenTree,
    withConcurrency,
    analyze,
    langIcon,
    escapeHtml,
    summarizeNodes,
    parseHierarchicalQuery,
    applyTsNodeFilter,
    computeContextualCounts,
  };
}));
