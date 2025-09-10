# 🔒 LuxAuth: Blockchain-Based NFT Authenticity Certificates for Luxury Goods

Welcome to LuxAuth, a revolutionary Web3 solution tackling the massive problem of counterfeiting in the luxury goods market! Counterfeit watches, bags, and other high-end items cost brands billions annually and erode consumer trust. LuxAuth uses NFTs on the Stacks blockchain to create immutable, verifiable digital certificates of authenticity. Manufacturers mint NFTs tied to physical items, enabling owners to prove genuineness, track provenance, and facilitate secure transfers—all powered by Clarity smart contracts.

## ✨ Features

🔑 Mint NFTs as digital authenticity certificates for luxury items  
📜 Immutable provenance tracking for ownership history  
✅ Instant verification of item authenticity via blockchain queries  
🔄 Secure ownership transfers with escrow to prevent fraud  
🏭 Manufacturer registration and authorization system  
💰 Royalty payments on secondary sales for brands  
🛡️ Anti-duplication mechanisms to ensure unique certificates  
📊 Queryable database for item details and history  

## 🛠 How It Works

LuxAuth leverages 8 Clarity smart contracts to create a robust ecosystem. Here's a high-level overview of the contracts and their roles:

1. **ManufacturerRegistry.clar**: Registers and verifies authorized luxury brands/manufacturers. Only approved principals can mint certificates.  
2. **ItemDatabase.clar**: Stores metadata for luxury goods (e.g., serial numbers, descriptions, images hashes) without duplicating entries.  
3. **AuthenticityNFT.clar**: Core NFT minting contract using STX NFTs standard; ties physical items to unique tokens with hashes of certificates.  
4. **OwnershipTracker.clar**: Records and queries full ownership history, ensuring transparent provenance.  
5. **TransferEscrow.clar**: Handles secure NFT transfers with escrow; releases only after buyer verifies the physical item.  
6. **RoyaltyDistributor.clar**: Automatically distributes royalties to original manufacturers on resales (e.g., 5% fee).  
7. **VerificationOracle.clar**: Integrates on-chain verification logic; can query external oracles for additional proofs if needed (e.g., via Stacks APIs).  
8. **Governance.clar**: Allows decentralized updates to parameters like royalty rates, controlled by multi-sig or token holders.

**For Manufacturers/Brands**  
- Register your brand via ManufacturerRegistry.  
- Add item details to ItemDatabase (e.g., hash of the physical certificate or serial).  
- Mint an NFT certificate using AuthenticityNFT, linking it to the item hash.  
- Boom! The NFT serves as a tamper-proof digital twin for the luxury good.

**For Owners/Buyers**  
- Verify authenticity by calling functions in VerificationOracle or querying OwnershipTracker.  
- Transfer ownership securely: Initiate escrow in TransferEscrow, confirm physical receipt, and release the NFT.  
- On resale, royalties auto-distribute via RoyaltyDistributor—ensuring brands benefit from secondary markets.

**For Verifiers (e.g., Resellers or Authenticators)**  
- Use get-item-details in ItemDatabase to fetch metadata.  
- Call verify-ownership in OwnershipTracker to confirm the chain of custody.  
- Query is-authentic in VerificationOracle for instant blockchain-based proof.

That's it! LuxAuth turns luxury goods into verifiable assets, reducing counterfeits and boosting market confidence on the Stacks blockchain.