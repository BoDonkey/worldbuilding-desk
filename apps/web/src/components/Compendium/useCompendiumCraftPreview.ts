import {useMemo, useState} from 'react';
import {parsePreviewMaterials} from '../../services/compendium/compendiumFormValues';

export function useCompendiumCraftPreview() {
  const [previewLevel, setPreviewLevel] = useState(1);
  const [previewMaterialsText, setPreviewMaterialsText] = useState('');
  const parsedPreviewMaterials = useMemo(
    () => parsePreviewMaterials(previewMaterialsText), [previewMaterialsText]
  );
  return {previewLevel, setPreviewLevel, previewMaterialsText, setPreviewMaterialsText, parsedPreviewMaterials};
}
