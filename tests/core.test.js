const {
  SOURCE_EXTENSIONS,
  EXT_TO_LANG,
  BUCKET_ORDER,
  parseRepoUrl,
  extOf,
  langOf,
  formatSize,
  sizeBucket,
  flattenTree,
  withConcurrency,
  analyze,
  TREE_SITTER_LANGUAGES,
  tsLangForPath,
  groupFilesByTsLang,
  parseHierarchicalQuery,
  applyTsNodeFilter,
  langIcon,
  escapeHtml,
  summarizeNodes,
} = require('../src/core.js');

describe('parseRepoUrl', () => {
  const expected = { user: 'facebook', repo: 'react' };

  test('parses https URL', () => {
    expect(parseRepoUrl('https://github.com/facebook/react')).toEqual(expected);
  });

  test('parses http URL', () => {
    expect(parseRepoUrl('http://github.com/facebook/react')).toEqual(expected);
  });

  test('parses URL with www', () => {
    expect(parseRepoUrl('https://www.github.com/facebook/react')).toEqual(expected);
    expect(parseRepoUrl('www.github.com/facebook/react')).toEqual(expected);
  });

  test('parses bare github.com URL without protocol', () => {
    expect(parseRepoUrl('github.com/facebook/react')).toEqual(expected);
  });

  test('parses owner/repo shorthand', () => {
    expect(parseRepoUrl('facebook/react')).toEqual(expected);
  });

  test('parses URL with .git suffix', () => {
    expect(parseRepoUrl('https://github.com/facebook/react.git')).toEqual(expected);
    expect(parseRepoUrl('facebook/react.git')).toEqual(expected);
  });

  test('parses git@ SSH URL', () => {
    expect(parseRepoUrl('git@github.com:facebook/react.git')).toEqual(expected);
  });

  test('parses ssh:// URL', () => {
    expect(parseRepoUrl('ssh://git@github.com/facebook/react.git')).toEqual(expected);
  });

  test('handles trailing slash', () => {
    expect(parseRepoUrl('https://github.com/facebook/react/')).toEqual(expected);
    expect(parseRepoUrl('facebook/react/')).toEqual(expected);
  });

  test('trims whitespace', () => {
    expect(parseRepoUrl('  https://github.com/a/b  ')).toEqual({ user: 'a', repo: 'b' });
    expect(parseRepoUrl('  a/b  ')).toEqual({ user: 'a', repo: 'b' });
  });

  test('ignores extra path segments', () => {
    expect(parseRepoUrl('https://github.com/a/b/tree/main/src')).toEqual({ user: 'a', repo: 'b' });
    expect(parseRepoUrl('a/b/tree/main')).toEqual({ user: 'a', repo: 'b' });
  });

  test('rejects empty / null / non-string input', () => {
    expect(parseRepoUrl('')).toBeNull();
    expect(parseRepoUrl('   ')).toBeNull();
    expect(parseRepoUrl(null)).toBeNull();
    expect(parseRepoUrl(undefined)).toBeNull();
    expect(parseRepoUrl(123)).toBeNull();
  });

  test('rejects URLs without user/repo', () => {
    expect(parseRepoUrl('https://github.com/onlyuser')).toBeNull();
    expect(parseRepoUrl('onlyuser')).toBeNull();
    expect(parseRepoUrl('github.com/')).toBeNull();
  });
});

describe('extOf', () => {
  test('returns lowercase extension', () => {
    expect(extOf('foo/bar.JS')).toBe('.js');
    expect(extOf('a.Py')).toBe('.py');
  });

  test('uses last dot', () => {
    expect(extOf('a.b.c.tsx')).toBe('.tsx');
  });

  test('returns empty string when no extension', () => {
    expect(extOf('Makefile')).toBe('');
  });
});

describe('langOf', () => {
  test('maps known extensions', () => {
    expect(langOf('foo.py')).toBe('Python');
    expect(langOf('foo.ts')).toBe('TypeScript');
    expect(langOf('foo.tsx')).toBe('TSX');
    expect(langOf('foo.scss')).toBe('CSS');
  });

  test('unknown extensions become Other', () => {
    expect(langOf('foo.xyz')).toBe('Other');
    expect(langOf('Makefile')).toBe('Other');
  });
});

