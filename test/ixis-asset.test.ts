import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { burnIxis, mintIxis } from "../lib/ixis-asset/adapter";
import { getIxisAssetMode, ixisUnitLabel } from "../lib/ixis-asset/mode";

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

  it("no-ops mint and burn in demo", async () => {
    process.env.IXIS_ASSET_MODE = "demo";
    try {
      const movement = { ownerId: "owner", amount: 1000, reason: "test" };
      assert.deepEqual(await mintIxis(movement), { applied: false, mode: "demo" });
      assert.deepEqual(await burnIxis(movement), { applied: false, mode: "demo" });
    } finally {
      restore();
    }
  });

  it("throws not configured in live even if chain secrets are present", async () => {
    process.env.IXIS_ASSET_MODE = "live";
    process.env.IXIS_CHAIN_RPC_URL = "https://chain.example";
    process.env.IXIS_CHAIN_MINTER_KEY = "not-a-real-signer";
    try {
      await assert.rejects(() => mintIxis({ ownerId: "owner", amount: 1, reason: "test" }), /not configured/);
      await assert.rejects(() => burnIxis({ ownerId: "owner", amount: 1, reason: "test" }), /not configured/);
    } finally {
      restore();
    }
  });
});
