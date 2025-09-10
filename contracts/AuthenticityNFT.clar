(define-non-fungible-token authenticity-nft uint)

(define-map nft-metadata
  { nft-id: uint }
  {
    item-hash: (buff 32),
    manufacturer: principal,
    minted-at: uint,
    description: (string-utf8 256),
    serial-number: (string-ascii 64),
    image-hash: (optional (buff 32)),
    current-owner: principal,
    transfer-locked: bool
  }
)

(define-map item-hash-to-nft-id
  { item-hash: (buff 32) }
  uint
)

(define-data-var last-nft-id uint u0)
(define-data-var contract-owner principal tx-sender)
(define-data-var mint-fee uint u100)
(define-data-var transfer-fee uint u50)
(define-data-var total-minted uint u0)
(define-data-var max-supply (optional uint) none)

(define-constant ERR-UNAUTHORIZED (err u100))
(define-constant ERR-DUPLICATE-ITEM (err u101))
(define-constant ERR-NFT-NOT-FOUND (err u102))
(define-constant ERR-INVALID-HASH (err u103))
(define-constant ERR-INVALID-DESCRIPTION (err u104))
(define-constant ERR-INVALID-SERIAL (err u105))
(define-constant ERR-TRANSFER-LOCKED (err u106))
(define-constant ERR-INSUFFICIENT-FEE (err u107))
(define-constant ERR-MAX-SUPPLY-REACHED (err u108))
(define-constant ERR-INVALID-AMOUNT (err u109))
(define-constant ERR-OWNER-ONLY (err u110))
(define-constant ERR-ALREADY-LOCKED (err u111))
(define-constant ERR-NOT-LOCKED (err u112))
(define-constant ERR-INVALID-OPTIONAL (err u113))

(define-trait manufacturer-registry-trait
  (
    (is-manufacturer-authorized (principal) (response bool uint))
  )
)

(define-trait item-database-trait
  (
    (get-item-details ((buff 32)) (response { description: (string-utf8 256), serial: (string-ascii 64) } uint))
    (add-item-details ((buff 32) (string-utf8 256) (string-ascii 64)) (response bool uint))
  )
)

(define-data-var manufacturer-registry (optional principal) none)
(define-data-var item-database (optional principal) none)

(define-private (is-owner (nft-id uint) (caller principal))
  (match (map-get? nft-metadata { nft-id: nft-id })
    metadata (is-eq (get current-owner metadata) caller)
    false
  )
)

(define-private (validate-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
    (ok true)
    ERR-INVALID-HASH
  )
)

(define-private (validate-description (desc (string-utf8 256)))
  (if (<= (len desc) u256)
    (ok true)
    ERR-INVALID-DESCRIPTION
  )
)

(define-private (validate-serial (serial (string-ascii 64)))
  (if (<= (len serial) u64)
    (ok true)
    ERR-INVALID-SERIAL
  )
)

(define-private (validate-amount (amount uint))
  (if (> amount u0)
    (ok true)
    ERR-INVALID-AMOUNT
  )
)

(define-read-only (get-nft-metadata (nft-id uint))
  (map-get? nft-metadata { nft-id: nft-id })
)

(define-read-only (get-nft-id-by-hash (item-hash (buff 32)))
  (map-get? item-hash-to-nft-id { item-hash: item-hash })
)

(define-read-only (get-owner (nft-id uint))
  (match (map-get? nft-metadata { nft-id: nft-id })
    metadata (ok (get current-owner metadata))
    ERR-NFT-NOT-FOUND
  )
)

(define-read-only (get-last-nft-id)
  (ok (var-get last-nft-id))
)

(define-read-only (get-total-minted)
  (ok (var-get total-minted))
)

(define-read-only (is-transfer-locked (nft-id uint))
  (match (map-get? nft-metadata { nft-id: nft-id })
    metadata (ok (get transfer-locked metadata))
    ERR-NFT-NOT-FOUND
  )
)

(define-public (set-manufacturer-registry (registry principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-OWNER-ONLY)
    (var-set manufacturer-registry (some registry))
    (ok true)
  )
)

(define-public (set-item-database (database principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-OWNER-ONLY)
    (var-set item-database (some database))
    (ok true)
  )
)

(define-public (set-mint-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-OWNER-ONLY)
    (try! (validate-amount new-fee))
    (var-set mint-fee new-fee)
    (ok true)
  )
)

(define-public (set-transfer-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-OWNER-ONLY)
    (try! (validate-amount new-fee))
    (var-set transfer-fee new-fee)
    (ok true)
  )
)

(define-public (set-max-supply (supply uint))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-OWNER-ONLY)
    (asserts! (is-none (var-get max-supply)) ERR-ALREADY-LOCKED)
    (try! (validate-amount supply))
    (var-set max-supply (some supply))
    (ok true)
  )
)