describe('formatSize', () => {
  test('formats bytes', () => {
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(1023)).toBe('1023 B');
  });

  test('formats kilobytes with one decimal', () => {
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(formatSize(1536)).toBe('1.5 KB');
  });

  test('formats megabytes with two decimals', () => {
    expect(formatSize(1024 * 1024)).toBe('1.00 MB');
    expect(formatSize(5 * 1024 * 1024)).toBe('5.00 MB');
  });
});

describe('sizeBucket', () => {
  test('classifies into buckets', () => {
    expect(sizeBucket(500)).toBe('< 1 KB');
    expect(sizeBucket(2 * 1024)).toBe('1–10 KB');
    expect(sizeBucket(20 * 1024)).toBe('10–50 KB');
    expect(sizeBucket(75 * 1024)).toBe('50–100 KB');
    expect(sizeBucket(200 * 1024)).toBe('> 100 KB');
  });

  test('every bucket appears in BUCKET_ORDER', () => {
    [500, 2048, 20480, 76800, 200000].forEach(b => {
      expect(BUCKET_ORDER).toContain(sizeBucket(b));
    });
  });
});

describe('flattenTree', () => {
  test('flattens a flat list', () => {
    const tree = [
      { type: 'file', name: 'a.js', size: 10 },
      { type: 'file', name: 'b.py', size: 20 },
    ];
    expect(flattenTree(tree)).toEqual([
      { path: 'a.js', size: 10 },
      { path: 'b.py', size: 20 },
    ]);
  });

  test('descends into directories and joins paths', () => {
    const tree = [
      {
        type: 'directory', name: 'src', files: [
          { type: 'file', name: 'index.js', size: 1 },
          {
            type: 'directory', name: 'lib', files: [
              { type: 'file', name: 'util.js', size: 2 },
            ],
          },
        ],
      },
      { type: 'file', name: 'README.md', size: 3 },
    ];
    expect(flattenTree(tree)).toEqual([
      { path: 'src/index.js', size: 1 },
      { path: 'src/lib/util.js', size: 2 },
      { path: 'README.md', size: 3 },
    ]);
  });

  test('treats nodes without a type as files', () => {
    const tree = [{ name: 'a.js', size: 5 }];
    expect(flattenTree(tree)).toEqual([{ path: 'a.js', size: 5 }]);
  });

  test('defaults missing size to 0', () => {
    expect(flattenTree([{ type: 'file', name: 'a.js' }])).toEqual([{ path: 'a.js', size: 0 }]);
  });
});

