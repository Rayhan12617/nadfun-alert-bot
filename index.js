require("dotenv").config();

const {
  CurveStream,
  CurveEventType
} = require("@nadfun/sdk");

const {
  createPublicClient,
  http,
  parseAbi
} = require("viem");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const RPC_URL =
  process.env.MONAD_RPC_URL || "https://rpc.monad.xyz";

const MONAD_EXPLORER = "https://monadscan.com";

const client = createPublicClient({
  transport: http(RPC_URL)
});

const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)"
]);

async function sendTelegram(message) {
  const url =
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: false
      })
    });

    const data = await response.json();

    if (!data.ok) {
      console.error("Telegram error:", data);
    }
  } catch (error) {
    console.error("Telegram request error:", error);
  }
}

async function getTokenInfo(token) {
  let name = "Unknown";
  let symbol = "UNKNOWN";

  try {
    name = await client.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "name"
    });
  } catch (e) {}

  try {
    symbol = await client.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "symbol"
    });
  } catch (e) {}

  return { name, symbol };
}

async function startBot() {
  console.log("🚀 Starting Nad.fun Alert Bot...");

  await sendTelegram(
    "🚀 Nad.fun Alert Bot Started!\n\n" +
    "🟢 Monitoring new token launches..."
  );

  const stream = new CurveStream(RPC_URL);

  stream
    .subscribeEvents([CurveEventType.Create])
    .onEvent(async (event) => {

      console.log("🔥 NEW TOKEN EVENT");
      console.log(event);

      try {
        const token =
          event.token ||
          event.tokenAddress;

        if (!token) {
          console.log("Token address not found");
          return;
        }

        const info = await getTokenInfo(token);

        const tx =
          event.transactionHash ||
          event.txHash ||
          "";

        const message =
`🚨 <b>NEW NAD.FUN TOKEN</b>

🪙 <b>Name:</b> ${info.name}
💰 <b>Ticker:</b> $${info.symbol}

📍 <b>Contract:</b>
<code>${token}</code>

⛓ <b>Chain:</b> Monad

🔗 <b>Nad.fun:</b>
https://nad.fun/tokens/${token}

🔍 <b>Explorer:</b>
${MONAD_EXPLORER}/address/${token}

${tx ? `🧾 <b>TX:</b>\n${MONAD_EXPLORER}/tx/${tx}` : ""}

⚡ <b>JUST LAUNCHED</b>`;

        await sendTelegram(message);

      } catch (error) {
        console.error("Event processing error:", error);
      }
    });

  await stream.start();

  console.log("✅ Listening for Nad.fun token creations...");
}

startBot().catch(async (error) => {
  console.error("Fatal error:", error);

  await sendTelegram(
    "❌ <b>Nad.fun Bot Error</b>\n\n" +
    String(error)
  );

  process.exit(1);
});
