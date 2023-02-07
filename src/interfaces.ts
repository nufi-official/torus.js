import { Ecies } from "@toruslabs/eccrypto";
import type { INodePub } from "@toruslabs/fetch-node-details";
import { SafeEventEmitter } from "@toruslabs/openlogin-jrpc";
import BN from "bn.js";
export type GetOrSetNonceResult =
  | { typeOfUser: "v1"; nonce?: string }
  | { typeOfUser: "v2"; nonce?: string; pubNonce: { x: string; y: string }; ipfs?: string; upgraded: boolean };

export interface MetadataResponse {
  message: string;
}

export interface MetadataParams {
  namespace?: string;
  pub_key_X: string;
  pub_key_Y: string;
  set_data: {
    data: "getNonce" | "getOrSetNonce" | string;
    timestamp: string;
  };
  signature: string;
}

export type keyAssignStatus = "waiting" | "processing" | "success" | "failed";
export interface KeyAssignStatus {
  processingTime: number;
  status: keyAssignStatus;
  minWaitingTime: number;
}
export interface TorusCtorOptions {
  enableOneKey?: boolean;
  metadataHost?: string;
  allowHost?: string;
  serverTimeOffset?: number;
  signerHost?: string;
  keyAssignQueueHost?: string;
  network?: string;
}

export interface TorusPublicKey extends INodePub {
  typeOfUser: "v1" | "v2";
  address: string;
  metadataNonce: BN;
  pubNonce?: { x: string; y: string };
  upgraded?: boolean;
}

export interface ShareResponse {
  ethAddress: string;
  privKey: string;
  metadataNonce: BN;
}

export interface VerifierLookupResponse {
  keys: { pub_key_X: string; pub_key_Y: string; key_index: string; address: string }[];
}

export interface CommitmentRequestResult {
  signature: string;
  data: string;
  nodepubx: string;
  nodepuby: string;
}

export interface SetCustomKeyOptions {
  privKeyHex?: string;
  metadataNonce?: BN;
  torusKeyHex?: string;
  customKeyHex: BN;
}

export interface JRPCResponse<T> {
  id: number;
  jsonrpc: "2.0";
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface KeyLookupResult {
  keyResult: VerifierLookupResponse;
  errorResult: JRPCResponse<VerifierLookupResponse>["error"];
}

export interface SignerResponse {
  "torus-timestamp": string;
  "torus-nonce": string;
  "torus-signature": string;
}

export interface KeyAssignQueueResponse {
  success: boolean;
  processingTime: number;
  status: keyAssignStatus;
}

export interface KeyAssignInputWithQueue {
  verifier: string;
  verifierId: string;
  keyAssignQueueHost: string;
  network: string;
  instanceId: string;
  isNewKey: boolean;
  keyAssignListener?: SafeEventEmitter;
}

export interface KeyAssignInput {
  endpoints: string[];
  torusNodePubs: INodePub[];
  lastPoint?: number;
  firstPoint?: number;
  verifier: string;
  verifierId: string;
  signerHost: string;
  network: string;
}
export interface KeyAssignment {
  Index: string;
  PublicKey: {
    X: string;
    Y: string;
  };
  Threshold: number;
  Verifiers: Record<string, string>;
  Share: string;
  Metadata: {
    [key in keyof Ecies]: string;
  };
}

export interface ShareRequestResult {
  keys: KeyAssignment[];
}

export interface RetrieveSharesResponse {
  ethAddress: string;
  privKey: string;
  metadataNonce: BN;
}

export interface VerifierParams {
  [key: string]: unknown;
  verifier_id: string;
}
