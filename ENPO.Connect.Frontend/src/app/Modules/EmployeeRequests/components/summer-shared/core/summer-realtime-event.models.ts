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
  waveCode: string;
  action: string;
};

export type SummerRealtimeEvent = SummerRequestRealtimeEvent | SummerCapacityRealtimeEvent;
