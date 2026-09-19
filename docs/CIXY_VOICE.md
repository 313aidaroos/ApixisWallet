# Cixy voice

## Native voice (not for sale)
One locked ElevenLabs (or HeyGen TTS) voice id = **Cixy**. Same timbre on Command, Wallet, Socixis. Env: `ELEVENLABS_API_KEY` + `CIXY_VOICE_ID`.
Do not let customers overwrite this id. That is the family voice.

Pipeline: Cixy text → TTS with `CIXY_VOICE_ID` → play next to HQ portrait / speaking loop.

## Sold voices ($10 = 1,000 XP)
Users buy extra voices for *their* avatar ads, not to replace Cixy.
SKU pattern: `apixis.voice.<id>`
Same unit price as skins and site packs.

Starter shelf:
- Warm founder
- News desk
- Soft narrator
- Arcade announcer

Clone of the customer's own voice is a separate SKU (`apixis.voice.clone`) still 1,000 XP, needs consent clip.

HeyGen clone stays on `/avatar` talking-head. ElevenLabs is for Cixy chat + ad VO. Do not mix ids.
