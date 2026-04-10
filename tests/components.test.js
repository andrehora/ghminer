import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  StatCard,
  SectionHeading,
  Section,
  BarChartCSS,
  LangIcon,
  TopBar,
  Header,
  RepoInput,
  LoadingProgress,
  Results,
} from '../src/components.js';

// ── StatCard ──────────────────────────────────────────────────────────────────

describe('StatCard', () => {
  test('renders label and value', () => {
    render(<StatCard label="Files" value="42" />);
    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  test('renders numeric value', () => {
    render(<StatCard label="Lines" value={1234} />);
    expect(screen.getByText('1234')).toBeInTheDocument();
  });
});

// ── SectionHeading ────────────────────────────────────────────────────────────

describe('SectionHeading', () => {
  test('renders children in an h2', () => {
    render(<SectionHeading>Language Breakdown</SectionHeading>);
    const el = screen.getByRole('heading', { level: 2 });
    expect(el).toHaveTextContent('Language Breakdown');
  });
});

// ── Section ───────────────────────────────────────────────────────────────────

describe('Section', () => {
  test('renders title and shows children when defaultOpen=true', () => {
    render(
      <Section title="Overview" defaultOpen={true}>
        <p>content</p>
      </Section>
    );
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  test('hides children when defaultOpen=false', () => {
    render(
      <Section title="Closed" defaultOpen={false}>
        <p>hidden</p>
      </Section>
    );
    expect(screen.queryByText('hidden')).not.toBeInTheDocument();
  });

  test('toggle button has aria-expanded=true when defaultOpen=true', () => {
    render(<Section title="T" defaultOpen={true}><p /></Section>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  test('toggle button has aria-expanded=false when defaultOpen=false', () => {
    render(<Section title="T" defaultOpen={false}><p /></Section>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  test('clicking toggle hides then shows content', async () => {
    const user = userEvent.setup();
    render(
      <Section title="S" defaultOpen={true}>
        <p>visible</p>
      </Section>
    );
    expect(screen.getByText('visible')).toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(screen.queryByText('visible')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('visible')).toBeInTheDocument();
  });
});

// ── BarChartCSS ───────────────────────────────────────────────────────────────

describe('BarChartCSS', () => {
  const data = [
    { name: 'JavaScript', count: 80 },
    { name: 'Python', count: 40 },
    { name: 'Go', count: 20 },
  ];

  test('renders one row per data item with label and value', () => {
    render(<BarChartCSS data={data} valueKey="count" labelKey="name" colors="#000" />);
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('Go')).toBeInTheDocument();
  });

  test('uses formatValue when provided', () => {
    render(
      <BarChartCSS
        data={data}
        valueKey="count"
        labelKey="name"
        colors="#000"
        formatValue={v => `${v} files`}
      />
    );
    expect(screen.getByText('80 files')).toBeInTheDocument();
    expect(screen.getByText('40 files')).toBeInTheDocument();
  });

  test('falls back to toLocaleString when no formatValue', () => {
    render(<BarChartCSS data={[{ name: 'A', count: 1000 }]} valueKey="count" labelKey="name" colors="#000" />);
    expect(screen.getByText((1000).toLocaleString())).toBeInTheDocument();
  });

  test('widest bar has 100% width', () => {
    const { container } = render(
      <BarChartCSS data={data} valueKey="count" labelKey="name" colors="#000" />
    );
    const bars = container.querySelectorAll('.h-4.rounded-full.transition-all');
    expect(bars[0].style.width).toBe('100%');
  });
});

// ── LangIcon ──────────────────────────────────────────────────────────────────

describe('LangIcon', () => {
  test('renders an <i> with devicon class for a known language', () => {
    const { container } = render(<LangIcon name="Python" />);
    const i = container.querySelector('i');
    expect(i).toBeInTheDocument();
    expect(i.className).toContain('devicon-python-plain');
  });

  test('renders nothing for null name', () => {
    const { container } = render(<LangIcon name={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing for empty string', () => {
    const { container } = render(<LangIcon name="" />);
    expect(container).toBeEmptyDOMElement();
  });

  test('applies extra className', () => {
    const { container } = render(<LangIcon name="JavaScript" className="text-xl" />);
    expect(container.querySelector('i').className).toContain('text-xl');
  });

  test('uses devicon alias for c/c++', () => {
    const { container } = render(<LangIcon name="C/C++" />);
    expect(container.querySelector('i').className).toContain('devicon-cplusplus-plain');
  });
});

// ── TopBar ────────────────────────────────────────────────────────────────────

describe('TopBar', () => {
  test('renders Home button and ghminer link', () => {
    render(<TopBar onHome={() => {}} />);
    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ghminer/i })).toBeInTheDocument();
  });

  test('calls onHome when Home button is clicked', async () => {
    const onHome = jest.fn();
    const user = userEvent.setup();
    render(<TopBar onHome={onHome} />);
    await user.click(screen.getByRole('button', { name: /home/i }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  test('ghminer link points to the GitHub repo', () => {
    render(<TopBar onHome={() => {}} />);
    expect(screen.getByRole('link', { name: /ghminer/i })).toHaveAttribute(
      'href',
      'https://github.com/andrehora/ghminer'
    );
  });
});

// ── Header ────────────────────────────────────────────────────────────────────

describe('Header', () => {
  test('renders the ghminer heading', () => {
    render(<Header />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ghminer');
  });

  test('renders the tagline', () => {
    render(<Header />);
    expect(screen.getByText(/analyze github repositories/i)).toBeInTheDocument();
  });
});

// ── RepoInput ─────────────────────────────────────────────────────────────────

describe('RepoInput', () => {
  const defaultProps = {
    url: '',
    onUrlChange: () => {},
    onSubmit: () => {},
    error: '',
    disabled: false,
    repoList: [],
  };

  test('renders URL input and Analyze button', () => {
    render(<RepoInput {...defaultProps} />);
    expect(screen.getByPlaceholderText(/github\.com\/user\/repo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument();
  });

  test('shows error message when error prop is set', () => {
    render(<RepoInput {...defaultProps} error="Invalid URL" />);
    expect(screen.getByText('Invalid URL')).toBeInTheDocument();
  });

  test('hides error message when error is empty', () => {
    render(<RepoInput {...defaultProps} error="" />);
    expect(screen.queryByText('Invalid URL')).not.toBeInTheDocument();
  });

  test('input is disabled when disabled=true', () => {
    render(<RepoInput {...defaultProps} disabled={true} />);
    expect(screen.getByPlaceholderText(/github\.com\/user\/repo/i)).toBeDisabled();
  });

  test('calls onUrlChange when typing', async () => {
    const onUrlChange = jest.fn();
    const user = userEvent.setup();
    render(<RepoInput {...defaultProps} onUrlChange={onUrlChange} />);
    await user.type(screen.getByPlaceholderText(/github\.com\/user\/repo/i), 'a');
    expect(onUrlChange).toHaveBeenCalled();
  });

  test('calls onSubmit when Analyze button is clicked', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    render(<RepoInput {...defaultProps} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: /analyze/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test('calls onSubmit on Enter key in input', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    render(<RepoInput {...defaultProps} onSubmit={onSubmit} />);
    await user.type(screen.getByPlaceholderText(/github\.com\/user\/repo/i), '{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test('shows autocomplete suggestions filtered from repoList', () => {
    const repoList = [
      { name: 'facebook/react', language: 'JavaScript' },
      { name: 'facebook/jest', language: 'JavaScript' },
      { name: 'django/django', language: 'Python' },
    ];
    render(<RepoInput {...defaultProps} repoList={repoList} />);
    // Use fireEvent.change to set the full value at once (controlled input — url prop stays '')
    fireEvent.change(screen.getByPlaceholderText(/github\.com\/user\/repo/i), {
      target: { value: 'face' },
    });
    expect(screen.getByText('facebook/react')).toBeInTheDocument();
    expect(screen.getByText('facebook/jest')).toBeInTheDocument();
    expect(screen.queryByText('django/django')).not.toBeInTheDocument();
  });

  test('selecting a suggestion calls onUrlChange with full GitHub URL', () => {
    const onUrlChange = jest.fn();
    const repoList = [{ name: 'facebook/react', language: 'JavaScript' }];
    render(<RepoInput {...defaultProps} onUrlChange={onUrlChange} repoList={repoList} />);
    fireEvent.change(screen.getByPlaceholderText(/github\.com\/user\/repo/i), {
      target: { value: 'face' },
    });
    fireEvent.mouseDown(screen.getByText('facebook/react'));
    expect(onUrlChange).toHaveBeenCalledWith('https://github.com/facebook/react');
  });
});

// ── LoadingProgress ───────────────────────────────────────────────────────────

describe('LoadingProgress', () => {
  test('shows file count in loading phase', () => {
    render(<LoadingProgress phase="loading" progress={{ done: 5, total: 20 }} onCancel={() => {}} />);
    expect(screen.getByText(/5.*20/)).toBeInTheDocument();
  });

  test('shows tree-sitter message in parsing phase', () => {
    render(<LoadingProgress phase="parsing" progress={{ done: 0, total: 0 }} onCancel={() => {}} />);
    expect(screen.getByText(/tree-sitter/i)).toBeInTheDocument();
  });

  test('renders Cancel button', () => {
    render(<LoadingProgress phase="loading" progress={{ done: 0, total: 10 }} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  test('calls onCancel when Cancel is clicked', async () => {
    const onCancel = jest.fn();
    const user = userEvent.setup();
    render(<LoadingProgress phase="loading" progress={{ done: 0, total: 10 }} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('progress bar width reflects done/total ratio', () => {
    const { container } = render(
      <LoadingProgress phase="loading" progress={{ done: 5, total: 10 }} onCancel={() => {}} />
    );
    const bar = container.querySelector('.bg-accent');
    expect(bar.style.width).toBe('50%');
  });

  test('progress bar is 0% when total is 0', () => {
    const { container } = render(
      <LoadingProgress phase="loading" progress={{ done: 0, total: 0 }} onCancel={() => {}} />
    );
    const bar = container.querySelector('.bg-accent');
    expect(bar.style.width).toBe('0%');
  });
});

// ── RepoInput — keyboard navigation ──────────────────────────────────────────

describe('RepoInput keyboard navigation', () => {
  const repoList = [
    { name: 'facebook/react', language: 'JavaScript' },
    { name: 'facebook/jest', language: 'JavaScript' },
  ];
  const defaultProps = {
    url: '',
    onUrlChange: jest.fn(),
    onSubmit: jest.fn(),
    error: '',
    disabled: false,
    repoList,
  };

  beforeEach(() => jest.clearAllMocks());

  test('ArrowDown highlights first suggestion', () => {
    render(<RepoInput {...defaultProps} />);
    const input = screen.getByPlaceholderText(/github\.com\/user\/repo/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'face' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const items = screen.getAllByRole('listitem');
    expect(items[0].className).toContain('bg-gray-100');
  });

  test('ArrowUp at top does not highlight any item', () => {
    render(<RepoInput {...defaultProps} />);
    const input = screen.getByPlaceholderText(/github\.com\/user\/repo/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'face' } });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    const items = screen.getAllByRole('listitem');
    expect(items[0].className).not.toContain('bg-gray-100');
  });

  test('Enter with highlighted suggestion selects it', () => {
    const onUrlChange = jest.fn();
    render(<RepoInput {...defaultProps} onUrlChange={onUrlChange} />);
    const input = screen.getByPlaceholderText(/github\.com\/user\/repo/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'face' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUrlChange).toHaveBeenCalledWith('https://github.com/facebook/react');
  });

  test('Escape closes suggestion list', () => {
    render(<RepoInput {...defaultProps} />);
    const input = screen.getByPlaceholderText(/github\.com\/user\/repo/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'face' } });
    expect(screen.getByText('facebook/react')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('facebook/react')).not.toBeInTheDocument();
  });
});

// ── Results ───────────────────────────────────────────────────────────────────

const makeResult = (overrides = {}) => ({
  totalFiles: 42,
  totalLines: 1234,
  totalSize: 56789,
  avgSize: 1351,
  languages: [
    { lang: 'JavaScript', files: 30, lines: 1000, pct: '71.4' },
    { lang: 'Python', files: 12, lines: 234, pct: '28.6' },
  ],
  top10: [
    { path: 'src/main.js', size: 10240 },
    { path: 'src/utils.js', size: 5120 },
  ],
  buckets: { '< 1 KB': 10, '1–10 KB': 20, '10–50 KB': 8, '50–100 KB': 2, '> 100 KB': 1 },
  ...overrides,
});

const makeNodes = (overrides = []) => [
  { type: 'function_declaration', typeLower: 'function_declaration', count: 10, sources: [{ text: 'function foo() {}', textLower: 'function foo() {}', file: 'src/a.js' }], custom: false },
  { type: 'identifier', typeLower: 'identifier', count: 25, sources: [{ text: 'foo', textLower: 'foo', file: 'src/a.js' }], custom: false },
  ...overrides,
];

const makeTsResults = (nodes = makeNodes()) => [
  { id: 'javascript', label: 'JavaScript', fileCount: 30, nodes, error: '' },
];

describe('Results — basic rendering', () => {
  test('renders Overview section', () => {
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={[]} tsError="" />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  test('renders Language Breakdown section', () => {
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={[]} tsError="" />);
    expect(screen.getByText('Language Breakdown')).toBeInTheDocument();
  });

  test('renders File Size Distribution section', () => {
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={[]} tsError="" />);
    expect(screen.getByText('File Size Distribution')).toBeInTheDocument();
  });

  test('shows stat cards after opening Overview', async () => {
    const user = userEvent.setup();
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={[]} tsError="" />);
    await user.click(screen.getByText('Overview'));
    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('Lines of Code')).toBeInTheDocument();
    expect(screen.getByText('Total Size')).toBeInTheDocument();
    expect(screen.getByText('Languages')).toBeInTheDocument();
  });

  test('Overview stat cards show correct values', async () => {
    const user = userEvent.setup();
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={[]} tsError="" />);
    await user.click(screen.getByText('Overview'));
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });
});

describe('Results — repoInfo', () => {
  test('renders user/repo link when repoInfo provided', () => {
    render(<Results result={makeResult()} repoInfo={{ user: 'facebook', repo: 'react' }} errors={[]} tsResults={[]} tsError="" />);
    expect(screen.getByText('facebook')).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /facebook.*react/i })).toHaveAttribute(
      'href', 'https://github.com/facebook/react'
    );
  });

  test('renders nothing for repoInfo when null', () => {
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={[]} tsError="" />);
    expect(screen.queryByRole('link', { name: /github\.com/i })).not.toBeInTheDocument();
  });
});

describe('Results — language breakdown', () => {
  test('shows language names in table after opening section', async () => {
    const user = userEvent.setup();
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={[]} tsError="" />);
    await user.click(screen.getByText('Language Breakdown'));
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
  });

  test('shows file and line counts in language table', async () => {
    const user = userEvent.setup();
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={[]} tsError="" />);
    await user.click(screen.getByText('Language Breakdown'));
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });
});

describe('Results — file size distribution', () => {
  test('shows top-10 files after opening section', async () => {
    const user = userEvent.setup();
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={[]} tsError="" />);
    await user.click(screen.getByText('File Size Distribution'));
    expect(screen.getByText('main.js')).toBeInTheDocument();
    expect(screen.getByText('utils.js')).toBeInTheDocument();
  });

  test('shows average file size', async () => {
    const user = userEvent.setup();
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={[]} tsError="" />);
    await user.click(screen.getByText('File Size Distribution'));
    expect(screen.getByText(/average file size/i)).toBeInTheDocument();
  });
});

describe('Results — errors', () => {
  test('shows error list when errors present', () => {
    render(<Results result={makeResult()} repoInfo={null} errors={['src/broken.js', 'src/missing.ts']} tsResults={[]} tsError="" />);
    expect(screen.getByText('src/broken.js')).toBeInTheDocument();
    expect(screen.getByText('src/missing.ts')).toBeInTheDocument();
  });

  test('shows count of failed files', () => {
    render(<Results result={makeResult()} repoInfo={null} errors={['a.js', 'b.js']} tsResults={[]} tsError="" />);
    expect(screen.getByText(/failed to fetch 2 file/i)).toBeInTheDocument();
  });

  test('dismiss button hides error panel', async () => {
    const user = userEvent.setup();
    render(<Results result={makeResult()} repoInfo={null} errors={['src/broken.js']} tsResults={[]} tsError="" />);
    expect(screen.getByText('src/broken.js')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText('src/broken.js')).not.toBeInTheDocument();
  });

  test('renders nothing for errors when list is empty', () => {
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={[]} tsError="" />);
    expect(screen.queryByText(/failed to fetch/i)).not.toBeInTheDocument();
  });
});

describe('Results — tsError', () => {
  test('shows tsError banner when tsError is set', () => {
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={[]} tsError="WASM load failed" />);
    expect(screen.getByText('WASM load failed')).toBeInTheDocument();
  });

  test('no banner when tsError is empty', () => {
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={[]} tsError="" />);
    expect(screen.queryByText('WASM load failed')).not.toBeInTheDocument();
  });
});

describe('Results — AST section', () => {
  test('shows AST section when tsResults has data', () => {
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={makeTsResults()} tsError="" />);
    expect(screen.getByText(/AST Node Types/i)).toBeInTheDocument();
  });

  test('does not show AST section when tsResults is empty', () => {
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={[]} tsError="" />);
    expect(screen.queryByText(/AST Node Types/i)).not.toBeInTheDocument();
  });

  test('renders node types in table', () => {
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={makeTsResults()} tsError="" />);
    // Each node type appears both as a Language Node button and as a table row cell
    expect(screen.getAllByText('function_declaration').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('identifier').length).toBeGreaterThanOrEqual(1);
  });

  test('renders node counts', () => {
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={makeTsResults()} tsError="" />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  test('shows source code examples', () => {
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={makeTsResults()} tsError="" />);
    expect(screen.getByText('function foo() {}')).toBeInTheDocument();
  });

  test('shows "No matches" when search finds nothing', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={makeTsResults()} tsError="" />);
    const input = screen.getByPlaceholderText(/search text or type/i);
    await user.type(input, 'xyznotfound');
    act(() => jest.runAllTimers());
    expect(screen.getByText('No matches')).toBeInTheDocument();
    jest.useRealTimers();
  });

  test('shows "No nodes parsed" when nodes array is empty', () => {
    const tsResults = [{ id: 'javascript', label: 'JavaScript', fileCount: 0, nodes: [], error: '' }];
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={tsResults} tsError="" />);
    expect(screen.getByText(/no nodes parsed/i)).toBeInTheDocument();
  });

  test('shows lang-parse error inside section when activeLang has error', () => {
    const tsResults = [{ id: 'javascript', label: 'JavaScript', fileCount: 5, nodes: [], error: 'parse failed' }];
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={tsResults} tsError="" />);
    expect(screen.getByText(/parse failed/i)).toBeInTheDocument();
  });
});

