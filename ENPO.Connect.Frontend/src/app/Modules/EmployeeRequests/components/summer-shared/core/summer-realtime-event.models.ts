export type SummerRealtimeEventKind = 'request' | 'capacity';

type SummerRealtimeEventBase = {
  kind: SummerRealtimeEventKind;
  raw: string;
  signature: string;
  emittedAtEpochMs: number;
};

export type SummerRequestRealtimeEvent = SummerRealtimeEventBase & {
  kind: 'request';
  messageId: number;
  action: string;
};

export type SummerCapacityRealtimeEvent = SummerRealtimeEventBase & {
  kind: 'capacity';
  categoryId: number;
  destinationId?: number;
  destinationName?: string;
  waveCode: string;
  batchNumber?: string;
  action: string;
  sender?: string;
  title?: string;
  emittedAtIso?: string;
};

export type SummerRealtimeEvent = SummerRequestRealtimeEvent | SummerCapacityRealtimeEvent;