describe('withConcurrency', () => {
  test('runs all tasks and returns results in order', async () => {
    const tasks = [1, 2, 3, 4, 5].map(n => async () => n * 2);
    const results = await withConcurrency(tasks, 2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  test('respects concurrency limit', async () => {
    let active = 0;
    let max = 0;
    const tasks = Array.from({ length: 10 }, () => async () => {
      active++;
      max = Math.max(max, active);
      await new Promise(r => setTimeout(r, 5));
      active--;
      return 1;
    });
    await withConcurrency(tasks, 3);
    expect(max).toBeLessThanOrEqual(3);
  });

  test('invokes onDone for each task', async () => {
    const calls = [];
    const tasks = [10, 20, 30].map(v => async () => v);
    await withConcurrency(tasks, 2, (i, r) => calls.push([i, r]));
    expect(calls.sort((a, b) => a[0] - b[0])).toEqual([[0, 10], [1, 20], [2, 30]]);
  });

  test('handles empty task list', async () => {
    expect(await withConcurrency([], 4)).toEqual([]);
  });
});

describe('analyze', () => {
  test('aggregates file stats and language breakdown', () => {
    const files = [
      { path: 'a.js', size: 100, content: 'line1\nline2\nline3' },
      { path: 'b.js', size: 50, content: 'one\ntwo' },
      { path: 'c.py', size: 200, content: 'x\ny\nz\n' },
    ];
    const r = analyze(files);

    expect(r.totalFiles).toBe(3);
    expect(r.totalSize).toBe(350);
    // a.js: 3 (2 newlines + 1), b.js: 2 (1 newline + 1), c.py: 4 (3 newlines + 1)
    expect(r.totalLines).toBe(9);
    expect(r.avgSize).toBeCloseTo(350 / 3);

    const js = r.languages.find(l => l.lang === 'JavaScript');
    const py = r.languages.find(l => l.lang === 'Python');
    expect(js.files).toBe(2);
    expect(js.lines).toBe(5);
    expect(js.size).toBe(150);
    expect(py.files).toBe(1);
    expect(py.lines).toBe(4);

    // languages sorted by lines desc
    expect(r.languages[0].lines).toBeGreaterThanOrEqual(r.languages[1].lines);

    // pct strings sum ~ 100
    const sumPct = r.languages.reduce((s, l) => s + parseFloat(l.pct), 0);
    expect(Math.round(sumPct)).toBe(100);
  });

  test('top10 holds at most 10 items, sorted by size desc', () => {
    const files = Array.from({ length: 15 }, (_, i) => ({
      path: `f${i}.js`, size: i * 10, content: 'x',
    }));
    const r = analyze(files);
    expect(r.top10).toHaveLength(10);
    expect(r.top10[0].size).toBe(140);
    expect(r.top10[9].size).toBe(50);
  });

  test('buckets count files by size bucket and include all keys', () => {
    const files = [
      { path: 'small.js', size: 100, content: 'a' },
      { path: 'mid.js', size: 5 * 1024, content: 'a' },
      { path: 'big.js', size: 200 * 1024, content: 'a' },
    ];
    const r = analyze(files);
    BUCKET_ORDER.forEach(b => expect(r.buckets).toHaveProperty(b));
    expect(r.buckets['< 1 KB']).toBe(1);
    expect(r.buckets['1–10 KB']).toBe(1);
    expect(r.buckets['> 100 KB']).toBe(1);
    expect(r.buckets['10–50 KB']).toBe(0);
  });

  test('handles empty file list', () => {
    const r = analyze([]);
    expect(r.totalFiles).toBe(0);
    expect(r.totalLines).toBe(0);
    expect(r.totalSize).toBe(0);
    expect(r.avgSize).toBe(0);
    expect(r.languages).toEqual([]);
    expect(r.top10).toEqual([]);
  });

  test('attaches lines property to each file', () => {
    const files = [{ path: 'a.js', size: 10, content: 'a\nb\nc' }];
    analyze(files);
    expect(files[0].lines).toBe(3);
  });
});

describe('constants', () => {
  test('SOURCE_EXTENSIONS contains common extensions', () => {
    ['.js', '.py', '.ts', '.go', '.rs'].forEach(e => {
      expect(SOURCE_EXTENSIONS.has(e)).toBe(true);
    });
  });

  test('EXT_TO_LANG keys are all in SOURCE_EXTENSIONS', () => {
    Object.keys(EXT_TO_LANG).forEach(k => {
      expect(SOURCE_EXTENSIONS.has(k)).toBe(true);
    });
  });
});

describe('tree-sitter language registry', () => {
  test('TREE_SITTER_LANGUAGES entries are well-formed and unique', () => {
    expect(Array.isArray(TREE_SITTER_LANGUAGES)).toBe(true);
    expect(TREE_SITTER_LANGUAGES.length).toBeGreaterThan(0);
    const ids = new Set();
    for (const l of TREE_SITTER_LANGUAGES) {
      expect(typeof l.id).toBe('string');
      expect(typeof l.label).toBe('string');
      expect(Array.isArray(l.extensions)).toBe(true);
      expect(l.extensions.length).toBeGreaterThan(0);
      expect(typeof l.wasmUrl).toBe('string');
      expect(ids.has(l.id)).toBe(false);
      ids.add(l.id);
    }
  });

  test('every registered extension is also in SOURCE_EXTENSIONS', () => {
    for (const l of TREE_SITTER_LANGUAGES) {
      for (const ext of l.extensions) {
        expect(SOURCE_EXTENSIONS.has(ext)).toBe(true);
      }
    }
  });

  test('python, javascript, typescript are all registered', () => {
    const ids = TREE_SITTER_LANGUAGES.map(l => l.id);
    expect(ids).toEqual(expect.arrayContaining(['python', 'javascript', 'typescript']));
  });

  test('tsLangForPath maps known extensions to the right language', () => {
    expect(tsLangForPath('foo.py').id).toBe('python');
    expect(tsLangForPath('foo.js').id).toBe('javascript');
    expect(tsLangForPath('foo.jsx').id).toBe('javascript');
    expect(tsLangForPath('foo.ts').id).toBe('typescript');
    expect(tsLangForPath('foo/bar.PY').id).toBe('python');
  });

  test('tsLangForPath returns null for unsupported files', () => {
    expect(tsLangForPath('foo.md')).toBeNull();
    expect(tsLangForPath('Makefile')).toBeNull();
  });

  test('groupFilesByTsLang buckets by language and skips unsupported', () => {
    const files = [
      { path: 'a.py', size: 1 },
      { path: 'b.py', size: 1 },
      { path: 'c.js', size: 1 },
      { path: 'd.ts', size: 1 },
      { path: 'e.md', size: 1 },
    ];
    const groups = groupFilesByTsLang(files);
    expect(groups.get('python').files).toHaveLength(2);
    expect(groups.get('javascript').files).toHaveLength(1);
    expect(groups.get('typescript').files).toHaveLength(1);
    expect(groups.has('markdown')).toBe(false);
  });
});

// ── Helpers for hierarchical search tests ────────────────────────────────────

function makeNode(type, sources) {
  return {
    type,
    typeLower: type.toLowerCase(),
    count: sources.length,
    sources: sources.map(s => ({
      text: s.text,
      textLower: s.text.toLowerCase(),
      file: s.file,
      startIndex: s.start,
      endIndex: s.end,
    })),
    custom: false,
  };
}

// ── parseHierarchicalQuery ────────────────────────────────────────────────────

describe('parseHierarchicalQuery', () => {
  const nodes = [
    makeNode('function_declaration', []),
    makeNode('identifier', []),
    makeNode('string', []),
  ];

  test('empty query returns empty filterTypes and empty textQ', () => {
    expect(parseHierarchicalQuery('', nodes)).toEqual({ filterTypes: [], textQ: '' });
    expect(parseHierarchicalQuery('   ', nodes)).toEqual({ filterTypes: [], textQ: '   ' });
  });

  test('plain text with no type match is treated as free-text query', () => {
    expect(parseHierarchicalQuery('hello', nodes)).toEqual({ filterTypes: [], textQ: 'hello' });
  });

  test('exact type match with no colon becomes a type-only filter', () => {
    expect(parseHierarchicalQuery('identifier', nodes)).toEqual({ filterTypes: ['identifier'], textQ: '' });
  });

  test('type:text splits into one filter and text query', () => {
    expect(parseHierarchicalQuery('function_declaration:foo', nodes)).toEqual({
      filterTypes: ['function_declaration'],
      textQ: 'foo',
    });
  });

  test('type1:type2: parses two filter levels with empty text', () => {
    expect(parseHierarchicalQuery('function_declaration:identifier:', nodes)).toEqual({
      filterTypes: ['function_declaration', 'identifier'],
      textQ: '',
    });
  });

  test('type1:type2:text parses two filter levels with text', () => {
    expect(parseHierarchicalQuery('function_declaration:identifier:myvar', nodes)).toEqual({
      filterTypes: ['function_declaration', 'identifier'],
      textQ: 'myvar',
    });
  });

  test('unknown type in chain stops hierarchy — remainder becomes textQ', () => {
    expect(parseHierarchicalQuery('function_declaration:unknown:identifier', nodes)).toEqual({
      filterTypes: ['function_declaration'],
      textQ: 'unknown:identifier',
    });
  });

  test('strips leading slash from textQ (autocomplete artifact)', () => {
    expect(parseHierarchicalQuery('function_declaration:/ident', nodes)).toEqual({
      filterTypes: ['function_declaration'],
      textQ: 'ident',
    });
  });

  test('standalone slash in textQ is stripped to empty string', () => {
    expect(parseHierarchicalQuery('function_declaration:/', nodes)).toEqual({
      filterTypes: ['function_declaration'],
      textQ: '',
    });
  });
});

// ── applyTsNodeFilter ─────────────────────────────────────────────────────────

describe('applyTsNodeFilter', () => {
  // Two files each with a function_declaration containing identifiers.
  //
  // file1.js:
  //   function_declaration [0, 50)
  //     identifier "foo" [5, 8)
  //     identifier "bar" [10, 13)
  //
  // file2.js:
  //   function_declaration [0, 40)
  //     identifier "baz" [3, 6)
  //   identifier "orphan" [60, 66) — outside any function_declaration

  const fnNode = makeNode('function_declaration', [
    { text: 'function foo() {}', file: 'file1.js', start: 0, end: 50 },
    { text: 'function baz() {}', file: 'file2.js', start: 0, end: 40 },
  ]);
  const idNode = makeNode('identifier', [
    { text: 'foo', file: 'file1.js', start: 5, end: 8 },
    { text: 'bar', file: 'file1.js', start: 10, end: 13 },
    { text: 'baz', file: 'file2.js', start: 3, end: 6 },
    { text: 'orphan', file: 'file2.js', start: 60, end: 66 },
  ]);
  const strNode = makeNode('string', [
    { text: 'hello', file: 'file2.js', start: 50, end: 55 },
  ]);

  const tsNodes = [fnNode, idNode, strNode];

  test('empty filterTypes with textQ searches across all nodes', () => {
    const results = applyTsNodeFilter(tsNodes, [], 'foo', 10);
    const types = results.map(r => r.type);
    expect(types).toContain('function_declaration');
    expect(types).toContain('identifier');
    expect(types).not.toContain('string');
  });

  test('single type filter with no text returns all of that type', () => {
    const results = applyTsNodeFilter(tsNodes, ['function_declaration'], '', 10);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('function_declaration');
    expect(results[0].matches).toBe(2);
  });

  test('hierarchical filter: identifiers inside function_declarations', () => {
    const results = applyTsNodeFilter(tsNodes, ['function_declaration', 'identifier'], '', 10);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('identifier');
    const texts = results[0].items.map(i => i.text);
    expect(texts).toContain('foo');
    expect(texts).toContain('bar');
    expect(texts).toContain('baz');
    expect(texts).not.toContain('orphan'); // outside all function_declarations
    expect(results[0].matches).toBe(3);
  });

  test('hierarchical filter with textQ narrows further by text', () => {
    const results = applyTsNodeFilter(tsNodes, ['function_declaration', 'identifier'], 'ba', 10);
    expect(results).toHaveLength(1);
    const texts = results[0].items.map(i => i.text);
    expect(texts).toContain('bar');
    expect(texts).toContain('baz');
    expect(texts).not.toContain('foo');
    expect(texts).not.toContain('orphan');
  });

  test('returns [] when a filter type does not exist in tsNodes', () => {
    expect(applyTsNodeFilter(tsNodes, ['nonexistent'], '', 10)).toEqual([]);
  });

  test('returns [] when no text matches within filtered nodes', () => {
    const results = applyTsNodeFilter(tsNodes, ['function_declaration', 'identifier'], 'zzz', 10);
    expect(results).toHaveLength(0);
  });

  test('results are sorted by matches descending', () => {
    const results = applyTsNodeFilter(tsNodes, [], 'o', 10);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].matches).toBeGreaterThanOrEqual(results[i].matches);
    }
  });

  test('respects maxItems cap on items while matches stays accurate', () => {
    // identifier has 4 sources; maxItems=2 caps items but matches should still be 4
    const results = applyTsNodeFilter(tsNodes, ['identifier'], '', 2);
    expect(results[0].items.length).toBeLessThanOrEqual(2);
    expect(results[0].matches).toBe(4);
  });

  test('deduplicates items with identical (file, text)', () => {
    const dupId = makeNode('identifier', [
      { text: 'foo', file: 'file1.js', start: 5, end: 8 },
      { text: 'foo', file: 'file1.js', start: 5, end: 8 },
    ]);
    const results = applyTsNodeFilter([dupId], ['identifier'], '', 10);
    expect(results[0].matches).toBe(1);
    expect(results[0].items).toHaveLength(1);
  });

  test('identifier outside all containers is excluded by hierarchical filter', () => {
    // "orphan" is at [60,66] in file2.js; function_declaration spans [0,40] — no overlap
    const results = applyTsNodeFilter(tsNodes, ['function_declaration', 'identifier'], '', 10);
    const texts = results[0].items.map(i => i.text);
    expect(texts).not.toContain('orphan');
  });
});