describe('Results — AST language tabs', () => {
  const multiTsResults = [
    { id: 'javascript', label: 'JavaScript', fileCount: 30, nodes: makeNodes(), error: '' },
    { id: 'python', label: 'Python', fileCount: 12, nodes: [
      { type: 'def_statement', typeLower: 'def_statement', count: 5, sources: [{ text: 'def bar():', textLower: 'def bar():', file: 'src/b.py' }], custom: false },
    ], error: '' },
  ];

  test('shows language tab buttons when multiple tsResults', () => {
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={multiTsResults} tsError="" />);
    expect(screen.getByRole('button', { name: /javascript/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /python/i })).toBeInTheDocument();
  });

  test('clicking a language tab switches the active nodes', async () => {
    const user = userEvent.setup();
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={multiTsResults} tsError="" />);
    // function_declaration is shown in the table (as a td)
    expect(screen.getAllByText('function_declaration').some(el => el.tagName === 'TD')).toBe(true);
    await user.click(screen.getByRole('button', { name: /python/i }));
    expect(screen.getAllByText('def_statement').length).toBeGreaterThanOrEqual(1);
    // function_declaration table row is gone
    expect(screen.queryAllByText('function_declaration').some(el => el.tagName === 'TD')).toBe(false);
  });

  test('does not show tab buttons for single tsResult', () => {
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={makeTsResults()} tsError="" />);
    // Only one button visible should be section toggle, no lang tab
    const buttons = screen.getAllByRole('button');
    const langTabButtons = buttons.filter(b => b.textContent.includes('JavaScript') && b.textContent.includes('30'));
    expect(langTabButtons).toHaveLength(0);
  });
});

