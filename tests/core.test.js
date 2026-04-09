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
} = require('../core.js');

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
