import * as Dns from "node:dns";
import { BlockList, isIP, type LookupFunction } from "node:net";

import { NodeHttpClient } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpClient, HttpClientError, type HttpClientRequest } from "effect/http";

import { ServerConfig } from "#/config.ts";

const familyOf = (address: string) => (isIP(address) === 6 ? "ipv6" : "ipv4");

// The private, loopback, and special-use ranges of the IANA registries (RFC 6890 and its updates):
// none is a public server's, and reaching one would let a request probe Quack's own network.
const notPublic = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  notPublic.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  // IPv4-mapped and translated addresses reach an IPv4 address of any range.
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  notPublic.addSubnet(network, prefix, "ipv6");
}

const loopback = new BlockList();
loopback.addSubnet("127.0.0.0", 8, "ipv4");
loopback.addAddress("::1", "ipv6");

const reachable = (allowLoopback: boolean) => (address: string) =>
  (allowLoopback && loopback.check(address, familyOf(address))) ||
  !notPublic.check(address, familyOf(address));

/** Resolves as Node does, then refuses the host if any of its addresses is not reachable. */
const guardedLookup =
  (isReachable: (address: string) => boolean): LookupFunction =>
  (hostname, options, callback) => {
    Dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
      const refused = addresses?.find(({ address }) => !isReachable(address));
      const [first] = addresses ?? [];
      if (error !== null || first === undefined) {
        callback(error ?? new Error(`${hostname} has no address`), "", 0);
      } else if (refused !== undefined) {
        callback(
          new Error(`${hostname} resolves to ${refused.address}, not a public address`),
          "",
          0,
        );
      } else if (options.all === true) {
        callback(null, addresses);
      } else {
        callback(null, first.address, first.family);
      }
    });
  };

const refusedLiteral = (request: HttpClientRequest.HttpClientRequest, address: string) =>
  new HttpClientError.HttpClientError({
    reason: new HttpClientError.TransportError({
      request,
      description: `${address} is not a public address`,
    }),
  });

/**
 * The `HttpClient` that fetches AI Clients' documents: through `node:http`, which follows no
 * redirect, and only to public addresses, checked as the connection is made so that a host cannot
 * resolve to one address when checked and another when reached. With `AI_CLIENT_LOOPBACK_HTTP`,
 * loopback addresses are reachable too.
 */
export const AiClientHttpClient = Layer.unwrap(
  Effect.gen(function* () {
    const isReachable = reachable(yield* ServerConfig.allowLoopbackHttpAiClients);

    return Layer.effect(
      HttpClient.HttpClient,
      Effect.map(HttpClient.HttpClient, (client) =>
        HttpClient.mapRequestEffect(client, (request) => {
          // Node resolves no name for an address in the URL, so the lookup never sees it.
          const address = new URL(request.url).hostname.replace(/^\[(.*)\]$/, "$1");
          return isIP(address) !== 0 && !isReachable(address)
            ? Effect.fail(refusedLiteral(request, address))
            : Effect.succeed(request);
        }),
      ),
    ).pipe(
      Layer.provide(NodeHttpClient.layerNodeHttpOptions({ lookup: guardedLookup(isReachable) })),
    );
  }),
);
