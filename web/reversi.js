/**
 * Reversi / Othello browser module.
 *
 * Hints and the local hint toggle are per-browser only; the server still sends
 * legal actions to each player independently.
 */

let hintsEnabled = true;

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function colorName(color) {
  return color === 'black' ? '黑棋' : '白棋';
}

function playerName(view, userId) {
  return view.players.find((player) => player.userId === userId)?.name || userId;
}

export function render(container, { view, actions, myUserId, onAction }) {
  container.replaceChildren();
  const root = el('div', 'reversi-shell');
  if (!view || view.schema !== 'reversi-v1') {
    root.appendChild(el('p', 'muted', '等待黑白棋视图…'));
    container.appendChild(root);
    return;
  }

  const spectator = !view.you;
  const myColor = view.you?.color || null;
  const myTurn = view.status === 'playing' && view.turn === myColor;
  const places = new Map(
    (actions || [])
      .filter((action) => action?.type === 'place' && Number.isInteger(action.index))
      .map((action) => [action.index, action]),
  );
  const resign = (actions || []).find((action) => action?.type === 'resign');

  const header = el('div', 'reversi-header');
  const score = el('div', 'reversi-score');
  score.appendChild(el('span', 'reversi-count black', `● 黑 ${view.counts.black}`));
  score.appendChild(el('span', 'reversi-count white', `○ 白 ${view.counts.white}`));
  header.appendChild(score);
  if (myColor) {
    header.appendChild(el('span', 'reversi-you', `你执${colorName(myColor)}`));
  } else {
    header.appendChild(el('span', 'reversi-you', '观战中'));
  }
  const turn = el(
    'span',
    'reversi-turn',
    view.status === 'playing'
      ? `${colorName(view.turn)}回合${myTurn ? ' · 轮到你' : ''}`
      : view.status === 'finished'
        ? '对局结束'
        : '等待双方准备',
  );
  header.appendChild(turn);
  root.appendChild(header);

  const tools = el('div', 'reversi-tools');
  if (!spectator && view.status === 'playing') {
    const toggle = el('button', `reversi-button${hintsEnabled ? ' active' : ''}`, `提示：${hintsEnabled ? '开' : '关'}`);
    toggle.type = 'button';
    toggle.title = '只影响你自己的显示，不影响对手';
    toggle.addEventListener('click', () => {
      hintsEnabled = !hintsEnabled;
      render(container, { view, actions, myUserId, onAction });
    });
    tools.appendChild(toggle);
    if (resign) {
      const resignButton = el('button', 'reversi-button danger', '认输');
      resignButton.type = 'button';
      resignButton.addEventListener('click', () => {
        if (window.confirm('确定认输吗？')) onAction({ type: 'resign' });
      });
      tools.appendChild(resignButton);
    }
  }
  root.appendChild(tools);

  const board = el('div', 'reversi-board');
  board.setAttribute('role', 'grid');
  for (let index = 0; index < 64; index += 1) {
    const cell = el('button', 'reversi-cell');
    cell.type = 'button';
    cell.setAttribute('role', 'gridcell');
    const value = view.board?.[index] ?? null;
    if (value) {
      const disc = el('span', `reversi-disc ${value}`);
      cell.appendChild(disc);
    }
    if (!value && myTurn && hintsEnabled && places.has(index)) {
      cell.appendChild(el('span', 'reversi-hint'));
      cell.classList.add('hint');
    }
    const placeAction = places.get(index);
    cell.disabled = !placeAction || !myTurn;
    if (placeAction) {
      cell.title = placeAction.label || '落子';
      cell.addEventListener('click', () => onAction(placeAction));
    }
    board.appendChild(cell);
  }
  root.appendChild(board);

  const legend = el('div', 'reversi-legend');
  for (const player of view.players) {
    legend.appendChild(
      el(
        'span',
        `reversi-player ${player.color}`,
        `${player.name} · ${colorName(player.color)} · ${player.count}`,
      ),
    );
  }
  root.appendChild(legend);

  if (view.result) {
    const result = el('div', 'reversi-result');
    const reason = {
      resign: '认输',
      board_full: '棋盘已填满',
      one_color_eliminated: '一方棋子被吃光',
      no_moves: '双方均无合法落子',
    }[view.result.reason] || view.result.reason;
    const winnerText = view.result.winners.length
      ? `${view.result.winners.map((id) => playerName(view, id)).join('、')} 获胜`
      : '平局';
    result.appendChild(el('strong', '', winnerText));
    result.appendChild(el('span', 'muted', `${reason} · 黑 ${view.counts.black} / 白 ${view.counts.white}`));
    root.appendChild(result);
  }

  container.appendChild(root);
}
