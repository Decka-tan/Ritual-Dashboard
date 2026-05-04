create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  description text,
  creator_handle text,
  creator_name text,
  creator_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  preview_url text,
  preview_status text not null default 'pending',
  created_at timestamptz default now(),
  approved_at timestamptz,
  rejected_at timestamptz
);

create index if not exists submissions_status_created_at_idx on submissions (status, created_at desc);

create table if not exists official_apps (
  id uuid primary key default gen_random_uuid(),
  site_number integer not null unique,
  name text not null,
  url text not null,
  description text,
  creator_name text,
  creator_handle text,
  creator_url text,
  preview_url text,
  preview_status text not null default 'ready',
  source text not null default 'admin',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists official_apps_site_number_idx on official_apps (site_number asc);

insert into official_apps (site_number, name, url, description, creator_name, creator_url, preview_url, source) values
  (1, 'Ritual Pump', 'https://ritual-token-launch--rizkyalvonzo8.replit.app/', 'Pump-style launchpad for deploying and sharing ERC-20 tokens on Ritual Testnet.', 'john (❖,❖)', 'https://x.com/johntolll/status/2048276359567601902', '/previews/01-ritual-pump.png', 'seed'),
  (2, 'Ritual Testnet Card', 'https://ritual-onchain-id.vercel.app/', 'Mint an X-handle identity card as an NFT on Ritual Testnet.', 'Maharshi (❖,❖)', 'https://x.com/Devarshi8539/status/2048290472918163793', '/previews/02-ritual-testnet-card.png', 'seed'),
  (3, 'Mint Your X Profile', 'https://web-3-profile-mint--rolex9723060.replit.app/', 'Non-transferable proof-of-presence mint for X profiles on Ritual Chain.', 'Tanjiro (❖,❖)', 'https://x.com/Tanjiro3060/status/2048091611570356244', '/previews/03-mint-your-x-profile.png', 'seed'),
  (4, 'Ritual Address Analyzer', 'https://ritual-stats-check.vercel.app/', 'Wallet analyzer for Ritual Testnet balances, transactions, activity, and consistency stats.', '0xTanoy.eth(❖,❖)', 'https://x.com/InfoTanoy/status/2047901277326020817', '/previews/04-ritual-address-analyzer.png', 'seed'),
  (5, 'Ritual On-chain identity', 'https://ritual-names.vercel.app/', 'On-chain identity/name app for Ritual Testnet users.', 'Dabid', 'https://x.com/0xdabid/status/2048563502860976288', '/previews/05-ritual-on-chain-identity.png', 'seed'),
  (6, 'autonomous trading agent', 'https://haezl-trading.info/#dashboard', 'Autonomous trading-agent dashboard for monitoring trading activity and agent state.', 'Haezl', 'https://x.com/Haezl_Crypto/status/2049176543616811126', '/previews/06-autonomous-trading-agent.png', 'seed'),
  (7, 'GM Stike every 24 Hours', 'https://gritual-striker.vercel.app/', 'Daily GM strike/check-in app built around a 24-hour Ritual cadence.', 'Kenil.eth', 'https://x.com/vekariya_kenil/status/2049142346496045102', '/previews/07-gm-stike-every-24-hours.png', 'seed'),
  (8, 'Nft MarketPlace', 'https://ritual-searcher--tanjir9721.replit.app/', 'NFT marketplace/searcher experience for Ritual community assets.', 'Tanjiro (❖,❖)', 'https://x.com/Tanjiro3060/status/2048818995944710553', '/previews/08-nft-marketplace.png', 'seed'),
  (9, 'RitualDex', 'https://ritual-perp-dex.replit.app/', 'Ritual-themed perpetual DEX/trading interface.', '0xTanoy.eth(❖,❖)', 'https://x.com/InfoTanoy/status/2049030228056613153', '/previews/09-ritualdex.png', 'seed'),
  (10, 'Ritual Casino', 'https://ritualcasino.lovable.app/', 'Ritual-themed casino/game experience.', 'OSARAGI', 'https://x.com/0xOsaragi/status/2049041761746727048', '/previews/10-ritual-casino.png', 'seed'),
  (11, 'Predection Market', 'https://oracle-predict-market--cahyaeth.replit.app/', 'Prediction market using oracle-style outcomes for Ritual users.', 'tutubear (❖,❖)', 'https://x.com/tutubearrr/status/2050556620766400981', '/previews/11-predection-market.png', 'seed'),
  (12, 'Ritual Hub', 'https://ritual-testnet-hub.vercel.app', 'Hub for Ritual Testnet resources, tools, and navigation.', 'Maharshi (❖,❖)', 'https://x.com/Devarshi8539/status/2049080436501176466?s=20', '/previews/12-ritual-hub.png', 'seed'),
  (13, 'Generate your Ritual Bounty Card', 'https://wanted-on-ritual.replit.app/', 'Generate a Ritual bounty/wanted card for community profiles.', '0xTanoy.eth(❖,❖)', 'https://x.com/InfoTanoy/status/2049424462647624062', '/previews/13-generate-your-ritual-bounty-card.png', 'seed'),
  (14, 'Ritual recogniser', 'https://ritual-recognition.lovable.app/', 'Recognition app for Ritual community/profile identification.', 'Maharshi (❖,❖)', 'https://x.com/Devarshi8539/status/2049379975493747033', '/previews/14-ritual-recogniser.png', 'seed'),
  (15, 'Ritual Builder Proof', 'https://ritual-builder-proof.pages.dev/', 'Builder proof page for showing participation/contribution on Ritual.', 'Unknown', '', '/previews/15-ritual-builder-proof.png', 'seed'),
  (16, 'Ritual Tamagotchi', 'https://ritual-tamagotchi.vercel.app/', 'Ritual-themed Tamagotchi/pet game.', 'Lola (❖,❖)', 'https://x.com/LolaSt1400/status/2049473135540412849', '/previews/16-ritual-tamagotchi.png', 'seed'),
  (17, 'Ritual Contract create', 'https://ritual-create-contract.vercel.app/', 'Contract creation/deployment utility for Ritual Testnet.', 'Joyesh(❖,❖)', 'https://x.com/seyoj7/status/2049525403073794434', '/previews/17-ritual-contract-create.png', 'seed'),
  (18, 'Ritual Mission Console', 'https://ritual-console.netlify.app/', 'Mission console for Ritual tasks and testnet actions.', 'HB (❖,❖)', 'https://x.com/herbcase7/status/2049665964124623149', '/previews/18-ritual-mission-console.png', 'seed'),
  (19, 'Jumping Siggy', 'https://jumping-siggy-the-pussy.vercel.app/', 'Siggy-themed jumping arcade game.', 'Randzkieeee', 'https://x.com/randzkie05/status/2049690016608375158', '/previews/19-jumping-siggy.png', 'seed'),
  (20, 'Ritual community map', 'https://ritual-foundation--tanjiro97211.replit.app/', 'Community map for Ritual ecosystem/community navigation.', 'Tanjiro (❖,❖)', 'https://x.com/Tanjiro3060/status/2049777077675782182?s=20', '/previews/20-ritual-community-map.png', 'seed'),
  (21, 'Predection Market', 'https://ramavenom.github.io/rekt-or-rich/', 'Rekt-or-rich prediction market/game hosted on GitHub Pages.', 'RamaXwhale | (❖,❖)', 'https://x.com/RXwhale/status/2049757261996982657?s=20', '/previews/21-predection-market.png', 'seed'),
  (22, 'Ritual memory Vault', 'https://ritual-memory-vault.replit.app/', 'Memory vault for saving or displaying Ritual-related memories/records.', 'Kiko(❖,❖)', 'https://x.com/KikoNads/status/2050029333507715279', '/previews/22-ritual-memory-vault.png', 'seed'),
  (23, 'Ritual Testnet explorer', 'https://ritual-testnet-apps.vercel.app/', 'Explorer/index for Ritual Testnet apps.', 'Dabid', 'https://x.com/0xdabid/status/2049995181316018443', '/previews/23-ritual-testnet-explorer.png', 'seed'),
  (24, 'Ritual Micro Tap', 'https://ritual-micro-tap.vercel.app/', 'Micro tap/clicker-style Ritual game or utility.', '0xrumora ❖', 'https://x.com/Ox6ce4/status/2050473089994219585', '/previews/24-ritual-micro-tap.png', 'seed'),
  (25, 'Wallet Analytics', 'https://ritual-score-checker--0xrumora.replit.app/', 'Wallet score checker and analytics tool for Ritual Testnet activity.', 'john (❖,❖)', 'https://x.com/johntolxbt/status/2050545029756907567', '/previews/25-wallet-analytics.png', 'seed'),
  (26, 'Community Faucet', 'https://ritual-faucet-blueprint--ritualcommunity.replit.app/', 'Community faucet blueprint for getting Ritual Testnet tokens.', 'cripson (❖,❖)', 'https://x.com/Cripson01/status/2050475182331134131', '/previews/26-community-faucet.png', 'seed'),
  (27, 'Siggy Power Card', 'https://siggy-power-cards.vercel.app/', 'Generate or view Siggy-themed power/profile cards.', 'N G (❖,❖)', 'https://x.com/NanangN27/status/2050568852833214879?s=20', '/previews/27-siggy-power-card.png', 'seed'),
  (28, 'Lucky Arcade Ritual', 'https://ritual-casino-quest.lovable.app/', 'Lucky arcade/casino quest game themed around Ritual.', 'tutubear (❖,❖)', 'https://x.com/tutubearrr/status/2050556620766400981', '/previews/28-lucky-arcade-ritual.png', 'seed'),
  (29, 'Ritual Oracle', 'https://ritual-oracle-two.vercel.app/', 'Oracle-themed Ritual app for data, prediction, or decision flows.', 'JT🪩💡(❖,❖)', 'https://x.com/AbrahamJT9/status/2049993481423143328', '/previews/29-ritual-oracle.png', 'seed'),
  (30, 'Ritual Bubble Shooter', 'https://ritual-bubble-shooter-jt.lovable.app/', 'Ritual-themed bubble shooter arcade game.', 'PixelSect', 'https://x.com/PixelSect/status/2050805378116391398', '/previews/30-ritual-bubble-shooter.png', 'seed'),
  (31, 'Siggy Pixelverse', 'https://siggy-pixelverse.lovable.app/', 'Siggy Pixelverse arcade/community game.', 'Asceno 🟦 (❖,❖)', 'https://x.com/Nice_guyyy1/status/2051197857190072667', '/previews/31-siggy-pixelverse.png', 'seed'),
  (32, 'Ritual Arena', 'https://ritualarena1.vercel.app/', 'Ritual Arena battle/game experience.', 'Annae.nad', 'https://x.com/Anna272493', '/previews/32-ritual-arena.png', 'seed'),
  (33, 'diabetes diary TG BOT', 'https://t.me/DiaRoutine_Bot', 'Telegram bot for diabetes diary/routine tracking.', 'Unknown', '', '/previews/33-diabetes-diary-tg-bot.png', 'seed')
on conflict (site_number) do update set
  name = excluded.name,
  url = excluded.url,
  description = coalesce(nullif(official_apps.description, ''), excluded.description),
  creator_name = coalesce(nullif(official_apps.creator_name, ''), excluded.creator_name),
  creator_url = coalesce(nullif(official_apps.creator_url, ''), excluded.creator_url),
  preview_url = coalesce(nullif(official_apps.preview_url, ''), excluded.preview_url),
  updated_at = now();

alter table submissions enable row level security;
alter table official_apps enable row level security;

-- Server-side Vercel API uses the service role key and bypasses RLS.
-- Keep public browser access closed; all reads/writes go through /api/*.
