import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import { Relay, useWebSocketImplementation } from "nostr-tools/relay";
import * as nip19 from "nostr-tools/nip19";
import { hexToBytes } from "@noble/hashes/utils.js";
import WebSocket from "ws";

useWebSocketImplementation(WebSocket);

const {
  BUZZ_RELAY_URL,
  BUZZ_PRIVATE_KEY,
  BUZZ_AUTH_TAG,
  BUZZ_CHANNEL_ID,
  GITHUB_REF_NAME,
  GITHUB_SHA,
  GITHUB_ACTOR,
  GITHUB_SERVER_URL,
  GITHUB_REPOSITORY,
  COMMIT_MESSAGE,
} = process.env;

for (const [k, v] of Object.entries({
  BUZZ_RELAY_URL,
  BUZZ_PRIVATE_KEY,
  BUZZ_AUTH_TAG,
  BUZZ_CHANNEL_ID,
  GITHUB_REF_NAME,
  GITHUB_SHA,
})) {
  if (!v) {
    console.error(`missing required env: ${k}`);
    process.exit(1);
  }
}

const authTag = JSON.parse(BUZZ_AUTH_TAG);
// BUZZ_PRIVATE_KEY may be bech32 (nsec1...) or raw hex
let sk;
if (BUZZ_PRIVATE_KEY.startsWith("nsec1")) {
  const decoded = nip19.decode(BUZZ_PRIVATE_KEY);
  if (decoded.type !== "nsec") {
    console.error(`unexpected bech32 type: ${decoded.type}`);
    process.exit(1);
  }
  sk = decoded.data;
} else {
  sk = hexToBytes(BUZZ_PRIVATE_KEY.padStart(64, "0"));
}
const pk = getPublicKey(sk);

const shortSha = GITHUB_SHA.substring(0, 7);
const commitUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/commit/${GITHUB_SHA}`;
const branchUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/tree/${GITHUB_REF_NAME}`;
const firstLine = (COMMIT_MESSAGE ?? "").split("\n")[0].slice(0, 200);

const content = `🐝 **${GITHUB_REF_NAME}** 새 커밋 [\`${shortSha}\`](${commitUrl}) — ${GITHUB_ACTOR}
${firstLine}

브랜치: ${branchUrl}`;

const unsigned = {
  kind: 9,
  created_at: Math.floor(Date.now() / 1000),
  tags: [["h", BUZZ_CHANNEL_ID], authTag],
  content,
  pubkey: pk,
};

const event = finalizeEvent(unsigned, sk);

if (process.env.DRY_RUN === "1") {
  console.log(JSON.stringify({ event, content }, null, 2));
  process.exit(0);
}

const relay = await Relay.connect(BUZZ_RELAY_URL);
try {
  await relay.publish(event);
  console.log("published", event.id, "to", BUZZ_RELAY_URL);
} finally {
  relay.close();
}
