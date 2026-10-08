import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {ImportSectionPanel} from './ImportSectionPanel';

describe('ImportSectionPanel', () => {
  it('lists every detected heading, not just the first eight', () => {
    const detectedSections = Array.from({length: 11}, (_, index) => ({
      id: `section-${index}`,
      title: `Section ${index + 1}`,
      content: 'Body',
      action: 'record-section' as const
    }));
    render(
      <ImportSectionPanel
        draft={{
          id: 'draft',
          fileName: 'sheet.docx',
          name: 'Sheet',
          text: '',
          preview: '',
          categoryId: 'characters',
          mode: 'create',
          include: true,
          detectedSections,
          useDetectedSections: true
        }}
        isApplyingImports={false}
        onUpdateDraft={vi.fn()}
        onUpdateSectionAction={vi.fn()}
      />
    );

    expect(screen.getAllByRole('combobox')).toHaveLength(11);
    expect(screen.getByText('Section 11')).toBeInTheDocument();
  });
});