describe('Results — AST node type badges', () => {
  test('clicking a Language Node button adds it as a badge filter', async () => {
    const user = userEvent.setup();
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={makeTsResults()} tsError="" />);
    await user.click(screen.getByRole('button', { name: 'function_declaration' }));
    // A "Remove node type filter" badge button now appears
    expect(screen.getByRole('button', { name: /remove node type filter/i })).toBeInTheDocument();
  });

  test('show more/less button appears when node types exceed 15', () => {
    const manyNodes = Array.from({ length: 20 }, (_, i) => ({
      type: `node_type_${i}`,
      typeLower: `node_type_${i}`,
      count: i + 1,
      sources: [{ text: `example ${i}`, textLower: `example ${i}`, file: 'src/a.js' }],
      custom: false,
    }));
    const tsResults = [{ id: 'javascript', label: 'JavaScript', fileCount: 10, nodes: manyNodes, error: '' }];
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={tsResults} tsError="" />);
    expect(screen.getByRole('button', { name: /\+ \d+ more/ })).toBeInTheDocument();
  });

  test('clicking show more expands all node type buttons', async () => {
    const user = userEvent.setup();
    const manyNodes = Array.from({ length: 20 }, (_, i) => ({
      type: `node_type_${i}`,
      typeLower: `node_type_${i}`,
      count: i + 1,
      sources: [{ text: `example ${i}`, textLower: `example ${i}`, file: 'src/a.js' }],
      custom: false,
    }));
    const tsResults = [{ id: 'javascript', label: 'JavaScript', fileCount: 10, nodes: manyNodes, error: '' }];
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={tsResults} tsError="" />);
    await user.click(screen.getByRole('button', { name: /\+ \d+ more/ }));
    expect(screen.getByRole('button', { name: /− less/ })).toBeInTheDocument();
    expect(screen.getAllByText('node_type_19').length).toBeGreaterThanOrEqual(1);
  });
});

