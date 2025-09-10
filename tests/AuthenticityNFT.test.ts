import { describe, it, expect, beforeEach } from "vitest";

const ERR_UNAUTHORIZED = 100;
const ERR_DUPLICATE_ITEM = 101;
const ERR_NFT_NOT_FOUND = 102;
const ERR_INVALID_HASH = 103;
const ERR_INVALID_DESCRIPTION = 104;
const ERR_INVALID_SERIAL = 105;
const ERR_TRANSFER_LOCKED = 106;
const ERR_INSUFFICIENT_FEE = 107;
const ERR_MAX_SUPPLY_REACHED = 108;
const ERR_INVALID_AMOUNT = 109;
const ERR_OWNER_ONLY = 110;
const ERR_ALREADY_LOCKED = 111;
const ERR_NOT_LOCKED = 112;
const ERR_INVALID_OPTIONAL = 113;

interface NFTMetadata {
  itemHash: Buffer;
  manufacturer: string;
  mintedAt: number;
  description: string;
  serialNumber: string;
  imageHash: Buffer | null;
  currentOwner: string;
  transferLocked: boolean;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class AuthenticityNFTMock {
  state: {
    lastNftId: number;
    contractOwner: string;
    mintFee: number;
    transferFee: number;
    totalMinted: number;
    maxSupply: number | null;
    nftMetadata: Map<number, NFTMetadata>;
    itemHashToNftId: Map<string, number>;
    manufacturerRegistry: string | null;
    itemDatabase: string | null;
  } = {
    lastNftId: 0,
    contractOwner: "ST1TEST",
    mintFee: 100,
    transferFee: 50,
    totalMinted: 0,
    maxSupply: null,
    nftMetadata: new Map(),
    itemHashToNftId: new Map(),
    manufacturerRegistry: null,
    itemDatabase: null,
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string }> = [];
  manufacturerAuthorized: Set<string> = new Set(["ST1TEST"]);
  itemDetails: Map<string, { description: string; serial: string }> = new Map();

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      lastNftId: 0,
      contractOwner: "ST1TEST",
      mintFee: 100,
      transferFee: 50,
      totalMinted: 0,
      maxSupply: null,
      nftMetadata: new Map(),
      itemHashToNftId: new Map(),
      manufacturerRegistry: null,
      itemDatabase: null,
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
    this.manufacturerAuthorized = new Set(["ST1TEST"]);
    this.itemDetails = new Map();
  }

