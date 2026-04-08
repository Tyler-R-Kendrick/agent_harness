import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the agent browser shell', () => {
    render(<App />);
    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Omnibar')).toBeInTheDocument();
    expect(screen.getAllByText('Agent Chat').length).toBeGreaterThan(0);
  });

  it('renders settings and history labels from the navigation', () => {
    render(<App />);
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
    expect(screen.getByLabelText('History')).toBeInTheDocument();
  });
});
