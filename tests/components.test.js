import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
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
