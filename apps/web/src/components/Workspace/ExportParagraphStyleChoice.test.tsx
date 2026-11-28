import {fireEvent, render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import {readExportParagraphStyle} from '../../utils/exportParagraphStyle';
import {ExportParagraphStyleChoice} from './ExportParagraphStyleChoice';

describe('ExportParagraphStyleChoice (4.98)', () => {
  beforeEach(() => localStorage.clear());

  it('starts on Indented and remembers a change for the project', () => {
    const {unmount} = render(<ExportParagraphStyleChoice projectId='p1' />);
    const select = screen.getByLabelText('Paragraphs') as HTMLSelectElement;
    expect(select.value).toBe('indented');
    expect(screen.getByText(/like a printed book/)).toBeTruthy();

    fireEvent.change(select, {target: {value: 'spaced'}});
    expect(screen.getByText(/A gap between paragraphs/)).toBeTruthy();
    expect(readExportParagraphStyle('p1')).toBe('spaced');
    unmount();

    render(<ExportParagraphStyleChoice projectId='p1' />);
    expect((screen.getByLabelText('Paragraphs') as HTMLSelectElement).value).toBe('spaced');
  });
});
