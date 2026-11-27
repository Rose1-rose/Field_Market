/* FIELD MARKET / METAMASK CONNECTOR
   Wallet authorization and network status only. No contracts, transactions,
   token approvals, signatures or blockchain writes are requested here. */
(() => {
  "use strict";

  const byId = id => document.getElementById(id);
  const toggle = byId("walletToggleButton");
  const panel = byId("walletPanel");
  const connectButton = byId("walletConnectButton");
  const disconnectButton = byId("walletDisconnectButton");
  const closeButton = byId("walletCloseButton");
  const bountyButton = byId("chainWalletConnectButton");
  const pillLabel = byId("walletPillText");
  const addressLabel = byId("walletAddress");
  const networkLabel = byId("walletNetwork");
  const feedback = byId("walletFeedback");
  const inlineStatus = byId("chainWalletStatus");
  const walletDock = byId("walletDock");

  if (!toggle || !panel || !connectButton || !disconnectButton) return;

  const chains = {
    "0x1": "Ethereum Mainnet",
    "0xaa36a7": "Sepolia Testnet",
    "0x2105": "Base",
    "0x14a34": "Base Sepolia",
    "0x89": "Polygon",
    "0xa4b1": "Arbitrum One",
    "0xa": "Optimism",
    "0xe708": "Linea",
    "0xe705": "Linea Sepolia",
    "0x7a69": "Local Test Network"
  };
  const state = {
    provider: null,
    listeningTo: null,
    account: "",
    chain: "",
    pending: false
  };

  function sessionFlag(action, value) {
    try {
      if (action === "read") return sessionStorage.getItem("fieldMarketWalletHidden") === "1";
      if (action === "set") sessionStorage.setItem("fieldMarketWalletHidden", value);
    } catch (_) {}
    return false;
  }
  function shorten(address) {
    return address ? address.slice(0, 6) + "…" + address.slice(-4) : "NOT CONNECTED";
  }
  function chainName(id) {
    if (!id) return "—";
    const normalized = String(id).toLowerCase();
    return chains[normalized] || "Chain " + parseInt(normalized, 16);
  }
  function notice(message) {
    feedback.textContent = message;
  }
  function setExpanded(open) {
    panel.classList.toggle("hidden", !open);
    toggle.setAttribute("aria-expanded", String(open));
  }
  function render() {
    const connected = Boolean(state.account);
    walletDock.classList.toggle("is-connected", connected);
    pillLabel.textContent = connected ? shorten(state.account) : "CONNECT METAMASK";
    addressLabel.textContent = connected ? state.account : "NOT CONNECTED";
    networkLabel.textContent = connected ? chainName(state.chain) : "—";
    connectButton.classList.toggle("hidden", connected);
    disconnectButton.classList.toggle("hidden", !connected);
    connectButton.disabled = state.pending;
    toggle.disabled = state.pending;
    if (state.pending) pillLabel.textContent = "OPEN METAMASK…";
    if (inlineStatus) inlineStatus.textContent = connected
      ? shorten(state.account) + " / " + chainName(state.chain)
      : "NOT CONNECTED";
    if (bountyButton) {
      bountyButton.textContent = connected ? "VIEW WALLET ↗" : "CONNECT METAMASK ↗";
    }
  }
  function selectProvider() {
    if (state.provider && typeof state.provider.request === "function") return state.provider;
    const injected = window.ethereum;
    if (Array.isArray(injected?.providers)) {
      state.provider = injected.providers.find(p => p?.isMetaMask && typeof p.request === "function") || null;
    } else if (injected?.isMetaMask && typeof injected.request === "function") {
      state.provider = injected;
    }
    return state.provider;
  }
  async function refreshChain(provider) {
    try {
      const chainId = await provider.request({ method: "eth_chainId" });
      if (state.provider === provider) {
        state.chain = chainId;
        render();
      }
    } catch (_) {
      state.chain = "";
      render();
    }
  }
  function bindEvents(provider) {
    if (state.listeningTo === provider || typeof provider.on !== "function") return;
    state.listeningTo = provider;
    provider.on("accountsChanged", accounts => {
      if (sessionFlag("read")) return;
      state.account = Array.isArray(accounts) ? (accounts[0] || "") : "";
      if (!state.account) {
        state.chain = "";
        notice("Wallet access ended. No transactions were made.");
      }
      render();
    });
    provider.on("chainChanged", chain => {
      state.chain = chain;
      render();
    });
    provider.on("disconnect", () => {
      state.account = "";
      state.chain = "";
      notice("MetaMask disconnected. No transactions were made.");
      render();
    });
  }
  async function restoreAuthorizedAccount() {
    if (sessionFlag("read")) return;
    const provider = selectProvider();
    if (!provider) return;
    bindEvents(provider);
    try {
      const accounts = await provider.request({ method: "eth_accounts" });
      if (sessionFlag("read")) return;
      state.account = Array.isArray(accounts) ? (accounts[0] || "") : "";
      if (state.account) {
        await refreshChain(provider);
        notice("Wallet connected for address and network display only. No funds are moved.");
      }
      render();
    } catch (_) {}
  }
  async function connectWallet() {
    if (state.pending) return;
    setExpanded(true);
    const provider = selectProvider();
    if (!provider) {
      notice("MetaMask not detected. Install the extension, or open this site in MetaMask's in-app browser: metamask.io/download");
      connectButton.textContent = "GET METAMASK ↗";
      connectButton.dataset.install = "true";
      render();
      return;
    }
    connectButton.dataset.install = "";
    connectButton.textContent = "CONNECT METAMASK";
    state.pending = true;
    notice("Approve the account connection in MetaMask. No payment or signature is requested.");
    render();
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      if (!Array.isArray(accounts) || !accounts[0]) throw new Error("No account was authorized.");
      sessionFlag("set", "0");
      state.account = accounts[0];
      bindEvents(provider);
      await refreshChain(provider);
      notice("Connected. This is a wallet-only demo; Bounty rewards are still simulated.");
    } catch (error) {
      const code = Number(error?.code);
      notice(code === 4001 ? "Connection canceled in MetaMask."
        : code === -32002 ? "A MetaMask connection request is already open."
        : "Unable to connect: " + (error?.message || "Please try again."));
    } finally {
      state.pending = false;
      render();
    }
  }

  toggle.addEventListener("click", () => {
    if (!state.account) connectWallet();
    else setExpanded(panel.classList.contains("hidden"));
  });
  connectButton.addEventListener("click", () => {
    if (connectButton.dataset.install === "true" && !selectProvider()) {
      window.open("https://metamask.io/download/", "_blank", "noopener,noreferrer");
    } else {
      connectWallet();
    }
  });
  disconnectButton.addEventListener("click", () => {
    sessionFlag("set", "1");
    state.account = "";
    state.chain = "";
    notice("Disconnected from this page's UI. To revoke site permission, use MetaMask > Connected sites.");
    render();
  });
  if (bountyButton) bountyButton.addEventListener("click", () => {
    if (state.account) setExpanded(panel.classList.contains("hidden"));
    else connectWallet();
  });
  if (closeButton) closeButton.addEventListener("click", () => setExpanded(false));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.classList.contains("hidden")) setExpanded(false);
  });

  /* EIP-6963 identifies MetaMask even when other wallet extensions are installed. */
  window.addEventListener("eip6963:announceProvider", event => {
    const detail = event.detail;
    const rdns = String(detail?.info?.rdns || "").toLowerCase();
    if (rdns === "io.metamask" && detail?.provider?.request) {
      state.provider = detail.provider;
      connectButton.dataset.install = "";
      connectButton.textContent = "CONNECT METAMASK";
      restoreAuthorizedAccount();
    }
  });
  window.addEventListener("ethereum#initialized", () => {
    if (!state.provider) restoreAuthorizedAccount();
  }, { once: true });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  restoreAuthorizedAccount();
  render();
})();