// ── RepoInput — blur closes suggestions ──────────────────────────────────────

describe('RepoInput blur', () => {
  const defaultProps = {
    url: '',
    onUrlChange: jest.fn(),
    onSubmit: jest.fn(),
    error: '',
    disabled: false,
    repoList: [{ name: 'facebook/react', language: 'JavaScript' }],
  };

  test('blurring the input closes the suggestion list after 150 ms', async () => {
    jest.useFakeTimers();
    render(<RepoInput {...defaultProps} />);
    const input = screen.getByPlaceholderText(/github\.com\/user\/repo/i);
    fireEvent.change(input, { target: { value: 'face' } });
    expect(screen.getByText('facebook/react')).toBeInTheDocument();
    fireEvent.blur(input);
    act(() => jest.runAllTimers());
    expect(screen.queryByText('facebook/react')).not.toBeInTheDocument();
    jest.useRealTimers();
  });
});

// ── Results — AST node type / suggestions ────────────────────────────────────

const nodeResultProps = () => ({
  result: makeResult(),
  repoInfo: null,
  errors: [],
  tsResults: makeTsResults(),
  tsError: '',
});

describe('Results — AST node type / suggestions', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  test('typing / opens the node type suggestion dropdown', () => {
    render(<Results {...nodeResultProps()} />);
    const input = screen.getByPlaceholderText(/search text or type/i);
    fireEvent.change(input, { target: { value: '/' } });
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
  });

  test('suggestion list shows node type names sorted by count', () => {
    render(<Results {...nodeResultProps()} />);
    const input = screen.getByPlaceholderText(/search text or type/i);
    fireEvent.change(input, { target: { value: '/' } });
    const items = screen.getAllByRole('listitem');
    // identifier(25) comes before function_declaration(10)
    expect(items[0]).toHaveTextContent('identifier');
    expect(items[1]).toHaveTextContent('function_declaration');
  });

  test('clicking a suggestion adds it as a badge', () => {
    render(<Results {...nodeResultProps()} />);
    const input = screen.getByPlaceholderText(/search text or type/i);
    fireEvent.change(input, { target: { value: '/' } });
    fireEvent.mouseDown(screen.getAllByRole('listitem')[0]);
    expect(screen.getByRole('button', { name: /remove node type filter/i })).toBeInTheDocument();
  });

  test('ArrowDown highlights the first suggestion', () => {
    render(<Results {...nodeResultProps()} />);
    const input = screen.getByPlaceholderText(/search text or type/i);
    fireEvent.change(input, { target: { value: '/' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('listitem')[0].className).toContain('bg-gray-100');
  });

  test('ArrowUp at index -1 does not highlight any item', () => {
    render(<Results {...nodeResultProps()} />);
    const input = screen.getByPlaceholderText(/search text or type/i);
    fireEvent.change(input, { target: { value: '/' } });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getAllByRole('listitem')[0].className).not.toContain('bg-gray-100');
  });

  test('Enter with a highlighted suggestion selects it and adds a badge', () => {
    render(<Results {...nodeResultProps()} />);
    const input = screen.getByPlaceholderText(/search text or type/i);
    fireEvent.change(input, { target: { value: '/' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('button', { name: /remove node type filter/i })).toBeInTheDocument();
  });

  test('Tab auto-completes to the first suggestion and adds a badge', () => {
    render(<Results {...nodeResultProps()} />);
    const input = screen.getByPlaceholderText(/search text or type/i);
    fireEvent.change(input, { target: { value: '/' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(screen.getByRole('button', { name: /remove node type filter/i })).toBeInTheDocument();
  });

  test('Escape clears the / text and closes the dropdown', () => {
    render(<Results {...nodeResultProps()} />);
    const input = screen.getByPlaceholderText(/search text or type/i);
    fireEvent.change(input, { target: { value: '/' } });
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  test('a colon-separated term that is not a valid node type does not become a badge', () => {
    render(<Results {...nodeResultProps()} />);
    const input = screen.getByPlaceholderText(/search text or type/i);
    fireEvent.change(input, { target: { value: 'nonexistent_type:' } });
    expect(screen.queryByRole('button', { name: /remove node type filter/i })).not.toBeInTheDocument();
  });
});

// ── Results — AST badge removal ───────────────────────────────────────────────

describe('Results — AST badge removal', () => {
  test('clicking × on a badge removes it', async () => {
    const user = userEvent.setup();
    render(<Results {...nodeResultProps()} />);
    await user.click(screen.getByRole('button', { name: 'function_declaration' }));
    expect(screen.getByRole('button', { name: /remove node type filter/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /remove node type filter/i }));
    expect(screen.queryByRole('button', { name: /remove node type filter/i })).not.toBeInTheDocument();
  });

  test('Backspace at the start of input removes the last badge', async () => {
    const user = userEvent.setup();
    render(<Results {...nodeResultProps()} />);
    await user.click(screen.getByRole('button', { name: 'function_declaration' }));
    expect(screen.getByRole('button', { name: /remove node type filter/i })).toBeInTheDocument();
    const input = screen.getByPlaceholderText(/filter text or type/i);
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(screen.queryByRole('button', { name: /remove node type filter/i })).not.toBeInTheDocument();
  });

  test('clicking an already-active Language Node button removes the badge', async () => {
    const user = userEvent.setup();
    render(<Results {...nodeResultProps()} />);
    await user.click(screen.getByRole('button', { name: 'function_declaration' }));
    expect(screen.getByRole('button', { name: /remove node type filter/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'function_declaration' }));
    expect(screen.queryByRole('button', { name: /remove node type filter/i })).not.toBeInTheDocument();
  });
});

// ── Results — AST custom nodes ────────────────────────────────────────────────

const makeCustomNode = () => ({
  type: 'fetch_call',
  typeLower: 'fetch_call',
  count: 3,
  sources: [{ text: 'fetch("/api")', textLower: 'fetch("/api")', file: 'src/a.js' }],
  custom: true,
  node: 'call_expression',
  substring: 'fetch',
});

const makeTsResultsWithCustom = () => [
  { id: 'javascript', label: 'JavaScript', fileCount: 30, nodes: [...makeNodes(), makeCustomNode()], error: '' },
];

describe('Results — AST custom nodes', () => {
  test('shows a Custom Nodes section when custom nodes are present', () => {
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={makeTsResultsWithCustom()} tsError="" />);
    expect(screen.getByText('Custom Nodes:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'fetch_call' })).toBeInTheDocument();
  });

  test('clicking a custom node button adds it as a badge', async () => {
    const user = userEvent.setup();
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={makeTsResultsWithCustom()} tsError="" />);
    await user.click(screen.getByRole('button', { name: 'fetch_call' }));
    expect(screen.getByRole('button', { name: /remove node type filter/i })).toBeInTheDocument();
  });

  test('clicking an active custom node button removes the badge', async () => {
    const user = userEvent.setup();
    render(<Results result={makeResult()} repoInfo={null} errors={[]} tsResults={makeTsResultsWithCustom()} tsError="" />);
    await user.click(screen.getByRole('button', { name: 'fetch_call' }));
    expect(screen.getByRole('button', { name: /remove node type filter/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'fetch_call' }));
    expect(screen.queryByRole('button', { name: /remove node type filter/i })).not.toBeInTheDocument();
  });
});

// ── Results — AST search text highlighting ────────────────────────────────────

describe('Results — AST search text highlighting', () => {
  test('searching text that matches a source wraps it in a <mark> element', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { container } = render(<Results {...nodeResultProps()} />);
    const input = screen.getByPlaceholderText(/search text or type/i);
    await user.type(input, 'foo');
    act(() => jest.runAllTimers());
    expect(container.querySelector('mark')).toBeInTheDocument();
    jest.useRealTimers();
  });
});

// ── Results — tsResults change resets active lang ─────────────────────────────

describe('Results — tsResults change', () => {
  test('resets active lang to first when current lang is no longer in tsResults', async () => {
    const user = userEvent.setup();
    const twoLangs = [
      { id: 'javascript', label: 'JavaScript', fileCount: 10, nodes: makeNodes(), error: '' },
      { id: 'python', label: 'Python', fileCount: 5, nodes: [], error: '' },
    ];
    const { rerender } = render(
      <Results result={makeResult()} repoInfo={null} errors={[]} tsResults={twoLangs} tsError="" />
    );
    await user.click(screen.getByRole('button', { name: /python/i }));
    act(() => {
      rerender(
        <Results result={makeResult()} repoInfo={null} errors={[]}
          tsResults={[{ id: 'javascript', label: 'JavaScript', fileCount: 10, nodes: makeNodes(), error: '' }]}
          tsError="" />
      );
    });
    // Falls back to javascript — function_declaration is in the table
    expect(screen.getAllByText('function_declaration').some(el => el.tagName === 'TD')).toBe(true);
  });
});
