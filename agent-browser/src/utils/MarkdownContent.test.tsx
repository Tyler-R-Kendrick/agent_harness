import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from './MarkdownContent';

describe('MarkdownContent', () => {
  it('renders external markdown links in a new safe tab', () => {
    render(<MarkdownContent content="[AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12)" />);

    const link = screen.getByRole('link', { name: 'AMC Randhurst 12' });
    expect(link).toHaveAttribute('href', 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });
});
