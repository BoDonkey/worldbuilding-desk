import { ConsistencyEngineService } from './ConsistencyEngineService';

let singleton: ConsistencyEngineService | null = null;

export function getConsistencyEngineService(): ConsistencyEngineService {
  if (!singleton) {
    singleton = new ConsistencyEngineService();
  }
  return singleton;
}
