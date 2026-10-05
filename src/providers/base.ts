import { MediaItemQuery, StreamResult } from '../types';

export interface BaseProvider {
  readonly name: string;
  readonly baseUrl: string;
  getStreams(query: MediaItemQuery): Promise<StreamResult[]>;
}
