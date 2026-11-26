import { describe, it, expect, vi, beforeEach } from "vitest";
import { subscribeReservationsRealtime } from "./useReservations";

const { channelRegistry, mockChannelFn, mockRemoveChannelFn } = vi.hoisted(
  () => {
    type FakeChannel = {
      name: string;
      subscribed: boolean;
      handler: (() => void) | null;
      on: (type: string, filter: unknown, cb: () => void) => FakeChannel;
      subscribe: () => FakeChannel;
    };

    const registry = new Map<string, FakeChannel>();

    const channelFn = vi.fn((name: string) => {
      const existing = registry.get(name);
      if (existing) return existing;

      const ch: FakeChannel = {
        name,
        subscribed: false,
        handler: null,
        on(_type: string, _filter: unknown, cb: () => void) {
          if (ch.subscribed) {
            throw new Error(
              `cannot add postgres_changes callbacks for realtime:${name} after subscribe()`,
            );
          }
          ch.handler = cb;
          return ch;
        },
        subscribe() {
          ch.subscribed = true;
          return ch;
        },
      };
      registry.set(name, ch);
      return ch;
    });

    const removeChannelFn = vi.fn((ch: { name?: string }) => {
      if (ch?.name) {
        registry.delete(ch.name);
      }
    });

    return {
      channelRegistry: registry,
      mockChannelFn: channelFn,
      mockRemoveChannelFn: removeChannelFn,
    };
  },
);

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    channel: mockChannelFn,
    removeChannel: mockRemoveChannelFn,
  },
}));

describe("subscribeReservationsRealtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelRegistry.clear();
  });

  it("comparte un solo canal ref-counted cuando se montan múltiples suscriptores sin lanzar error tras subscribe()", () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();

    const unsubA = subscribeReservationsRealtime(listenerA);
    const unsubB = subscribeReservationsRealtime(listenerB);

    expect(mockChannelFn).toHaveBeenCalledTimes(1);
    const createdName = mockChannelFn.mock.calls[0][0] as string;
    const ch = channelRegistry.get(createdName);
    expect(ch?.subscribed).toBe(true);

    // Simular evento postgres_changes de Supabase
    ch?.handler?.();
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);

    // Desmontar solo el primero mantiene vivo el canal compartido
    unsubA();
    expect(mockRemoveChannelFn).not.toHaveBeenCalled();

    // Desmontar el último sí libera el canal
    unsubB();
    expect(mockRemoveChannelFn).toHaveBeenCalledTimes(1);
  });

  it("crea un canal con nombre distinto al volver a suscribirse luego de desmontar todo", () => {
    const unsub1 = subscribeReservationsRealtime(vi.fn());
    const firstChannelName = mockChannelFn.mock.calls[0][0] as string;
    unsub1();

    const unsub2 = subscribeReservationsRealtime(vi.fn());
    const secondChannelName = mockChannelFn.mock.calls[1][0] as string;
    expect(secondChannelName).not.toBe(firstChannelName);
    unsub2();
  });
});