  setManufacturerRegistry(registry: string): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_OWNER_ONLY };
    this.state.manufacturerRegistry = registry;
    return { ok: true, value: true };
  }

  setItemDatabase(database: string): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_OWNER_ONLY };
    this.state.itemDatabase = database;
    return { ok: true, value: true };
  }

  setMintFee(newFee: number): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_OWNER_ONLY };
    if (newFee <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    this.state.mintFee = newFee;
    return { ok: true, value: true };
  }

  setTransferFee(newFee: number): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_OWNER_ONLY };
    if (newFee <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    this.state.transferFee = newFee;
    return { ok: true, value: true };
  }

  setMaxSupply(supply: number): Result<boolean> {
    if (this.caller !== this.state.contractOwner) return { ok: false, value: ERR_OWNER_ONLY };
    if (this.state.maxSupply !== null) return { ok: false, value: ERR_ALREADY_LOCKED };
    if (supply <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    this.state.maxSupply = supply;
    return { ok: true, value: true };
  }

  mint(itemHash: Buffer, description: string, serial: string, imageHash: Buffer | null): Result<number> {
    if (this.state.manufacturerRegistry === null || this.state.itemDatabase === null) return { ok: false, value: ERR_UNAUTHORIZED };
    if (!this.manufacturerAuthorized.has(this.caller)) return { ok: false, value: ERR_UNAUTHORIZED };
    if (itemHash.length !== 32) return { ok: false, value: ERR_INVALID_HASH };
    if (description.length > 256) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (serial.length > 64) return { ok: false, value: ERR_INVALID_SERIAL };
    const hashKey = itemHash.toString('hex');
    if (this.state.itemHashToNftId.has(hashKey)) return { ok: false, value: ERR_DUPLICATE_ITEM };
    if (this.state.maxSupply !== null && this.state.totalMinted >= this.state.maxSupply) return { ok: false, value: ERR_MAX_SUPPLY_REACHED };
    this.itemDetails.set(hashKey, { description, serial });
    this.stxTransfers.push({ amount: this.state.mintFee, from: this.caller, to: this.state.contractOwner });
    const nftId = this.state.lastNftId + 1;
    this.state.nftMetadata.set(nftId, {
      itemHash,
      manufacturer: this.caller,
      mintedAt: this.blockHeight,
      description,
      serialNumber: serial,
      imageHash,
      currentOwner: this.caller,
      transferLocked: false,
    });
    this.state.itemHashToNftId.set(hashKey, nftId);
    this.state.lastNftId = nftId;
    this.state.totalMinted++;
    return { ok: true, value: nftId };
  }

  transfer(nftId: number, recipient: string): Result<boolean> {
    const metadata = this.state.nftMetadata.get(nftId);
    if (!metadata) return { ok: false, value: ERR_NFT_NOT_FOUND };
    if (metadata.currentOwner !== this.caller) return { ok: false, value: ERR_UNAUTHORIZED };
    if (metadata.transferLocked) return { ok: false, value: ERR_TRANSFER_LOCKED };
    this.stxTransfers.push({ amount: this.state.transferFee, from: this.caller, to: this.state.contractOwner });
    metadata.currentOwner = recipient;
    this.state.nftMetadata.set(nftId, metadata);
    return { ok: true, value: true };
  }

  lockTransfer(nftId: number): Result<boolean> {
    const metadata = this.state.nftMetadata.get(nftId);
    if (!metadata) return { ok: false, value: ERR_NFT_NOT_FOUND };
    if (metadata.currentOwner !== this.caller) return { ok: false, value: ERR_UNAUTHORIZED };
    if (metadata.transferLocked) return { ok: false, value: ERR_ALREADY_LOCKED };
    metadata.transferLocked = true;
    this.state.nftMetadata.set(nftId, metadata);
    return { ok: true, value: true };
  }

  unlockTransfer(nftId: number): Result<boolean> {
    const metadata = this.state.nftMetadata.get(nftId);
    if (!metadata) return { ok: false, value: ERR_NFT_NOT_FOUND };
    if (metadata.currentOwner !== this.caller) return { ok: false, value: ERR_UNAUTHORIZED };
    if (!metadata.transferLocked) return { ok: false, value: ERR_NOT_LOCKED };
    metadata.transferLocked = false;
    this.state.nftMetadata.set(nftId, metadata);
    return { ok: true, value: true };
  }

  verifyAuthenticity(nftId: number, providedHash: Buffer): Result<boolean> {
    const metadata = this.state.nftMetadata.get(nftId);
    if (!metadata) return { ok: false, value: ERR_NFT_NOT_FOUND };
    return { ok: true, value: metadata.itemHash.equals(providedHash) };
  }

  updateDescription(nftId: number, newDesc: string): Result<boolean> {
    const metadata = this.state.nftMetadata.get(nftId);
    if (!metadata) return { ok: false, value: ERR_NFT_NOT_FOUND };
    if (metadata.manufacturer !== this.caller) return { ok: false, value: ERR_UNAUTHORIZED };
    if (newDesc.length > 256) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    metadata.description = newDesc;
    this.state.nftMetadata.set(nftId, metadata);
    return { ok: true, value: true };
  }

  burn(nftId: number): Result<boolean> {
    const metadata = this.state.nftMetadata.get(nftId);
    if (!metadata) return { ok: false, value: ERR_NFT_NOT_FOUND };
    if (metadata.currentOwner !== this.caller) return { ok: false, value: ERR_UNAUTHORIZED };
    this.state.nftMetadata.delete(nftId);
    const hashKey = metadata.itemHash.toString('hex');
    this.state.itemHashToNftId.delete(hashKey);
    this.state.totalMinted--;
    return { ok: true, value: true };
  }

  getNftMetadata(nftId: number): NFTMetadata | null {
    return this.state.nftMetadata.get(nftId) || null;
  }

  getNftIdByHash(itemHash: Buffer): number | null {
    return this.state.itemHashToNftId.get(itemHash.toString('hex')) || null;
  }

  getOwner(nftId: number): Result<string> {
    const metadata = this.state.nftMetadata.get(nftId);
    if (!metadata) return { ok: false, value: ERR_NFT_NOT_FOUND };
    return { ok: true, value: metadata.currentOwner };
  }

  getLastNftId(): Result<number> {
    return { ok: true, value: this.state.lastNftId };
  }

  getTotalMinted(): Result<number> {
    return { ok: true, value: this.state.totalMinted };
  }

  isTransferLocked(nftId: number): Result<boolean> {
    const metadata = this.state.nftMetadata.get(nftId);
    if (!metadata) return { ok: false, value: ERR_NFT_NOT_FOUND };
    return { ok: true, value: metadata.transferLocked };
  }
}

