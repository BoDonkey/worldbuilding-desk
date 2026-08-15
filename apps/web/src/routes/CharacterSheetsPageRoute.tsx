import {useState} from 'react';
import {useLocation} from 'react-router';
import CharacterSheetsRoute from './CharacterSheetsRoute';

interface CharacterSheetsLocationState {
  prefillCharacterId?: string;
  autoCreateSheetForCharacterId?: string;
  prefillSheetId?: string;
  prefillSceneId?: string;
  initialTaskView?: 'setup' | 'scene-history';
  showAdvanced?: boolean;
}

function CharacterSheetsPageRoute() {
  const location = useLocation();
  const locationState = location.state as CharacterSheetsLocationState | null;
  const [prefillCharacterId, setPrefillCharacterId] = useState(
    locationState?.prefillCharacterId ?? null
  );
  const [autoCreateSheetCharacterId, setAutoCreateSheetCharacterId] = useState(
    locationState?.autoCreateSheetForCharacterId ?? null
  );

  return (
    <CharacterSheetsRoute
      prefillCharacterId={prefillCharacterId}
      onPrefillConsumed={() => setPrefillCharacterId(null)}
      autoCreateSheetCharacterId={autoCreateSheetCharacterId}
      onAutoCreateConsumed={() => setAutoCreateSheetCharacterId(null)}
      prefillSheetId={locationState?.prefillSheetId}
      prefillSceneId={locationState?.prefillSceneId}
      initialTaskView={locationState?.initialTaskView}
      initialShowAdvanced={locationState?.showAdvanced}
    />
  );
}

export default CharacterSheetsPageRoute;
