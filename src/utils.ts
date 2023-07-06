import { generateJsonRPCObject, post } from "@toruslabs/http-helpers";
import { keccak256 as keccakHash } from "ethereum-cryptography/keccak";
import JsonStringify from "json-stable-stringify";

import { JRPCResponse, KeyAssignInput, KeyLookupResult, SignerResponse, VerifierLookupResponse } from "./interfaces";
import log from "./loglevel";
import { Some } from "./some";

export class GetOrSetNonceError extends Error {}

export const kCombinations = (s: number | number[], k: number): number[][] => {
  let set = s;
  if (typeof set === "number") {
    set = Array.from({ length: set }, (_, i) => i);
  }
  if (k > set.length || k <= 0) {
    return [];
  }

  if (k === set.length) {
    return [set];
  }

  if (k === 1) {
    return set.reduce((acc, cur) => [...acc, [cur]], [] as number[][]);
  }

  const combs: number[][] = [];
  let tailCombs: number[][] = [];

  for (let i = 0; i <= set.length - k + 1; i += 1) {
    tailCombs = kCombinations(set.slice(i + 1), k - 1);
    for (let j = 0; j < tailCombs.length; j += 1) {
      combs.push([set[i], ...tailCombs[j]]);
    }
  }

  return combs;
};

export const thresholdSame = <T>(arr: T[], t: number): T | undefined => {
  const hashMap: Record<string, number> = {};
  for (let i = 0; i < arr.length; i += 1) {
    const str = JsonStringify(arr[i]);
    hashMap[str] = hashMap[str] ? hashMap[str] + 1 : 1;
    if (hashMap[str] === t) {
      return arr[i];
    }
  }
  return undefined;
};

export const keyLookup = async (endpoints: string[], verifier: string, verifierId: string): Promise<KeyLookupResult> => {
  const lookupPromises = endpoints.map((x) =>
    post<JRPCResponse<VerifierLookupResponse>>(
      x,
      generateJsonRPCObject("VerifierLookupRequest", {
        verifier,
        verifier_id: verifierId.toString(),
      })
    ).catch((err) => log.error("lookup request failed", err))
  );
  return Some<void | JRPCResponse<VerifierLookupResponse>, KeyLookupResult>(lookupPromises, (lookupResults) => {
    const lookupShares = lookupResults.filter((x1) => x1);
    const errorResult = thresholdSame(
      lookupShares.map((x2) => x2 && x2.error),
      ~~(endpoints.length / 2) + 1
    );
    const keyResult = thresholdSame(
      lookupShares.map((x3) => x3 && x3.result),
      ~~(endpoints.length / 2) + 1
    );
    if (keyResult || errorResult) {
      return Promise.resolve({ keyResult, errorResult });
    }
    return Promise.reject(new Error(`invalid results ${JSON.stringify(lookupResults)}`));
  });
};

export const waitKeyLookup = (endpoints: string[], verifier: string, verifierId: string, timeout: number): Promise<KeyLookupResult> =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      keyLookup(endpoints, verifier, verifierId).then(resolve).catch(reject);
    }, timeout);
  });

export const keyAssign = async ({
  endpoints,
  torusNodePubs,
  lastPoint,
  firstPoint,
  verifier,
  verifierId,
  signerHost,
  network,
  clientId,
}: KeyAssignInput): Promise<void> => {
  let nodeNum: number;
  let initialPoint: number | undefined;
  if (lastPoint === undefined) {
    nodeNum = Math.floor(Math.random() * endpoints.length);
    // nodeNum = endpoints.indexOf("https://torus-node.ens.domains/jrpc");
    log.info("keyassign", nodeNum, endpoints[nodeNum]);
    initialPoint = nodeNum;
  } else {
    nodeNum = lastPoint % endpoints.length;
  }
  if (nodeNum === firstPoint) throw new Error("Looped through all");
  if (firstPoint !== undefined) initialPoint = firstPoint;

  const data = generateJsonRPCObject("KeyAssign", {
    verifier,
    verifier_id: verifierId.toString(),
  });
  try {
    const signedData = await post<SignerResponse>(
      signerHost,
      data,
      {
        headers: {
          pubKeyX: torusNodePubs[nodeNum].X,
          pubKeyY: torusNodePubs[nodeNum].Y,
          network,
          clientId,
        },
      },
      { useAPIKey: true }
    );
    return await post<void>(
      endpoints[nodeNum],
      { ...data, ...signedData },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );
  } catch (error) {
    log.error(error.status, error.message, error, "key assign error");
    const acceptedErrorMsgs = [
      // Slow node
      "Timed out",
      "Failed to fetch",
      "cancelled",
      "NetworkError when attempting to fetch resource.",
      // Happens when the node is not reachable (dns issue etc)
      "TypeError: Failed to fetch", // All except iOS and Firefox
      "TypeError: cancelled", // iOS
      "TypeError: NetworkError when attempting to fetch resource.", // Firefox
    ];
    if (
      error?.status === 502 ||
      error?.status === 504 ||
      error?.status === 401 ||
      acceptedErrorMsgs.includes(error.message) ||
      acceptedErrorMsgs.some((x) => error.message.includes(x)) ||
      (error.message && error.message.includes("reason: getaddrinfo EAI_AGAIN"))
    )
      return keyAssign({
        endpoints,
        torusNodePubs,
        lastPoint: nodeNum + 1,
        firstPoint: initialPoint,
        verifier,
        verifierId,
        signerHost,
        network,
        clientId,
      });
    throw new Error(
      `Sorry, the Torus Network that powers Web3Auth is currently very busy.
    We will generate your key in time. Pls try again later. \n
    ${error.message || ""}`
    );
  }
};

export function keccak256(a: Buffer): string {
  const hash = Buffer.from(keccakHash(a)).toString("hex");
  return `0x${hash}`;
}

export function stripHexPrefix(str: string): string {
  return str.startsWith("0x") ? str.slice(2) : str;
}

export function toChecksumAddress(hexAddress: string): string {
  const address = stripHexPrefix(hexAddress).toLowerCase();

  const buf = Buffer.from(address, "utf8");
  const hash = Buffer.from(keccakHash(buf)).toString("hex");
  let ret = "0x";

  for (let i = 0; i < address.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      ret += address[i].toUpperCase();
    } else {
      ret += address[i];
    }
  }

  return ret;
}
