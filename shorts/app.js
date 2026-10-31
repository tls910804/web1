// 문장 쇼츠 — 한 문장씩 넘기며 배우는 외국어
var STORE_KEY = 'sentence-shorts-v1';
var DAY = 24 * 60 * 60 * 1000;
var NO_SPACE = {ja:true, zh:true};

var state = Object.assign({
  onboarded: false,
  native: 'ko',
  learn: ['en'],
  saved: [],      // {id, kind:'s'|'w', card, learned, due, at}
  custom: [],     // 직접 추가한 문장 카드
  hideTr: false,
  tapped: false,  // 단어를 한 번이라도 눌러 봤는지
  account: null,
  loginAsked: false,
  streak: 0,
  lastReview: null
}, load());

var ui = {screen: null, cat: '전체', index: 0, lastTap: 0, savedTab: 's', savedFilter: 'learning', rv: null, add: null};

function load(){
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch(e){ return {}; }
}
function persist(){
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch(e){}
}

// ---------- 도우미 ----------
function $(id){ return document.getElementById(id); }
function esc(s){
  return String(s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function lang(code){
  for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return LANGS[i];
  return LANGS[0];
}
function trOf(obj){
  if (!obj) return '';
  return obj[state.native] || obj.ko || obj.en || Object.keys(obj).map(function(k){ return obj[k]; })[0] || '';
}
function sentence(card){ return card.words.join(NO_SPACE[card.lang] ? '' : ' '); }
function startOfDay(t){ var d = new Date(t); d.setHours(0,0,0,0); return d.getTime(); }
function dayKey(t){ var d = new Date(t); return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate(); }
function icon(path, extra){ return '<svg class="i" viewBox="0 0 24 24"' + (extra || '') + '>' + path + '</svg>'; }
var ICON = {
  speak: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  mark: '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>'
};

function toast(msg){
  var old = document.querySelector('.toast');
  if (old) old.remove();
  var t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  $('app').appendChild(t);
  setTimeout(function(){ t.remove(); }, 1600);
}

function speak(text, code){
  if (!('speechSynthesis' in window)) { toast('이 브라우저는 음성 듣기를 지원하지 않아요'); return; }
  speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(text);
  u.lang = lang(code).voice;
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

// ---------- 화면 전환 ----------
function show(name){
  ui.screen = name;
  ['splash','onboarding','feed','saved','langs','review','review-done','add'].forEach(function(id){
    $(id).hidden = id !== name;
  });
  var withTabs = name === 'feed' || name === 'saved' || name === 'langs';
  $('tabs').hidden = !withTabs;
  document.querySelectorAll('.tab').forEach(function(t){ t.classList.toggle('on', t.dataset.tab === name); });
  closeLayer();
  if (name === 'onboarding' || name === 'langs') renderLangPickers();
  if (name === 'feed') renderFeed();
  if (name === 'saved') renderSaved();
  if (name === 'add') renderAdd();
  renderBadge();
}

// ---------- 언어 선택 (온보딩 · 언어 탭) ----------
function renderLangPickers(){
  var native = LANGS.map(function(l){
    return '<button class="chip' + (l.code === state.native ? ' on' : '') + '" data-action="native" data-code="' + l.code + '">' + esc(l.name) + '<small>' + esc(l.ko) + '</small></button>';
  }).join('');
  var learn = LANGS.filter(function(l){ return l.code !== state.native; }).map(function(l){
    return '<button class="chip' + (state.learn.indexOf(l.code) >= 0 ? ' on' : '') + '" data-action="learn" data-code="' + l.code + '">' + esc(l.name) + '<small>' + esc(l.ko) + '</small></button>';
  }).join('');
  var html = '<h3 class="sec">내 언어 (해석으로 보여줄 언어)</h3><div class="grid">' + native + '</div>' +
             '<h3 class="sec">배우는 언어 (여러 개 선택)</h3><div class="grid">' + learn + '</div>';
  document.querySelectorAll('.lang-pickers').forEach(function(el){ el.innerHTML = html; });

  var n = state.learn.length;
  $('start-btn').textContent = n ? '시작하기 · ' + n + '개 언어' : '배울 언어를 골라 주세요';
  $('start-btn').disabled = !n;
  $('langs-summary').textContent = n + '개 언어 · 카드 ' + allCards().length + '장이 섞여서 나와요';
}

function setNative(code){
  state.native = code;
  state.learn = state.learn.filter(function(c){ return c !== code; });
  if (!state.learn.length && ui.screen === 'langs') state.learn = [code === 'en' ? 'ja' : 'en'];
  persist();
  renderLangPickers();
}

function toggleLearn(code){
  var i = state.learn.indexOf(code);
  if (i >= 0) {
    if (state.learn.length === 1 && ui.screen === 'langs') { toast('배우는 언어를 하나 이상 골라 주세요'); return; }
    state.learn.splice(i, 1);
  } else {
    state.learn.push(code);
  }
  persist();
  renderLangPickers();
}

// ---------- 둘러보기 ----------
function allCards(){
  return CARDS.concat(state.custom).filter(function(c){ return state.learn.indexOf(c.lang) >= 0; });
}
function feedCards(){
  var cards = allCards();
  if (ui.cat === '전체') return cards;
  return cards.filter(function(c){ return c.cat === ui.cat; });
}

function renderFeed(){
  var cats = ['전체'];
  allCards().forEach(function(c){ if (cats.indexOf(c.cat) < 0) cats.push(c.cat); });
  if (cats.indexOf(ui.cat) < 0) ui.cat = '전체';
  $('cats').innerHTML = cats.map(function(c){
    return '<button class="chip' + (c === ui.cat ? ' on' : '') + '" data-action="cat" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
  }).join('');

  var cards = feedCards();
  var list = $('feed-list');
  if (!cards.length) {
    list.innerHTML = '<div class="empty"><b style="color:var(--ink);font-size:16px">아직 이 언어의 문장이 없어요</b>다른 언어를 고르거나 배울래요 탭에서 직접 문장을 추가해 보세요.</div>';
  } else {
    list.innerHTML = cards.map(function(c, i){
      return '<article class="card" data-i="' + i + '"><div class="card-body">' +
        (i === 0 && !state.tapped ? '<span class="hint">단어를 눌러 보세요</span>' : '') +
        wordsHtml(c, 'word', i) +
        '<p class="tr' + (state.hideTr ? ' hide' : '') + '" data-action="reveal">' + esc(trOf(c.tr)) + '</p>' +
        (c.expr ? '<div class="divider"></div><div class="expr"><i></i><div><b>' + esc(c.expr) + '</b><span>' + esc(trOf(c.mean) || '뜻을 아직 적지 않았어요') + '</span></div></div>' : '') +
        '</div></article>';
    }).join('');
  }
  ui.index = Math.min(ui.index, Math.max(cards.length - 1, 0));
  list.scrollTop = ui.index * list.clientHeight;
  $('acts').hidden = !cards.length;
  updateFeedHead();
}

function wordsHtml(card, action, cardIndex){
  return '<div class="words">' + card.words.map(function(w, j){
    var isKey = card.key.indexOf(j) >= 0;
    return '<button class="w' + (isKey ? ' key' : '') + '"' + (action ? ' data-action="' + action + '" data-card="' + cardIndex + '" data-w="' + j + '"' : '') + '>' + esc(w) + '</button>';
  }).join('') + '</div>';
}

function currentCard(){ return feedCards()[ui.index]; }

function updateFeedHead(){
  var cards = feedCards(), c = cards[ui.index];
  $('feed-head').innerHTML = c
    ? esc(c.cat) + '<span class="pill">' + esc(lang(c.lang).name) + '</span><span class="cnt">' + (ui.index + 1) + ' / ' + cards.length + '</span>'
    : '';
  var saveBtn = document.querySelector('[data-action="save-card"]');
  saveBtn.classList.toggle('on', !!(c && findSaved('s', c)));
  var trBtn = document.querySelector('[data-action="toggle-tr"]');
  trBtn.classList.toggle('on', state.hideTr);
  trBtn.querySelector('span').textContent = state.hideTr ? '해석 보기' : '해석 가림';
}

$('feed-list').addEventListener('scroll', function(){
  var h = this.clientHeight;
  var i = Math.round(this.scrollTop / h);
  if (i !== ui.index) { ui.index = i; updateFeedHead(); }
});

// 카드 빈 곳을 두 번 탭하면 문장 저장
$('feed-list').addEventListener('click', function(e){
  if (e.target.closest('button,[data-action]')) return;
  var now = Date.now();
  if (now - ui.lastTap < 320) {
    var c = currentCard();
    if (c && !findSaved('s', c)) saveItem('s', c); else if (c) toast('이미 저장한 문장이에요');
    ui.lastTap = 0;
  } else {
    ui.lastTap = now;
  }
});

function onWord(cardIndex, w){
  var c = feedCards()[cardIndex];
  if (!c) return;
  if (!state.tapped) {
    state.tapped = true;
    persist();
    var hint = document.querySelector('.hint');
    if (hint) hint.remove();
  }
  if (c.key.indexOf(w) >= 0 && c.expr) openWordSheet(c);
  else speak(c.words[w], c.lang);
}

// ---------- 시트 (표현 · 로그인) ----------
function openLayer(html){
  $('layer').innerHTML = '<div class="scrim" data-action="close-layer"></div><section class="sheet" role="dialog" aria-modal="true">' + html + '</section>';
}
function closeLayer(){
  $('layer').innerHTML = '';
  document.querySelectorAll('.w.key.sel').forEach(function(el){ el.classList.remove('sel'); });
}

function openWordSheet(card){
  ui.sheetCard = card;
  var cardEl = document.querySelector('.card[data-i="' + ui.index + '"]');
  if (cardEl) cardEl.querySelectorAll('.w.key').forEach(function(el){ el.classList.add('sel'); });
  var saved = !!findSaved('w', card);
  openLayer(
    '<div class="grab"></div>' +
    '<div style="display:flex;align-items:center;gap:10px"><h3 class="big">' + esc(card.expr) + '</h3><span class="pill">표현</span>' +
    '<button class="ib" style="margin-left:auto" data-action="speak-expr" aria-label="발음 듣기">' + icon(ICON.speak) + '</button></div>' +
    '<div class="mean">' + esc(trOf(card.mean) || '뜻을 아직 적지 않았어요') + '</div>' +
    '<div class="ctx"><b>이 문장에서</b>' + esc(sentence(card)) + ' (' + esc(trOf(card.tr)) + ')</div>' +
    '<div style="display:flex;gap:10px">' +
      '<button class="btn dark" style="flex:1' + (saved ? '' : ';box-shadow:0 0 0 4px rgba(37,99,235,.45)') + '" data-action="save-expr">' + icon(ICON.mark, saved ? ' style="fill:currentColor"' : '') + (saved ? '저장됨' : '배울래요') + '</button>' +
      '<button class="btn light" style="width:auto" data-action="close-layer">닫기</button>' +
    '</div>'
  );
}

function openLogin(){
  state.loginAsked = true;
  persist();
  openLayer(
    '<div class="grab"></div>' +
    '<h3>저장한 단어를 잃지 않으려면</h3>' +
    '<p style="margin:-6px 0 2px;font-size:14px;color:var(--muted)">로그인하면 다른 기기에서도 이어서 볼 수 있어요.</p>' +
    '<button class="btn dark" data-action="login" data-by="Apple"><span class="bdg" style="background:#fff;color:var(--ink)">A</span>Apple로 계속하기</button>' +
    '<button class="btn line" data-action="login" data-by="Google"><span class="bdg" style="background:#3b4047;color:#fff">G</span>Google로 계속하기</button>' +
    '<button class="btn light" data-action="login" data-by="이메일">이메일로 계속하기</button>' +
    '<button style="align-self:center;font-size:14px;font-weight:500;color:var(--muted);padding:10px 14px" data-action="close-layer">나중에</button>'
  );
}

// ---------- 저장 ----------
function itemId(kind, card){ return kind + ':' + card.id; }
function findSaved(kind, card){
  var id = itemId(kind, card);
  for (var i = 0; i < state.saved.length; i++) if (state.saved[i].id === id) return state.saved[i];
  return null;
}
function saveItem(kind, card){
  state.saved.unshift({id: itemId(kind, card), kind: kind, card: card, learned: false, due: Date.now(), at: Date.now()});
  persist();
  renderBadge();
  if (ui.screen === 'feed') updateFeedHead();
  if (!state.account && !state.loginAsked) openLogin();
  else toast('배울래요에 저장했어요');
}
function removeItem(id){
  state.saved = state.saved.filter(function(x){ return x.id !== id; });
  persist();
  renderBadge();
}
function toggleSave(kind, card){
  var it = findSaved(kind, card);
  if (it) { removeItem(it.id); toast('저장을 취소했어요'); if (ui.screen === 'feed') updateFeedHead(); }
  else saveItem(kind, card);
}

function dueItems(){
  var now = Date.now();
  return state.saved.filter(function(x){ return !x.learned && x.due <= now; });
}
function renderBadge(){
  var n = dueItems().length;
  $('badge').hidden = !n;
  $('badge').textContent = n;
}

// ---------- 배울래요 ----------
function renderSaved(){
  var due = dueItems().length;
  var ofKind = state.saved.filter(function(x){ return x.kind === ui.savedTab; });
  var learning = ofKind.filter(function(x){ return !x.learned; });
  var learned = ofKind.filter(function(x){ return x.learned; });
  var list = ui.savedFilter === 'learning' ? learning : learned;
  var countS = state.saved.filter(function(x){ return x.kind === 's'; }).length;
  var countW = state.saved.length - countS;

  var items = list.map(function(x){
    var c = x.card;
    var head = x.kind === 's' ? sentence(c) : c.expr;
    var sub = x.kind === 's' ? trOf(c.tr) : (trOf(c.mean) || sentence(c));
    var speakText = x.kind === 's' ? sentence(c) : c.expr.replace(/\s*\(.*\)$/, '');
    return '<div class="item">' +
      '<div class="en">' + esc(head) + '<span class="pill">' + esc(lang(c.lang).name) + '</span></div>' +
      '<div class="ko">' + esc(sub) + '</div>' +
      '<div class="btns">' +
        '<button class="ib" data-action="speak" data-text="' + esc(speakText) + '" data-lang="' + c.lang + '" aria-label="발음 듣기">' + icon(ICON.speak) + '</button>' +
        '<button class="ib" data-action="learned" data-id="' + esc(x.id) + '" aria-label="' + (x.learned ? '다시 외우기' : '외웠어요') + '"' + (x.learned ? ' style="background:rgba(37,99,235,.16)"' : '') + '>' + icon(ICON.check, x.learned ? ' style="stroke:#2563eb"' : '') + '</button>' +
        '<button class="ib" data-action="remove" data-id="' + esc(x.id) + '" aria-label="삭제">' + icon(ICON.close) + '</button>' +
      '</div></div>';
  }).join('');

  $('saved-page').innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin:4px 0 12px">' +
      '<h2 class="title" style="margin:0">배울래요</h2>' +
      '<button class="add-btn" data-action="open-add">' + icon(ICON.plus, ' style="width:16px;height:16px;stroke-width:2.2"') + '문장 추가</button>' +
    '</div>' +
    '<div class="review-banner"><div style="flex:1;min-width:0"><b>' + (due ? '오늘 복습 ' + due + '개' : '오늘 복습할 게 없어요') + '</b>' +
      '<span>' + (due ? '저장한 문장·표현을 다시 떠올려 봐요' : '새로 저장하거나 내일 다시 와 주세요') + '</span></div>' +
      '<button class="btn dark" style="width:auto;min-height:44px;padding:10px 16px;font-size:14px;border-radius:12px" data-action="review-start"' + (due ? '' : ' disabled') + '>복습 시작</button></div>' +
    '<div class="seg">' +
      '<button class="' + (ui.savedTab === 's' ? 'on' : '') + '" data-action="saved-tab" data-tab-kind="s">문장<small>' + countS + '</small></button>' +
      '<button class="' + (ui.savedTab === 'w' ? 'on' : '') + '" data-action="saved-tab" data-tab-kind="w">단어·표현<small>' + countW + '</small></button>' +
    '</div>' +
    '<p class="desc" style="margin:0 0 14px">외우는 중 ' + learning.length + '개 · 외웠어요 ' + learned.length + '개</p>' +
    '<div class="grid" style="margin-bottom:8px">' +
      '<button class="chip' + (ui.savedFilter === 'learning' ? ' on' : '') + '" data-action="saved-filter" data-filter="learning">외우는 중</button>' +
      '<button class="chip' + (ui.savedFilter === 'learned' ? ' on' : '') + '" data-action="saved-filter" data-filter="learned">외웠어요</button>' +
    '</div>' +
    (items || '<p class="desc" style="padding:24px 0;text-align:center">' +
      (ui.savedFilter === 'learning' ? '둘러보기에서 마음에 드는 ' + (ui.savedTab === 's' ? '문장을' : '표현을') + ' 저장해 보세요' : '아직 외운 항목이 없어요') + '</p>');
}

// ---------- 복습 ----------
function startReview(ids){
  if (!ids.length) return;
  ui.rv = {ids: ids, i: 0, shown: false, known: [], again: []};
  show('review');
  renderReview();
}

function renderReview(){
  var rv = ui.rv;
  var item = state.saved.filter(function(x){ return x.id === rv.ids[rv.i]; })[0];
  if (!item) { nextReview(); return; }
  var c = item.card;
  var pct = Math.round(rv.i / rv.ids.length * 100);
  var body = '<div style="display:flex;gap:8px;align-items:center;margin-bottom:18px;font-size:12px;font-weight:700">' + esc(c.cat) +
      '<span class="pill">' + esc(lang(c.lang).name) + '</span>' + (item.kind === 'w' ? '<span class="pill">표현</span>' : '') + '</div>' +
      wordsHtml(c, null);
  if (rv.shown) {
    body += '<p class="tr">' + esc(trOf(c.tr)) + '</p>' +
      (c.expr ? '<div class="divider"></div><div class="expr"><i></i><div><b>' + esc(c.expr) + '</b><span>' + esc(trOf(c.mean) || '뜻을 아직 적지 않았어요') + '</span></div></div>' : '');
  } else {
    body += '<div class="ask">' + (item.kind === 'w' ? '파란 표현의 뜻을 먼저 떠올려 보세요' : '뜻을 먼저 떠올려 보세요') + '</div>';
  }
  var foot = rv.shown
    ? '<div style="text-align:center;font-size:13px;color:var(--muted)">얼마나 기억났나요?</div>' +
      '<div style="display:flex;gap:10px"><button class="ans" style="background:var(--soft)" data-action="answer" data-known="0">다시 볼래요<small>내일 다시</small></button>' +
      '<button class="ans" style="background:#000;color:#fff" data-action="answer" data-known="1">알았어요<small>3일 뒤</small></button></div>'
    : '<div style="display:flex;gap:10px"><button class="ib" style="width:54px;height:54px;border-radius:14px" data-action="review-speak" aria-label="발음 듣기">' + icon(ICON.speak, ' style="width:22px;height:22px"') + '</button>' +
      '<button class="btn dark" style="flex:1" data-action="reveal-answer">정답 보기</button></div>';

  $('review').innerHTML =
    '<div class="rv-top"><button class="ib" data-action="review-quit" aria-label="복습 끝내기">' + icon(ICON.close) + '</button>' +
    '<div class="bar"><div style="width:' + pct + '%"></div></div>' +
    '<span style="font-size:13px;font-weight:500;color:var(--muted)">' + (rv.i + 1) + ' / ' + rv.ids.length + '</span></div>' +
    '<div class="rv-body">' + body + '</div>' +
    '<div style="position:absolute;left:0;right:0;bottom:0;padding:12px 16px 28px;display:flex;flex-direction:column;gap:10px">' + foot + '</div>';
}

function reviewItem(){
  var id = ui.rv.ids[ui.rv.i];
  return state.saved.filter(function(x){ return x.id === id; })[0];
}

function answer(known){
  var item = reviewItem();
  if (item) {
    item.due = startOfDay(Date.now()) + (known ? 3 : 1) * DAY;
    (known ? ui.rv.known : ui.rv.again).push(item.id);
    persist();
  }
  nextReview();
}

function nextReview(){
  ui.rv.i++;
  ui.rv.shown = false;
  if (ui.rv.i < ui.rv.ids.length) { renderReview(); return; }
  var today = dayKey(Date.now());
  if (state.lastReview !== today) {
    state.streak = state.lastReview === dayKey(Date.now() - DAY) ? state.streak + 1 : 1;
    state.lastReview = today;
    persist();
  }
  renderDone();
}

function renderDone(){
  var rv = ui.rv, total = rv.known.length + rv.again.length;
  show('review-done');
  $('review-done').innerHTML =
    '<div class="ok">' + icon(ICON.check, ' style="width:44px;height:44px;stroke:#fff;stroke-width:2.5"') + '</div>' +
    '<h1>오늘 복습 끝!</h1>' +
    '<p>' + total + '개 중 <b style="color:var(--blue)">' + rv.known.length + '개</b>를 알았어요.' +
      (rv.again.length ? '<br>모르는 ' + rv.again.length + '개는 내일 다시 보여드릴게요.' : '<br>모두 기억했어요!') + '</p>' +
    '<div class="stats"><div><b>' + rv.known.length + '</b><span>알았어요</span></div>' +
    '<div><b>' + rv.again.length + '</b><span>다시 볼래요</span></div>' +
    '<div class="hi"><b>' + state.streak + '일</b><span>연속 복습</span></div></div>' +
    '<div style="position:absolute;left:0;right:0;bottom:0;padding:12px 16px 28px;display:flex;flex-direction:column;gap:10px">' +
      '<button class="btn dark" data-tab="saved">배울래요로 돌아가기</button>' +
      '<button class="btn" style="font-size:14px;font-weight:500;color:var(--muted);min-height:44px" data-action="review-again"' + (rv.again.length ? '' : ' disabled') + '>틀린 것만 다시 보기</button>' +
    '</div>';
}

// ---------- 문장 추가 ----------
function renderAdd(){
  if (!ui.add || state.learn.indexOf(ui.add.lang) < 0) {
    ui.add = {lang: state.learn[0] || 'en', sel: []};
    $('add-text').value = '';
    $('add-tr').value = '';
    $('add-mean').value = '';
  }
  $('add-langs').innerHTML = state.learn.map(function(code){
    return '<button class="chip' + (code === ui.add.lang ? ' on' : '') + '" data-action="add-lang" data-code="' + code + '">' + esc(lang(code).name) + '</button>';
  }).join('');
  $('add-native').textContent = lang(state.native).ko;
  renderAddWords();
}

function addTokens(){
  var text = $('add-text').value.trim();
  if (!text) return [];
  return NO_SPACE[ui.add.lang] && text.indexOf(' ') < 0 ? Array.from(text) : text.split(/\s+/);
}

function renderAddWords(){
  var tokens = addTokens();
  ui.add.sel = ui.add.sel.filter(function(i){ return i < tokens.length; });
  $('add-words').innerHTML = tokens.length
    ? tokens.map(function(t, i){
        return '<button class="w' + (ui.add.sel.indexOf(i) >= 0 ? ' key' : '') + '" data-action="add-word" data-w="' + i + '">' + esc(t) + '</button>';
      }).join('')
    : '<span class="desc">문장을 입력하면 단어가 나타나요</span>';
  var expr = addExpr(tokens);
  $('add-expr').hidden = !expr;
  $('add-expr-text').textContent = expr;
  $('add-save').disabled = !tokens.length || !$('add-tr').value.trim();
}

function addExpr(tokens){
  var sel = ui.add.sel.slice().sort(function(a, b){ return a - b; });
  return sel.map(function(i){ return tokens[i]; }).join(NO_SPACE[ui.add.lang] && $('add-text').value.indexOf(' ') < 0 ? '' : ' ')
    .replace(/[.,!?。、！？]+$/, '');
}

function saveAdd(){
  var tokens = addTokens(), tr = $('add-tr').value.trim();
  if (!tokens.length || !tr) return;
  var sel = ui.add.sel.slice().sort(function(a, b){ return a - b; });
  var tr_ = {}, mean = {};
  tr_[state.native] = tr;
  if ($('add-mean').value.trim()) mean[state.native] = $('add-mean').value.trim();
  var card = {id: 'c' + Date.now(), lang: ui.add.lang, cat: '내 문장', words: tokens, key: sel, expr: addExpr(tokens), tr: tr_, mean: mean};
  state.custom.push(card);
  state.saved.unshift({id: itemId('s', card), kind: 's', card: card, learned: false, due: Date.now(), at: Date.now()});
  if (card.expr) state.saved.unshift({id: itemId('w', card), kind: 'w', card: card, learned: false, due: Date.now(), at: Date.now()});
  persist();
  ui.add = null;
  ui.savedTab = 's';
  ui.savedFilter = 'learning';
  show('saved');
  toast('내 문장을 저장했어요');
}

$('add-text').addEventListener('input', renderAddWords);
$('add-tr').addEventListener('input', renderAddWords);

// ---------- 클릭 처리 ----------
$('app').addEventListener('click', function(e){
  var el = e.target.closest('[data-action],[data-tab]');
  if (!el || el.disabled) return;
  if (el.dataset.tab && !el.dataset.action) { show(el.dataset.tab); return; }
  var d = el.dataset, c;
  switch (d.action) {
    case 'native': setNative(d.code); break;
    case 'learn': toggleLearn(d.code); break;
    case 'start':
      state.onboarded = true; persist(); ui.index = 0; show('feed'); break;
    case 'cat':
      ui.cat = d.cat; ui.index = 0; renderFeed(); break;
    case 'word': onWord(+d.card, +d.w); break;
    case 'reveal':
      if (state.hideTr) el.classList.toggle('hide'); break;
    case 'save-card':
      if ((c = currentCard())) toggleSave('s', c); break;
    case 'speak-card':
      if ((c = currentCard())) speak(sentence(c), c.lang); break;
    case 'toggle-tr':
      state.hideTr = !state.hideTr; persist();
      document.querySelectorAll('#feed-list .tr').forEach(function(p){ p.classList.toggle('hide', state.hideTr); });
      updateFeedHead(); break;
    case 'copy-card':
      if ((c = currentCard())) {
        var text = sentence(c);
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(function(){ toast('문장을 복사했어요'); }, function(){ toast('복사하지 못했어요'); });
        else toast('복사하지 못했어요');
      }
      break;
    case 'speak-expr':
      speak(ui.sheetCard.expr.replace(/\s*\(.*\)$/, ''), ui.sheetCard.lang); break;
    case 'save-expr':
      c = ui.sheetCard; closeLayer(); toggleSave('w', c); break;
    case 'close-layer': closeLayer(); break;
    case 'login':
      state.account = d.by; persist(); closeLayer(); toast(d.by + '(으)로 로그인했어요 · 데모'); break;
    case 'open-add': ui.add = null; show('add'); break;
    case 'close-add': show('saved'); break;
    case 'add-lang': ui.add.lang = d.code; ui.add.sel = []; renderAdd(); break;
    case 'add-word':
      var w = +d.w, i = ui.add.sel.indexOf(w);
      if (i >= 0) ui.add.sel.splice(i, 1); else ui.add.sel.push(w);
      renderAddWords(); break;
    case 'add-save': saveAdd(); break;
    case 'saved-tab': ui.savedTab = d.tabKind; renderSaved(); break;
    case 'saved-filter': ui.savedFilter = d.filter; renderSaved(); break;
    case 'speak': speak(d.text, d.lang); break;
    case 'learned':
      state.saved.forEach(function(x){ if (x.id === d.id) { x.learned = !x.learned; if (!x.learned) x.due = Date.now(); } });
      persist(); renderBadge(); renderSaved(); break;
    case 'remove': removeItem(d.id); renderSaved(); break;
    case 'review-start':
      startReview(dueItems().map(function(x){ return x.id; })); break;
    case 'review-again':
      startReview(ui.rv.again.slice()); break;
    case 'review-quit': show('saved'); break;
    case 'review-speak':
      c = reviewItem().card; speak(sentence(c), c.lang); break;
    case 'reveal-answer': ui.rv.shown = true; renderReview(); break;
    case 'answer': answer(d.known === '1'); break;
  }
});

// ---------- 화면 높이 맞추기 ----------
// 모바일 브라우저는 하단 도구 모음이 접히고 펴지면서 화면 크기가 바뀌므로, 실제로 보이는 영역에 맞춘다.
function fitViewport(){
  var v = window.visualViewport;
  var root = document.documentElement.style;
  root.setProperty('--vh', (v ? v.height : window.innerHeight) + 'px');
  root.setProperty('--vt', (v ? v.offsetTop : 0) + 'px');
}
fitViewport();
window.addEventListener('resize', fitViewport);
window.addEventListener('orientationchange', fitViewport);
if (window.visualViewport) {
  visualViewport.addEventListener('resize', fitViewport);
  visualViewport.addEventListener('scroll', fitViewport);
}

// ---------- 시작 ----------
show('splash');
setTimeout(function(){ show(state.onboarded ? 'feed' : 'onboarding'); }, 1100);
