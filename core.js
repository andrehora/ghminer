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
    'Java': { extensions: ['.java'] },
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

  const BUCKET_ORDER = ['< 1 KB', '1–10 KB', '10–50 KB', '50–100 KB', '> 100 KB'];

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

  function sizeBucket(bytes) {
    if (bytes < 1024) return '< 1 KB';
    if (bytes < 10 * 1024) return '1–10 KB';
    if (bytes < 50 * 1024) return '10–50 KB';
    if (bytes < 100 * 1024) return '50–100 KB';
    return '> 100 KB';
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
      const lines = (f.content.match(/\n/g) || []).length + (f.content.length > 0 ? 1 : 0);
      totalLines += lines;
      totalSize += f.size;

      if (!langMap[lang]) langMap[lang] = { lang, files: 0, lines: 0, size: 0 };
      langMap[lang].files++;
      langMap[lang].lines += lines;
      langMap[lang].size += f.size;
      f.lines = lines;
    }

    const languages = Object.values(langMap).sort((a, b) => b.lines - a.lines);
    languages.forEach(l => { l.pct = totalLines > 0 ? ((l.lines / totalLines) * 100).toFixed(1) : '0.0'; });

    const sorted = [...files].sort((a, b) => b.size - a.size);
    const top10 = sorted.slice(0, 10);

    const buckets = {};
    BUCKET_ORDER.forEach(b => buckets[b] = 0);
    for (const f of files) buckets[sizeBucket(f.size)]++;

    const avgSize = files.length > 0 ? totalSize / files.length : 0;

    return { totalFiles: files.length, totalLines, totalSize, avgSize, languages, top10, buckets };
  }

  return {
    LANGUAGES,
    SOURCE_EXTENSIONS,
    EXT_TO_LANG,
    BUCKET_ORDER,
    TREE_SITTER_LANGUAGES,
    tsLangForPath,
    groupFilesByTsLang,
    parseRepoUrl,
    extOf,
    langOf,
    formatSize,
    sizeBucket,
    flattenTree,
    withConcurrency,
    analyze,
  };
}));