describe("AuthenticityNFT", () => {
  let contract: AuthenticityNFTMock;

  beforeEach(() => {
    contract = new AuthenticityNFTMock();
    contract.reset();
  });

  it("sets manufacturer registry successfully", () => {
    const result = contract.setManufacturerRegistry("ST2REG");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.manufacturerRegistry).toBe("ST2REG");
  });

  it("rejects set manufacturer registry by non-owner", () => {
    contract.caller = "ST3FAKE";
    const result = contract.setManufacturerRegistry("ST2REG");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_OWNER_ONLY);
  });

  it("sets item database successfully", () => {
    const result = contract.setItemDatabase("ST3DB");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.itemDatabase).toBe("ST3DB");
  });

  it("sets mint fee successfully", () => {
    const result = contract.setMintFee(200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.mintFee).toBe(200);
  });

  it("rejects invalid mint fee", () => {
    const result = contract.setMintFee(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_AMOUNT);
  });

  it("sets transfer fee successfully", () => {
    const result = contract.setTransferFee(100);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.transferFee).toBe(100);
  });

  it("sets max supply successfully", () => {
    const result = contract.setMaxSupply(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.maxSupply).toBe(1000);
  });

  it("rejects set max supply if already set", () => {
    contract.setMaxSupply(1000);
    const result = contract.setMaxSupply(2000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ALREADY_LOCKED);
  });

  it("mints NFT successfully", () => {
    contract.setManufacturerRegistry("ST2REG");
    contract.setItemDatabase("ST3DB");
    const itemHash = Buffer.alloc(32, 1);
    const result = contract.mint(itemHash, "Luxury Watch", "SN123", null);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1);
    const metadata = contract.getNftMetadata(1);
    expect(metadata?.description).toBe("Luxury Watch");
    expect(metadata?.serialNumber).toBe("SN123");
    expect(metadata?.currentOwner).toBe("ST1TEST");
    expect(contract.stxTransfers).toEqual([{ amount: 100, from: "ST1TEST", to: "ST1TEST" }]);
  });

  it("rejects mint without registry", () => {
    const itemHash = Buffer.alloc(32, 1);
    const result = contract.mint(itemHash, "Luxury Watch", "SN123", null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_UNAUTHORIZED);
  });

  it("rejects duplicate mint", () => {
    contract.setManufacturerRegistry("ST2REG");
    contract.setItemDatabase("ST3DB");
    const itemHash = Buffer.alloc(32, 1);
    contract.mint(itemHash, "Luxury Watch", "SN123", null);
    const result = contract.mint(itemHash, "Duplicate", "SN456", null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_DUPLICATE_ITEM);
  });

  it("rejects mint with invalid hash", () => {
    contract.setManufacturerRegistry("ST2REG");
    contract.setItemDatabase("ST3DB");
    const itemHash = Buffer.alloc(31, 1);
    const result = contract.mint(itemHash, "Luxury Watch", "SN123", null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_HASH);
  });

  it("transfers NFT successfully", () => {
    contract.setManufacturerRegistry("ST2REG");
    contract.setItemDatabase("ST3DB");
    const itemHash = Buffer.alloc(32, 1);
    contract.mint(itemHash, "Luxury Watch", "SN123", null);
    const result = contract.transfer(1, "ST4RECIP");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const owner = contract.getOwner(1);
    expect(owner.value).toBe("ST4RECIP");
    expect(contract.stxTransfers.length).toBe(2);
  });

  it("rejects transfer if locked", () => {
    contract.setManufacturerRegistry("ST2REG");
    contract.setItemDatabase("ST3DB");
    const itemHash = Buffer.alloc(32, 1);
    contract.mint(itemHash, "Luxury Watch", "SN123", null);
    contract.lockTransfer(1);
    const result = contract.transfer(1, "ST4RECIP");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_TRANSFER_LOCKED);
  });

  it("locks transfer successfully", () => {
    contract.setManufacturerRegistry("ST2REG");
    contract.setItemDatabase("ST3DB");
    const itemHash = Buffer.alloc(32, 1);
    contract.mint(itemHash, "Luxury Watch", "SN123", null);
    const result = contract.lockTransfer(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const locked = contract.isTransferLocked(1);
    expect(locked.value).toBe(true);
  });

  it("unlocks transfer successfully", () => {
    contract.setManufacturerRegistry("ST2REG");
    contract.setItemDatabase("ST3DB");
    const itemHash = Buffer.alloc(32, 1);
    contract.mint(itemHash, "Luxury Watch", "SN123", null);
    contract.lockTransfer(1);
    const result = contract.unlockTransfer(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const locked = contract.isTransferLocked(1);
    expect(locked.value).toBe(false);
  });

  it("verifies authenticity successfully", () => {
    contract.setManufacturerRegistry("ST2REG");
    contract.setItemDatabase("ST3DB");
    const itemHash = Buffer.alloc(32, 1);
    contract.mint(itemHash, "Luxury Watch", "SN123", null);
    const result = contract.verifyAuthenticity(1, itemHash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
  });

  it("updates description successfully", () => {
    contract.setManufacturerRegistry("ST2REG");
    contract.setItemDatabase("ST3DB");
    const itemHash = Buffer.alloc(32, 1);
    contract.mint(itemHash, "Old Desc", "SN123", null);
    const result = contract.updateDescription(1, "New Desc");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const metadata = contract.getNftMetadata(1);
    expect(metadata?.description).toBe("New Desc");
  });

  it("burns NFT successfully", () => {
    contract.setManufacturerRegistry("ST2REG");
    contract.setItemDatabase("ST3DB");
    const itemHash = Buffer.alloc(32, 1);
    contract.mint(itemHash, "Luxury Watch", "SN123", null);
    const result = contract.burn(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.nftMetadata.has(1)).toBe(false);
    expect(contract.getTotalMinted().value).toBe(0);
  });

  it("gets last NFT ID", () => {
    const result = contract.getLastNftId();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
  });

  it("gets total minted", () => {
    const result = contract.getTotalMinted();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
  });
});