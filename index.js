require("dotenv").config();

const {
  createPublicClient,
  webSocket,
  http,
  parseAbiItem,
} = require("viem");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Monad Mainnet
const WS_RPC_URL =
  process.env.MONAD_WS_RPC_URL || "wss://rpc.monad.xyz";

const HTTP_RPC_URL =
  process.env.MONAD_RPC_URL || "https://rpc.monad.xyz";

// Nad.fun Mainnet v3 Bonding Curve
const BONDING_CURVE =
  "0xA7283d07812a02AFB7C09B60f8896bCEA3F90aCE";

// Monad Mainnet explorer
const EXPLORER = "https://monadscan.com";

const curveCreateEvent = parseAbiItem(
  "event CurveCreate(address indexed creator,address indexed token,address indexed pool,string name,string symbol,string tokenURI,uint256 virtualMon,uint256 virtualToken,uint256 targetTokenAmount)"
);

async function sendTelegram(message) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      console.error("Telegram error:", data);
    }
  } catch (error) {
    console.error("Telegram request error:", error);
  }
}

async function startBot() {
  console.log("🚀 Starting Nad.fun Alert Bot...");
  console.log("🎯 Nad.fun Mainnet v3");
  console.log("📍 Bonding Curve:", BONDING_CURVE);
  console.log("📡 Connecting to Monad WebSocket...");

  await sendTelegram(
    "🚀 <b>Nad.fun Alert Bot Started!</b>\n\n" +
    "🟢 Monitoring Nad.fun Mainnet token creations..."
  );

  const client = createPublicClient({
    transport: webSocket(WS_RPC_URL),
  });

  console.log("✅ WebSocket connected");
  console.log("👀 Listening for CurveCreate events...");

  const unwatch = client.watchEvent({
    address: BONDING_CURVE,
    event: curveCreateEvent,
    poll: false,

    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          const args = log.args;

          const creator = args.creator;
          const token = args.token;
          const pool = args.pool;
          const name = args.name || "Unknown";
          const symbol = args.symbol || "UNKNOWN";
          const tokenURI = args.tokenURI || "";

          console.log("\n🔥 NEW NAD.FUN TOKEN!");
          console.log("Name:", name);
          console.log("Symbol:", symbol);
          console.log("Token:", token);
          console.log("Creator:", creator);
          console.log("TX:", log.transactionHash);

          const message =
`🚨 <b>NEW NAD.FUN TOKEN</b>

🪙 <b>Name:</b> ${escapeHtml(name)}
💰 <b>Ticker:</b> $${escapeHtml(symbol)}

📍 <b>Contract:</b>
<code>${token}</code>

👤 <b>Creator:</b>
<code>${creator}</code>

🏊 <b>Pool:</b>
<code>${pool}</code>

⛓ <b>Chain:</b> Monad Mainnet

🔗 <b>Nad.fun:</b>
https://nad.fun/tokens/${token}

🔍 <b>Explorer:</b>
${EXPLORER}/address/${token}

🧾 <b>Transaction:</b>
${EXPLORER}/tx/${log.transactionHash}

${tokenURI ? `🖼 <b>Token URI:</b>\n${escapeHtml(tokenURI)}\n` : ""}
⚡ <b>JUST LAUNCHED</b>`;

          await sendTelegram(message);

        } catch (error) {
          console.error("❌ Event processing error:", error);
        }
      }
    },

    onError: (error) => {
      console.error("❌ WebSocket event error:", error);
    },
  });

  console.log("✅ Nad.fun token monitoring is LIVE");

  process.on("SIGINT", () => {
    console.log("Stopping...");
    unwatch();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("Stopping...");
    unwatch();
    process.exit(0);
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

startBot().catch(async (error) => {
  console.error("❌ FATAL ERROR:", error);

  try {
    await sendTelegram(
      "❌ <b>Nad.fun Bot Error</b>\n\n" +
      `<code>${escapeHtml(error.message || String(error))}</code>`
    );
  } catch (e) {}

  process.exit(1);
});
