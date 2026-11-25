# kwibaka-game-reversi

黑白棋 / Reversi for [kwibaka-boardgame-platform](https://github.com/ZangXuanyi/kwibaka-boardgame-platform).

Mounted as `src/games/reversi`. Two players; the host chooses black/white in the
room before starting. The browser module supports per-player move hints,
black/white counts, resignation, and spectator chat (enabled by metadata).

See the host [game & frontend interface](https://github.com/ZangXuanyi/kwibaka-boardgame-platform/blob/main/docs/en/interfaces.md)
and [testing guide](https://github.com/ZangXuanyi/kwibaka-boardgame-platform/blob/main/docs/en/testing.md).

## Layout

```text
types.ts / game.ts / metadata.ts / worker.ts
web/reversi.js
```

## License

AGPL-3.0-only. See `LICENSE`.