// ── langIcon ──────────────────────────────────────────────────────────────────

describe('langIcon', () => {
  test('returns null for falsy input', () => {
    expect(langIcon(null)).toBeNull();
    expect(langIcon(undefined)).toBeNull();
    expect(langIcon('')).toBeNull();
    expect(langIcon(0)).toBeNull();
  });

  test('maps plain language names to devicon class', () => {
    expect(langIcon('JavaScript')).toBe('devicon-javascript-plain colored');
    expect(langIcon('Python')).toBe('devicon-python-plain colored');
    expect(langIcon('Go')).toBe('devicon-go-plain colored');
    expect(langIcon('Rust')).toBe('devicon-rust-plain colored');
  });

  test('is case-insensitive', () => {
    expect(langIcon('PYTHON')).toBe('devicon-python-plain colored');
    expect(langIcon('TypeScript')).toBe('devicon-typescript-plain colored');
  });

  test('applies alias table for names that need special slugs', () => {
    expect(langIcon('c/c++')).toBe('devicon-cplusplus-plain colored');
    expect(langIcon('C#')).toBe('devicon-csharp-plain colored');
    expect(langIcon('tsx')).toBe('devicon-typescript-plain colored');
    expect(langIcon('shell')).toBe('devicon-bash-plain colored');
    expect(langIcon('vue')).toBe('devicon-vuejs-plain colored');
    expect(langIcon('html')).toBe('devicon-html5-plain colored');
    expect(langIcon('css')).toBe('devicon-css3-plain colored');
    expect(langIcon('aws')).toBe('devicon-amazonwebservices-plain colored');
  });

  test('strips non-alphanumeric chars for unaliased names', () => {
    // e.g. "Svelte" → slug "svelte"
    expect(langIcon('Svelte')).toBe('devicon-svelte-plain colored');
    // "rust_lang" is aliased
    expect(langIcon('rust_lang')).toBe('devicon-rust-plain colored');
  });

  test('returns null when name reduces to empty slug', () => {
    // A string of only special chars collapses to ''
    expect(langIcon('---')).toBeNull();
    expect(langIcon('!!!')).toBeNull();
  });
});

