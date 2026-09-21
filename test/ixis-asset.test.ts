import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { burnIxis, mintIxis } from "../lib/ixis-asset/adapter";
import { getIxisAssetMode, ixisUnitLabel } from "../lib/ixis-asset/mode";
import {
  IXIS_MAX_SUPPLY,
  IXIS_MAX_SUPPLY_USD,
  IXIS_PEG_PER_DOLLAR,
  assertWithinMintCap,
  remainingMintable,
} from "../lib/ixis-asset/supply";

describe("ixis asset mode", () => {
  it("defaults to demo and keeps the closed-loop name", () => {
    assert.equal(getIxisAssetMode(undefined), "demo");
    assert.equal(getIxisAssetMode(null), "demo");
    assert.equal(getIxisAssetMode(""), "demo");
    assert.equal(getIxisAssetMode("coin"), "demo");
    assert.equal(ixisUnitLabel("demo"), "Ixis");
  });

  it("uses Ixis Coin only when the mode is live", () => {
    assert.equal(getIxisAssetMode("live"), "live");
    assert.equal(getIxisAssetMode(" LIVE "), "live");
    assert.equal(ixisUnitLabel("live"), "Ixis Coin");
  });
});

describe("mint cap", () => {
  it("locks the ceiling at 1 trillion Ixis, $10B at the peg", () => {
    assert.equal(IXIS_MAX_SUPPLY, 1_000_000_000_000);
    assert.equal(IXIS_PEG_PER_DOLLAR, 100);
    assert.equal(IXIS_MAX_SUPPLY_USD, 10_000_000_000);
    assert.equal(IXIS_MAX_SUPPLY / IXIS_PEG_PER_DOLLAR, 10_000_000_000);
  });

  it("allows a liability-backed mint inside the cap and rejects one past it", () => {
    assert.doesNotThrow(() => assertWithinMintCap(0, 1000));
    assert.equal(remainingMintable(0), IXIS_MAX_SUPPLY);
    assert.doesNotThrow(() => assertWithinMintCap(IXIS_MAX_SUPPLY - 10, 10));
    assert.equal(remainingMintable(IXIS_MAX_SUPPLY), 0);
    assert.throws(() => assertWithinMintCap(IXIS_MAX_SUPPLY, 1), /IXIS_MAX_SUPPLY/);
    assert.throws(() => assertWithinMintCap(IXIS_MAX_SUPPLY - 10, 11), /IXIS_MAX_SUPPLY/);
    assert.throws(() => assertWithinMintCap(0, IXIS_MAX_SUPPLY + 1), /IXIS_MAX_SUPPLY/);
  });

  it("rejects a non-integer mint and a negative liability", () => {
    assert.throws(() => assertWithinMintCap(0, 0), /positive integer/);
    assert.throws(() => assertWithinMintCap(0, -5), /positive integer/);
    assert.throws(() => assertWithinMintCap(0, 1.5), /positive integer/);
    assert.throws(() => assertWithinMintCap(-1, 1), /non-negative integer/);
    assert.throws(() => remainingMintable(IXIS_MAX_SUPPLY + 1), /exceeds IXIS_MAX_SUPPLY/);
  });
});

describe("chain adapter", () => {
  const previous = {
    mode: process.env.IXIS_ASSET_MODE,
    rpc: process.env.IXIS_CHAIN_RPC_URL,
    key: process.env.IXIS_CHAIN_MINTER_KEY,
  };

  function restore() {
    const put = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    put("IXIS_ASSET_MODE", previous.mode);
    put("IXIS_CHAIN_RPC_URL", previous.rpc);
    put("IXIS_CHAIN_MINTER_KEY", previous.key);
  }

  it("no-ops mint and burn in demo without creating supply", async () => {
    delete process.env.IXIS_ASSET_MODE;
    try {
      assert.equal(getIxisAssetMode(), "demo");
      const movement = { ownerId: "owner", amount: 1000, reason: "test", outstandingLiability: 0 };
      assert.deepEqual(await mintIxis(movement), { applied: false, mode: "demo" });
      assert.deepEqual(await burnIxis(movement), { applied: false, mode: "demo" });
      await assert.rejects(
        () => mintIxis({ ...movement, amount: 1, outstandingLiability: IXIS_MAX_SUPPLY }),
        /IXIS_MAX_SUPPLY/,
      );
    } finally {
      restore();
    }
  });

  it("throws not configured in live even if chain secrets are present", async () => {
    process.env.IXIS_ASSET_MODE = "live";
    process.env.IXIS_CHAIN_RPC_URL = "https://chain.example";
    process.env.IXIS_CHAIN_MINTER_KEY = "not-a-real-signer";
    try {
      await assert.rejects(
        () => mintIxis({ ownerId: "owner", amount: 1, reason: "test", outstandingLiability: 0 }),
        /not configured/,
      );
      await assert.rejects(
        () => mintIxis({ ownerId: "owner", amount: 1, reason: "test", outstandingLiability: IXIS_MAX_SUPPLY }),
        /IXIS_MAX_SUPPLY/,
      );
      await assert.rejects(() => burnIxis({ ownerId: "owner", amount: 1, reason: "test" }), /not configured/);
    } finally {
      restore();
    }
  });
});