(define-public (mint (item-hash (buff 32)) (description (string-utf8 256)) (serial (string-ascii 64)) (image-hash (optional (buff 32))))
  (let
    (
      (nft-id (+ (var-get last-nft-id) u1))
      (registry-opt (var-get manufacturer-registry))
      (database-opt (var-get item-database))
      (max-opt (var-get max-supply))
    )
    (asserts! (is-some registry-opt) ERR-UNAUTHORIZED)
    (asserts! (is-some database-opt) ERR-UNAUTHORIZED)
    (let
      (
        (registry (unwrap! registry-opt ERR-UNAUTHORIZED))
        (database (unwrap! database-opt ERR-UNAUTHORIZED))
      )
      (try! (contract-call? registry is-manufacturer-authorized tx-sender))
      (try! (validate-hash item-hash))
      (try! (validate-description description))
      (try! (validate-serial serial))
      (asserts! (is-none (map-get? item-hash-to-nft-id { item-hash: item-hash })) ERR-DUPLICATE-ITEM)
      (match max-opt max-supply (asserts! (< (var-get total-minted) max-supply) ERR-MAX-SUPPLY-REACHED) true)
      (try! (contract-call? database add-item-details item-hash description serial))
      (try! (stx-transfer? (var-get mint-fee) tx-sender (var-get contract-owner)))
      (try! (nft-mint? authenticity-nft nft-id tx-sender))
      (map-set nft-metadata { nft-id: nft-id }
        {
          item-hash: item-hash,
          manufacturer: tx-sender,
          minted-at: block-height,
          description: description,
          serial-number: serial,
          image-hash: image-hash,
          current-owner: tx-sender,
          transfer-locked: false
        }
      )
      (map-set item-hash-to-nft-id { item-hash: item-hash } nft-id)
      (var-set last-nft-id nft-id)
      (var-set total-minted (+ (var-get total-minted) u1))
      (print { event: "nft-minted", nft-id: nft-id, item-hash: item-hash })
      (ok nft-id)
    )
  )
)

(define-public (transfer (nft-id uint) (recipient principal))
  (let
    (
      (metadata-opt (map-get? nft-metadata { nft-id: nft-id }))
    )
    (match metadata-opt metadata
      (begin
        (asserts! (is-owner nft-id tx-sender) ERR-UNAUTHORIZED)
        (asserts! (not (get transfer-locked metadata)) ERR-TRANSFER-LOCKED)
        (try! (stx-transfer? (var-get transfer-fee) tx-sender (var-get contract-owner)))
        (try! (nft-transfer? authenticity-nft nft-id tx-sender recipient))
        (map-set nft-metadata { nft-id: nft-id }
          (merge metadata { current-owner: recipient })
        )
        (print { event: "nft-transferred", nft-id: nft-id, from: tx-sender, to: recipient })
        (ok true)
      )
      ERR-NFT-NOT-FOUND
    )
  )
)

(define-public (lock-transfer (nft-id uint))
  (let
    (
      (metadata-opt (map-get? nft-metadata { nft-id: nft-id }))
    )
    (match metadata-opt metadata
      (begin
        (asserts! (is-owner nft-id tx-sender) ERR-UNAUTHORIZED)
        (asserts! (not (get transfer-locked metadata)) ERR-ALREADY-LOCKED)
        (map-set nft-metadata { nft-id: nft-id }
          (merge metadata { transfer-locked: true })
        )
        (print { event: "transfer-locked", nft-id: nft-id })
        (ok true)
      )
      ERR-NFT-NOT-FOUND
    )
  )
)

(define-public (unlock-transfer (nft-id uint))
  (let
    (
      (metadata-opt (map-get? nft-metadata { nft-id: nft-id }))
    )
    (match metadata-opt metadata
      (begin
        (asserts! (is-owner nft-id tx-sender) ERR-UNAUTHORIZED)
        (asserts! (get transfer-locked metadata) ERR-NOT-LOCKED)
        (map-set nft-metadata { nft-id: nft-id }
          (merge metadata { transfer-locked: false })
        )
        (print { event: "transfer-unlocked", nft-id: nft-id })
        (ok true)
      )
      ERR-NFT-NOT-FOUND
    )
  )
)

(define-public (verify-authenticity (nft-id uint) (provided-hash (buff 32)))
  (match (map-get? nft-metadata { nft-id: nft-id })
    metadata
      (if (is-eq (get item-hash metadata) provided-hash)
        (ok true)
        (ok false)
      )
    ERR-NFT-NOT-FOUND
  )
)

(define-public (update-description (nft-id uint) (new-desc (string-utf8 256)))
  (let
    (
      (metadata-opt (map-get? nft-metadata { nft-id: nft-id }))
    )
    (match metadata-opt metadata
      (begin
        (asserts! (is-eq (get manufacturer metadata) tx-sender) ERR-UNAUTHORIZED)
        (try! (validate-description new-desc))
        (map-set nft-metadata { nft-id: nft-id }
          (merge metadata { description: new-desc })
        )
        (print { event: "description-updated", nft-id: nft-id })
        (ok true)
      )
      ERR-NFT-NOT-FOUND
    )
  )
)

(define-public (burn (nft-id uint))
  (let
    (
      (metadata-opt (map-get? nft-metadata { nft-id: nft-id }))
    )
    (match metadata-opt metadata
      (begin
        (asserts! (is-owner nft-id tx-sender) ERR-UNAUTHORIZED)
        (try! (nft-burn? authenticity-nft nft-id tx-sender))
        (map-delete nft-metadata { nft-id: nft-id })
        (map-delete item-hash-to-nft-id { item-hash: (get item-hash metadata) })
        (var-set total-minted (- (var-get total-minted) u1))
        (print { event: "nft-burned", nft-id: nft-id })
        (ok true)
      )
      ERR-NFT-NOT-FOUND
    )
  )
)