// ── escapeHtml ────────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  test('escapes all five special characters', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });

  test('escapes mixed content', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(escapeHtml("it's a <b>test</b> & more")).toBe('it&#39;s a &lt;b&gt;test&lt;/b&gt; &amp; more');
  });

  test('leaves strings with no special chars unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml('abc123')).toBe('abc123');
  });

  test('handles multiple occurrences of the same char', () => {
    expect(escapeHtml('a & b & c')).toBe('a &amp; b &amp; c');
    expect(escapeHtml('<<<')).toBe('&lt;&lt;&lt;');
  });
});

// ── summarizeNodes ────────────────────────────────────────────────────────────

describe('summarizeNodes', () => {
  const src = (text, file = 'f.js') => ({ text, textLower: text.toLowerCase(), file, startIndex: 0, endIndex: text.length });

  test('returns one entry per type with correct shape', () => {
    const sources = {
      identifier: [src('foo'), src('bar')],
      string: [src('"hi"')],
    };
    const result = summarizeNodes(sources);
    expect(result).toHaveLength(2);
    const id = result.find(n => n.type === 'identifier');
    expect(id).toMatchObject({ type: 'identifier', typeLower: 'identifier', count: 2, custom: false });
    expect(id.sources).toHaveLength(2);
  });

  test('sorts entries by count descending', () => {
    const sources = {
      string: [src('a')],
      identifier: [src('x'), src('y'), src('z')],
      comment: [src('//'), src('//')],
    };
    const result = summarizeNodes(sources);
    expect(result[0].type).toBe('identifier');
    expect(result[1].type).toBe('comment');
    expect(result[2].type).toBe('string');
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].count).toBeGreaterThanOrEqual(result[i].count);
    }
  });

  test('sets typeLower to lowercase of type', () => {
    const sources = { FunctionDeclaration: [src('function foo() {}')] };
    const result = summarizeNodes(sources);
    expect(result[0].typeLower).toBe('functiondeclaration');
  });

  test('returns empty array for empty sources', () => {
    expect(summarizeNodes({})).toEqual([]);
  });

  test('count matches the number of source items', () => {
    const sources = { expr: [src('1'), src('2'), src('3'), src('4')] };
    expect(summarizeNodes(sources)[0].count).toBe(4);
  });
});
