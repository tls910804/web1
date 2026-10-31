// 문장 쇼츠 — 한 문장씩 넘기며 배우는 외국어
var STORE_KEY = 'sentence-shorts-v1';
var DAY = 24 * 60 * 60 * 1000;
var NO_SPACE = {ja:true, zh:true};
var LEVELS = ['전체', '초급', '중급', '고급'];
// 복습 방식별 간격(일). 단계가 오를수록 다음 간격을 쓴다.
var MODES = {
  std:   {name: '표준',     days: [1, 3, 7, 14]},
  slow:  {name: '천천히',   days: [2, 5, 10, 21]},
  dense: {name: '촘촘하게', days: [1, 2, 4, 7]}
};
var FONT_SIZES = {sm: {name: '작게', v: 0.88}, md: {name: '보통', v: 1}, lg: {name: '크게', v: 1.15}};
var THEMES = {light: '라이트', dark: '다크', system: '시스템'};

var state = Object.assign({
  onboarded: false,
  native: 'ko',
  learn: ['en'],
  saved: [],      // {id, kind:'s'|'w', card, wi, learned, due, at, step}
  custom: [],     // 직접 추가한 문장 카드
  known: [],      // '이미 알아요'로 둘러보기에서 숨긴 카드 id
  hideTr: false,
  tapped: false,  // 단어를 한 번이라도 눌러 봤는지
  account: null,
  loginAsked: false,
  streak: 0,
  best: 0,
  lastReview: null,
  log: {},        // 날짜별 복습 기록 {'2026-10-31': {n, ok}}
  level: '전체',
  auto: false,
  autoRepeat: 1,
  slow: false,
  mode: 'std',
  daily: 10,
  fontSize: 'md',
  theme: 'light',
  notify: {morning: false, evening: false},
  notified: {},
  notifyAsked: false,
  lastBackup: null
}, load());

// 이전 버전 데이터 옮기기
state.saved.forEach(function(x){
  if (x.wi === undefined) {
    x.wi = -1;
    if (x.kind === 'w' && x.id.split(':').length === 2) x.id += ':e';
  }
  if (x.step === undefined) x.step = 0;
});
if (!state.best || state.best < state.streak) state.best = state.streak;

var ui = {screen: null, cats: [], index: 0, lastTap: 0, savedTab: 's', savedFilter: 'learning', rv: null, add: null,
          feed: [], sub: null, subStack: [], statsRange: 'week', dlg: [], saveFail: false, voiceWarned: {}};

function load(){
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch(e){ return {}; }
}
function persist(){
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    ui.saveFail = false;
    return true;
  } catch(e){
    if (!ui.saveFail) { ui.saveFail = true; setTimeout(showSaveError, 0); }
    return false;
  }
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
function clean(w){ return w.replace(/^[¡¿\s]+|[.,!?。、！？\s]+$/g, ''); }
function glossOf(card, wi){
  var g = (window.GLOSS && GLOSS[card.id] && GLOSS[card.id][wi]) || '';
  if (!g) return '';
  var p = g.split('|');
  return state.native === 'ko' ? (p[0] || p[1] || '') : (p[1] || p[0] || '');
}
// 단어 조각 하나의 정보. 핵심 표현 조각은 표현 전체(expr)로 합쳐서 다룬다.
function wordInfo(card, wi){
  if (wi < 0 || card.key.indexOf(wi) >= 0) {
    return {wi: -1, expr: true, text: card.expr, mean: trOf(card.mean), speak: card.expr.replace(/\s*\(.*\)$/, '')};
  }
  var t = clean(card.words[wi]);
  return {wi: wi, expr: false, text: t, mean: glossOf(card, wi), speak: t};
}
// 난이도: 언어마다 문장 길이 순으로 세 등분한다 (짧은 1/3 초급, 가운데 중급, 긴 1/3 고급)
var LEVEL_OF = null;
function levelOf(card){
  if (!LEVEL_OF) {
    LEVEL_OF = {};
    var by = {};
    CARDS.forEach(function(c){ (by[c.lang] = by[c.lang] || []).push(c); });
    Object.keys(by).forEach(function(code){
      var list = by[code].slice().sort(function(a, b){ return sentence(a).length - sentence(b).length; });
      list.forEach(function(c, i){
        var r = i / list.length;
        LEVEL_OF[c.id] = r < 1/3 ? '초급' : r < 2/3 ? '중급' : '고급';
      });
    });
  }
  return LEVEL_OF[card.id] || '중급';
}
function startOfDay(t){ var d = new Date(t); d.setHours(0,0,0,0); return d.getTime(); }
function dayKey(t){ var d = new Date(t); return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate(); }
function todayKey(){ return dayKey(Date.now()); }
function icon(path, extra){ return '<svg class="i" viewBox="0 0 24 24"' + (extra || '') + '>' + path + '</svg>'; }
var ICON = {
  speak: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  mark: '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  flame: '<path d="M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1 2.5 2.5 2.5 4 1-1.5 1-5.5.5-8z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>',
  warn: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
  chart: '<path d="M6 20V11M12 20V5M18 20v-6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  bell: '<path d="M6 10a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0"/>'
};

function toast(msg, actionLabel, fn){
  var old = document.querySelector('.toast');
  if (old) old.remove();
  var t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = '<span>' + esc(msg) + '</span>';
  if (actionLabel) {
    var b = document.createElement('button');
    b.textContent = actionLabel;
    b.addEventListener('click', function(e){ e.stopPropagation(); t.remove(); fn(); });
    t.appendChild(b);
  }
  $('app').appendChild(t);
  setTimeout(function(){ t.remove(); }, actionLabel ? 3500 : 1600);
}

// ---------- 음성 ----------
function speechOk(){ return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window; }
function hasVoice(code){
  var vs = speechSynthesis.getVoices();
  if (!vs.length) return true; // 목록을 아직 못 받았으면 일단 시도
  var p = lang(code).voice.split('-')[0].toLowerCase();
  return vs.some(function(v){ return v.lang && v.lang.toLowerCase().replace('_', '-').indexOf(p) === 0; });
}
// opt: {rate, repeat, quiet}
function speak(text, code, opt){
  opt = opt || {};
  if (!speechOk()) {
    if (!opt.quiet) openDialog('음성을 들을 수 없어요', '이 브라우저는 발음 듣기를 지원하지 않아요. 크롬이나 사파리 최신 버전에서 열어 주세요.', [{label: '확인', kind: 'dark'}]);
    return;
  }
  if (!hasVoice(code) && !ui.voiceWarned[code]) {
    ui.voiceWarned[code] = true;
    var l = lang(code);
    openDialog('이 기기에 ' + l.ko + ' 음성이 없어요', '기기 설정의 \'텍스트 음성 변환\'에서 ' + l.ko + ' 음성을 내려받으면 정확한 발음으로 들을 수 있어요. 지금은 기본 음성으로 읽어요.', [{label: '확인', kind: 'dark'}]);
  }
  speechSynthesis.cancel();
  var rate = opt.rate || (state.slow ? 0.7 : 0.9);
  for (var i = 0; i < (opt.repeat || 1); i++) {
    var u = new SpeechSynthesisUtterance(text);
    u.lang = lang(code).voice;
    u.rate = rate;
    speechSynthesis.speak(u);
  }
}

// ---------- 화면 전환 ----------
var SCREENS = ['splash','onboarding','feed','saved','stats','settings','sub','review','review-done','add','streak'];
var TABS = {feed: 1, saved: 1, stats: 1, settings: 1};
function show(name){
  ui.screen = name;
  SCREENS.forEach(function(id){ $(id).hidden = id !== name; });
  $('tabs').hidden = !TABS[name];
  document.querySelectorAll('.tab').forEach(function(t){ t.classList.toggle('on', t.dataset.tab === name); });
  closeLayer();
  if (speechOk() && name !== 'feed') speechSynthesis.cancel();
  if (name === 'onboarding') renderLangPickers();
  if (name === 'feed') { renderFeed(); maybeAskNotify(); }
  if (name === 'saved') renderSaved();
  if (name === 'stats') renderStats();
  if (name === 'settings') { ui.subStack = []; renderSettings(); }
  if (name === 'sub') renderSub();
  if (name === 'add') renderAdd();
  renderBadge();
}
function openSub(name){
  if (ui.screen === 'sub' && ui.sub) ui.subStack.push(ui.sub);
  else ui.subStack = [];
  ui.sub = name;
  show('sub');
}
function goBack(){
  if (ui.subStack.length) { ui.sub = ui.subStack.pop(); show('sub'); }
  else show('settings');
}

// ---------- 언어 선택 (온보딩 · 설정) ----------
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
  var sum = $('langs-summary');
  if (sum) sum.textContent = n + '개 언어 · 카드 ' + allCards().length + '장이 섞여서 나와요';
}

function setNative(code){
  state.native = code;
  state.learn = state.learn.filter(function(c){ return c !== code; });
  if (!state.learn.length && ui.screen !== 'onboarding') state.learn = [code === 'en' ? 'ja' : 'en'];
  persist();
  renderLangPickers();
}

function toggleLearn(code){
  var i = state.learn.indexOf(code);
  if (i >= 0) {
    if (state.learn.length === 1 && ui.screen !== 'onboarding') { toast('배우는 언어를 하나 이상 골라 주세요'); return; }
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
  return allCards().filter(function(c){
    if (state.known.indexOf(c.id) >= 0) return false;
    if (state.level !== '전체' && levelOf(c) !== state.level && c.cat !== '내 문장') return false;
    return !ui.cats.length || ui.cats.indexOf(c.cat) >= 0;
  });
}
function allCats(){
  var cats = [];
  allCards().forEach(function(c){ if (cats.indexOf(c.cat) < 0) cats.push(c.cat); });
  return cats;
}

function renderFeed(){
  var cats = allCats();
  ui.cats = ui.cats.filter(function(c){ return cats.indexOf(c) >= 0; });
  $('cats').innerHTML = ['전체'].concat(cats).map(function(c){
    var on = c === '전체' ? !ui.cats.length : ui.cats.indexOf(c) >= 0;
    return '<button class="chip' + (on ? ' on' : '') + '" data-action="cat" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
  }).join('');
  $('filter-dot').hidden = state.level === '전체' && ui.cats.length < 2;
  $('auto-chip').classList.toggle('on', state.auto);

  var cards = ui.feed = feedCards();
  var list = $('feed-list');
  if (!cards.length) {
    var hidden = allCards().length > 0;
    list.innerHTML = '<div class="empty"><b style="color:var(--ink);font-size:16px">' +
      (hidden ? '조건에 맞는 문장이 없어요' : '아직 이 언어의 문장이 없어요') + '</b>' +
      (hidden ? '필터를 바꾸거나, \'이미 알아요\'로 숨긴 문장을 다시 볼 수 있어요.' : '다른 언어를 고르거나 배울래요 탭에서 직접 문장을 추가해 보세요.') +
      (hidden ? '<button class="btn line" style="width:auto;margin-top:12px;min-height:44px;font-size:14px" data-action="open-filter">필터 열기</button>' : '') +
      '</div>';
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

function wordsHtml(card, action, cardIndex, hl){
  hl = hl || card.key;
  return '<div class="words">' + card.words.map(function(w, j){
    var isKey = hl.indexOf(j) >= 0;
    return '<button class="w' + (isKey ? ' key' : '') + '"' + (action ? ' data-action="' + action + '" data-card="' + cardIndex + '" data-w="' + j + '"' : '') + '>' + esc(w) + '</button>';
  }).join('') + '</div>';
}

function currentCard(){ return ui.feed[ui.index]; }

function updateFeedHead(){
  var cards = ui.feed, c = cards[ui.index];
  $('feed-head').innerHTML = c
    ? esc(c.cat) + '<span class="pill">' + esc(lang(c.lang).name) + '</span><span class="cnt">' + (ui.index + 1) + ' / ' + cards.length + '</span>'
    : '';
  var saveBtn = document.querySelector('[data-action="save-card"]');
  saveBtn.classList.toggle('on', !!(c && findSaved('s', c)));
  var trBtn = document.querySelector('[data-action="toggle-tr"]');
  trBtn.classList.toggle('on', state.hideTr);
  trBtn.querySelector('span').textContent = state.hideTr ? '해석 보기' : '해석 가림';
}

function autoPlay(){
  clearTimeout(ui.autoTimer);
  if (!state.auto || ui.screen !== 'feed') return;
  ui.autoTimer = setTimeout(function(){
    var c = currentCard();
    if (c && ui.screen === 'feed' && !$('layer').innerHTML) speak(sentence(c), c.lang, {repeat: state.autoRepeat, quiet: true});
  }, 450);
}

$('feed-list').addEventListener('scroll', function(){
  var h = this.clientHeight;
  var i = Math.round(this.scrollTop / h);
  if (i !== ui.index) { ui.index = i; updateFeedHead(); autoPlay(); }
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
  var c = ui.feed[cardIndex];
  if (!c) return;
  if (!state.tapped) {
    state.tapped = true;
    persist();
    var hint = document.querySelector('.hint');
    if (hint) hint.remove();
  }
  openWordSheet(c, w);
}

function markKnown(){
  var c = currentCard();
  if (!c) return;
  state.known.push(c.id);
  persist();
  renderFeed();
  autoPlay();
  toast('이 문장은 다시 보여주지 않아요', '되돌리기', function(){
    state.known = state.known.filter(function(id){ return id !== c.id; });
    persist();
    if (ui.screen === 'feed') renderFeed();
  });
}

// ---------- 시트 · 대화상자 ----------
function openLayer(html){
  $('layer').innerHTML = '<div class="scrim" data-action="close-layer"></div><section class="sheet" role="dialog" aria-modal="true">' + html + '</section>';
}
function closeLayer(){
  $('layer').innerHTML = '';
  ui.dlg = [];
  document.querySelectorAll('.w.sel').forEach(function(el){ el.classList.remove('sel'); });
}
// actions: [{label, kind:'dark'|'light'|'danger', fn}]
function openDialog(title, body, actions){
  ui.dlg = actions.map(function(a){ return a.fn || function(){}; });
  $('layer').innerHTML = '<div class="scrim"></div><section class="dialog" role="alertdialog" aria-modal="true">' +
    '<h3>' + esc(title) + '</h3><p>' + esc(body) + '</p><div class="acts2">' +
    actions.map(function(a, i){ return '<button class="btn ' + (a.kind || 'light') + '" data-action="dlg" data-k="' + i + '">' + esc(a.label) + '</button>'; }).join('') +
    '</div></section>';
}
function sheetHead(title){
  return '<div class="grab"></div><div class="sh-head"><h3>' + esc(title) + '</h3><button class="ib" data-action="close-layer" aria-label="닫기">' + icon(ICON.close) + '</button></div>';
}

function openWordSheet(card, wi){
  var info = wordInfo(card, wi);
  ui.sheetCard = card;
  ui.sheetWi = wi;
  var cardEl = document.querySelector('.card[data-i="' + ui.index + '"]');
  if (cardEl) cardEl.querySelectorAll('.w').forEach(function(el){
    var j = +el.dataset.w;
    el.classList.toggle('sel', info.expr ? card.key.indexOf(j) >= 0 : j === wi);
  });
  var saved = !!findSaved('w', card, wi);
  openLayer(
    '<div class="grab"></div>' +
    '<div style="display:flex;align-items:center;gap:10px"><h3 class="big">' + esc(info.text) + '</h3><span class="pill">' + (info.expr ? '표현' : '단어') + '</span>' +
    '<button class="ib" style="margin-left:auto" data-action="speak-expr" aria-label="발음 듣기">' + icon(ICON.speak) + '</button></div>' +
    '<div class="mean">' + esc(info.mean || '뜻을 아직 적지 않았어요') + '</div>' +
    '<div class="ctx"><b>이 문장에서</b>' + esc(sentence(card)) + ' (' + esc(trOf(card.tr)) + ')</div>' +
    '<div style="display:flex;gap:10px">' +
      '<button class="btn dark" style="flex:1' + (saved ? '' : ';box-shadow:0 0 0 4px rgba(37,99,235,.45)') + '" data-action="save-expr">' + icon(ICON.mark, saved ? ' style="fill:currentColor"' : '') + (saved ? '저장됨' : '배울래요') + '</button>' +
      '<button class="btn light" style="width:auto" data-action="close-layer">닫기</button>' +
    '</div>'
  );
}

function openFilter(){
  ui.draft = {level: state.level, cats: ui.cats.slice()};
  renderFilter();
}
function renderFilter(){
  var d = ui.draft;
  var count = allCards().filter(function(c){
    if (state.known.indexOf(c.id) >= 0) return false;
    if (d.level !== '전체' && levelOf(c) !== d.level && c.cat !== '내 문장') return false;
    return !d.cats.length || d.cats.indexOf(c.cat) >= 0;
  }).length;
  openLayer(
    sheetHead('필터') +
    '<span class="lbl">난이도</span><div class="grid">' + LEVELS.map(function(l){
      return '<button class="chip' + (d.level === l ? ' on' : '') + '" data-action="f-level" data-v="' + l + '">' + l + '</button>';
    }).join('') + '</div>' +
    '<span class="lbl">분류<small>여러 개 고를 수 있어요</small></span><div class="grid">' + allCats().map(function(c){
      return '<button class="chip' + (d.cats.indexOf(c) >= 0 ? ' on' : '') + '" data-action="f-cat" data-v="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('') + '</div>' +
    (state.known.length ? '<div class="ctx" style="display:flex;align-items:center;gap:10px"><span style="flex:1">\'이미 알아요\'로 숨긴 문장 ' + state.known.length + '개</span><button class="lnk" style="color:var(--blue);font-weight:700;font-size:14px" data-action="unhide-known">다시 보기</button></div>' : '') +
    '<p class="desc" style="margin:0">난이도는 문장 길이로 나눈 기준이에요.</p>' +
    '<div style="display:flex;gap:10px"><button class="btn light" style="width:auto;padding:15px 18px" data-action="f-reset">초기화</button>' +
    '<button class="btn dark" style="flex:1" data-action="f-apply"' + (count ? '' : ' disabled') + '>' + (count ? count + '개 문장 보기' : '맞는 문장이 없어요') + '</button></div>'
  );
}

function openAutoSheet(){
  openLayer(
    sheetHead('자동재생') +
    '<div class="group" style="margin:0"><button class="row" data-action="set-auto"><span class="lb">자동재생<small>카드를 넘기면 발음이 바로 나와요</small></span><span class="switch' + (state.auto ? ' on' : '') + '"></span></button>' +
    '<button class="row" data-action="set-slow"><span class="lb">천천히 듣기<small>발음을 조금 느리게 들려줘요</small></span><span class="switch' + (state.slow ? ' on' : '') + '"></span></button></div>' +
    '<span class="lbl">반복</span><div class="grid">' + [1, 2, 3].map(function(n){
      return '<button class="chip' + (state.autoRepeat === n ? ' on' : '') + '" data-action="set-repeat" data-v="' + n + '">' + n + '번</button>';
    }).join('') + '</div>' +
    '<button class="btn dark" data-action="close-layer">완료</button>'
  );
}

function openLevelSheet(){
  openLayer(
    sheetHead('난이도') +
    '<p class="desc" style="margin:0">둘러보기에 나올 문장의 난이도예요. 직접 추가한 문장은 항상 보여요.</p>' +
    LEVELS.map(function(l){
      return '<button class="opt' + (state.level === l ? ' on' : '') + '" style="margin:0" data-action="set-level" data-v="' + l + '"><span class="rd"></span><span><b>' + l + '</b></span></button>';
    }).join('')
  );
}

function openLogin(){
  state.loginAsked = true;
  persist();
  openLayer(
    '<div class="grab"></div>' +
    '<h3>저장한 단어를 잃지 않으려면</h3>' +
    '<p style="margin:-6px 0 2px;font-size:14px;color:var(--muted)">로그인하면 다른 기기에서도 이어서 볼 수 있어요.</p>' +
    '<button class="btn dark" data-action="login" data-by="Apple"><span class="bdg" style="background:var(--btn-ink);color:var(--btn)">A</span>Apple로 계속하기</button>' +
    '<button class="btn line" data-action="login" data-by="Google"><span class="bdg" style="background:#3b4047;color:#fff">G</span>Google로 계속하기</button>' +
    '<button class="btn light" data-action="login" data-by="이메일">이메일로 계속하기</button>' +
    '<button class="btn link" data-action="close-layer">나중에</button>'
  );
}

// ---------- 저장 ----------
function itemId(kind, card, wi){
  if (kind === 's') return 's:' + card.id;
  var i = wordInfo(card, wi).wi;
  return 'w:' + card.id + ':' + (i < 0 ? 'e' : i);
}
function findSaved(kind, card, wi){
  var id = itemId(kind, card, wi);
  for (var i = 0; i < state.saved.length; i++) if (state.saved[i].id === id) return state.saved[i];
  return null;
}
function newItem(kind, card, wi){
  return {id: itemId(kind, card, wi), kind: kind, card: card, wi: kind === 'w' ? wordInfo(card, wi).wi : -1, learned: false, due: Date.now(), at: Date.now(), step: 0};
}
function saveItem(kind, card, wi){
  state.saved.unshift(newItem(kind, card, wi));
  var ok = persist();
  renderBadge();
  if (ui.screen === 'feed') updateFeedHead();
  if (!ok) return;
  if (!state.account && !state.loginAsked) openLogin();
  else toast('배울래요에 저장했어요');
}
function removeItem(id){
  state.saved = state.saved.filter(function(x){ return x.id !== id; });
  persist();
  renderBadge();
}
function toggleSave(kind, card, wi){
  var it = findSaved(kind, card, wi);
  if (it) { removeItem(it.id); toast('저장을 취소했어요'); if (ui.screen === 'feed') updateFeedHead(); }
  else saveItem(kind, card, wi);
}

function dueItems(){
  var now = Date.now();
  return state.saved.filter(function(x){ return !x.learned && x.due <= now; })
    .sort(function(a, b){ return a.due - b.due; });
}
function todayCount(){ return Math.min(dueItems().length, state.daily); }
function renderBadge(){
  var n = todayCount();
  $('badge').hidden = !n;
  $('badge').textContent = n;
}
function nextDueText(){
  var next = state.saved.filter(function(x){ return !x.learned; }).map(function(x){ return x.due; }).sort()[0];
  if (!next) return '';
  var days = Math.round((startOfDay(next) - startOfDay(Date.now())) / DAY);
  var n = state.saved.filter(function(x){ return !x.learned && startOfDay(x.due) === startOfDay(next); }).length;
  return (days <= 1 ? '내일' : days + '일 뒤') + ' ' + n + '개를 복습해요';
}

function showSaveError(){
  openDialog('저장하지 못했어요', '브라우저 저장 공간이 꽉 찼거나 비공개 모드일 수 있어요. 이 화면을 닫으면 방금 바꾼 내용이 사라질 수 있으니 파일로 내보내 두세요.', [
    {label: '다시 시도', kind: 'light', fn: function(){ ui.saveFail = false; if (persist()) toast('저장했어요'); }},
    {label: '파일로 내보내기', kind: 'dark', fn: exportData}
  ]);
}

// ---------- 배울래요 ----------
function renderSaved(){
  var head = '<div style="display:flex;align-items:center;justify-content:space-between;margin:4px 0 12px">' +
      '<h2 class="title" style="margin:0">배울래요</h2>' +
      '<button class="add-btn" data-action="open-add">' + icon(ICON.plus, ' style="width:16px;height:16px;stroke-width:2.2"') + '문장 추가</button>' +
    '</div>';

  if (!state.saved.length) {
    $('saved-page').innerHTML = head +
      '<div class="empty-state"><div class="em-ico">' + icon(ICON.mark) + '</div>' +
      '<b>아직 저장한 문장이 없어요</b>' +
      '<p>둘러보기에서 단어를 누르거나 카드를 두 번 탭해서<br>마음에 드는 문장을 저장해 보세요.</p>' +
      '<button class="btn dark" data-tab="feed">둘러보러 가기</button>' +
      '<button class="btn link" data-action="open-add">직접 문장 추가하기</button></div>';
    return;
  }

  var due = todayCount();
  var ofKind = state.saved.filter(function(x){ return x.kind === ui.savedTab; });
  var learning = ofKind.filter(function(x){ return !x.learned; });
  var learned = ofKind.filter(function(x){ return x.learned; });
  var list = ui.savedFilter === 'learning' ? learning : learned;
  var countS = state.saved.filter(function(x){ return x.kind === 's'; }).length;
  var countW = state.saved.length - countS;

  var items = list.map(function(x){
    var c = x.card;
    var info = x.kind === 'w' ? wordInfo(c, x.wi) : null;
    var head = x.kind === 's' ? sentence(c) : info.text;
    var sub = x.kind === 's' ? trOf(c.tr) : (info.mean || sentence(c));
    var speakText = x.kind === 's' ? sentence(c) : info.speak;
    return '<div class="item">' +
      '<div class="en">' + esc(head) + '<span class="pill">' + esc(lang(c.lang).name) + '</span></div>' +
      '<div class="ko">' + esc(sub) + '</div>' +
      '<div class="btns">' +
        '<button class="ib" data-action="speak" data-text="' + esc(speakText) + '" data-lang="' + c.lang + '" aria-label="발음 듣기">' + icon(ICON.speak) + '</button>' +
        '<button class="ib" data-action="learned" data-id="' + esc(x.id) + '" aria-label="' + (x.learned ? '다시 외우기' : '외웠어요') + '"' + (x.learned ? ' style="background:var(--blue-soft)"' : '') + '>' + icon(ICON.check, x.learned ? ' style="stroke:var(--blue)"' : '') + '</button>' +
        '<button class="ib" data-action="remove" data-id="' + esc(x.id) + '" aria-label="삭제">' + icon(ICON.close) + '</button>' +
      '</div></div>';
  }).join('');

  var waiting = dueItems().length - due;
  $('saved-page').innerHTML = head +
    '<div class="review-banner"><div style="flex:1;min-width:0"><b>' + (due ? '오늘 복습 ' + due + '개' : '오늘 복습은 끝났어요') + '</b>' +
      '<span>' + (due ? (waiting > 0 ? '하루 ' + state.daily + '개씩 · ' + waiting + '개는 다음에' : '저장한 문장·표현을 다시 떠올려 봐요') : (nextDueText() || '새로 저장하면 복습할 수 있어요')) + '</span></div>' +
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
function interval(step){
  var d = MODES[state.mode].days, last = d.length - 1;
  if (step <= last) return d[Math.max(step, 0)];
  return Math.min(d[last] * Math.pow(2, step - last), 120);
}
function daysLabel(n){ return n === 1 ? '내일' : n + '일 뒤'; }
// 평가별 다음 단계와 간격
function rateResult(item, r){
  var s = item.step || 0;
  if (r === 'again') return {step: 0, days: 1};
  if (r === 'hard') return {step: Math.max(s, 1), days: interval(s)};
  if (r === 'good') return {step: s + 1, days: interval(s + 1)};
  return {step: s + 2, days: interval(s + 2)};
}

function startReview(ids){
  if (!ids.length) return;
  ui.rv = {ids: ids, i: 0, shown: false, known: [], again: []};
  show('review');
  renderReview();
}

function renderReview(){
  var rv = ui.rv;
  var item = reviewItem();
  if (!item) { nextReview(); return; }
  var c = item.card;
  var pct = Math.round(rv.i / rv.ids.length * 100);
  var body = '<div style="display:flex;gap:8px;align-items:center;margin-bottom:18px;font-size:12px;font-weight:700">' + esc(c.cat) +
      '<span class="pill">' + esc(lang(c.lang).name) + '</span>' + (item.kind === 'w' ? '<span class="pill">' + (item.wi >= 0 ? '단어' : '표현') + '</span>' : '') + '</div>' +
      wordsHtml(c, null, 0, item.kind === 'w' && item.wi >= 0 ? [item.wi] : c.key);
  var info = item.kind === 'w' ? wordInfo(c, item.wi) : null;
  if (rv.shown) {
    body += '<p class="tr">' + esc(trOf(c.tr)) + '</p>';
    if (info) body += '<div class="divider"></div><div class="expr"><i></i><div><b>' + esc(info.text) + '</b><span>' + esc(info.mean || '뜻을 아직 적지 않았어요') + '</span></div></div>';
    else if (c.expr) body += '<div class="divider"></div><div class="expr"><i></i><div><b>' + esc(c.expr) + '</b><span>' + esc(trOf(c.mean) || '뜻을 아직 적지 않았어요') + '</span></div></div>';
  } else {
    body += '<div class="ask">' + (item.kind === 'w' ? '파란 표시의 뜻을 먼저 떠올려 보세요' : '뜻을 먼저 떠올려 보세요') + '</div>';
  }
  var rates = [['again', '다시', ''], ['hard', '어려웠어요', ''], ['good', '알았어요', 'good'], ['easy', '쉬워요', 'easy']];
  var foot = rv.shown
    ? '<div style="text-align:center;font-size:13px;color:var(--muted)">얼마나 기억났나요?</div>' +
      '<div class="rates">' + rates.map(function(r){
        return '<button class="ans ' + r[2] + '" data-action="answer" data-r="' + r[0] + '">' + r[1] + '<small>' + daysLabel(rateResult(item, r[0]).days) + '</small></button>';
      }).join('') + '</div>'
    : '<div style="display:flex;gap:10px"><button class="ib" style="width:54px;height:54px;border-radius:14px" data-action="review-speak" aria-label="발음 듣기">' + icon(ICON.speak, ' style="width:22px;height:22px"') + '</button>' +
      '<button class="btn dark" style="flex:1" data-action="reveal-answer">정답 보기</button></div>';

  $('review').innerHTML =
    '<div class="rv-top"><button class="ib" data-action="review-quit" aria-label="복습 그만두기">' + icon(ICON.close) + '</button>' +
    '<div class="bar"><div style="width:' + pct + '%"></div></div>' +
    '<span style="font-size:13px;font-weight:500;color:var(--muted)">' + (rv.i + 1) + ' / ' + rv.ids.length + '</span></div>' +
    '<div class="rv-body">' + body + '</div>' +
    '<div class="foot">' + foot + '</div>';
}

function reviewItem(){
  var id = ui.rv.ids[ui.rv.i];
  return state.saved.filter(function(x){ return x.id === id; })[0];
}

function logReview(ok){
  var k = todayKey();
  var e = state.log[k] || (state.log[k] = {n: 0, ok: 0});
  e.n++;
  if (ok) e.ok++;
}

function answer(r){
  var item = reviewItem();
  if (item) {
    var res = rateResult(item, r);
    item.step = res.step;
    item.due = startOfDay(Date.now()) + res.days * DAY;
    (r === 'again' ? ui.rv.again : ui.rv.known).push(item.id);
    logReview(r !== 'again');
    persist();
  }
  nextReview();
}

function finishStreak(){
  var today = todayKey();
  if (state.lastReview !== today) {
    state.streak = state.lastReview === dayKey(Date.now() - DAY) ? state.streak + 1 : 1;
    state.best = Math.max(state.best || 0, state.streak);
    state.lastReview = today;
    persist();
  }
}

function nextReview(){
  ui.rv.i++;
  ui.rv.shown = false;
  if (ui.rv.i < ui.rv.ids.length) { renderReview(); return; }
  finishStreak();
  renderDone();
}

function quitReview(){
  var rv = ui.rv, doneN = rv.known.length + rv.again.length, left = rv.ids.length - rv.i;
  if (!doneN) { show('saved'); return; }
  openDialog('복습을 그만할까요?', '지금까지 푼 ' + doneN + '개는 저장돼요. 남은 ' + left + '개는 다음에 다시 보여드릴게요.', [
    {label: '계속하기', kind: 'light'},
    {label: '나가기', kind: 'dark', fn: function(){ finishStreak(); show('saved'); }}
  ]);
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
    '<div><b>' + rv.again.length + '</b><span>다시</span></div>' +
    '<div class="hi"><b>' + state.streak + '일</b><span>연속 복습</span></div></div>' +
    '<div class="foot">' +
      '<button class="btn dark" data-tab="saved">배울래요로 돌아가기</button>' +
      '<button class="btn link" data-action="review-again"' + (rv.again.length ? '' : ' disabled') + '>틀린 것만 다시 보기</button>' +
    '</div>';
}

// ---------- 연속 일수 ----------
function monthReviews(){
  var d = new Date(), pre = d.getFullYear() + '-' + (d.getMonth() + 1) + '-';
  return Object.keys(state.log).reduce(function(s, k){ return s + (k.indexOf(pre) === 0 ? state.log[k].n : 0); }, 0);
}
// 어제도 오늘도 복습하지 않았으면 연속 기록이 끊긴 것
function checkStreak(){
  if (state.streak > 0 && state.lastReview && state.lastReview !== todayKey() && state.lastReview !== dayKey(Date.now() - DAY)) {
    var was = state.streak;
    state.best = Math.max(state.best || 0, was);
    state.streak = 0;
    persist();
    renderStreakBroken(was);
    return true;
  }
  return false;
}
function renderStreakBroken(was){
  show('streak');
  var due = todayCount();
  $('streak').innerHTML =
    '<div class="brk"><div class="hrow"><h2 class="title">연속 기록</h2><button class="ib" data-tab="feed" aria-label="닫기">' + icon(ICON.close) + '</button></div>' +
    '<div class="streak-card off"><div class="fl">' + icon(ICON.flame) + '</div><div style="min-width:0"><b>연속 기록이 끊겼어요</b><span>' + was + '일 동안 이어 왔어요</span></div><span class="best">최고 ' + state.best + '일</span></div>' +
    '<h2 style="font-size:22px;margin:36px 0 8px">괜찮아요, 오늘부터 다시 시작해요</h2>' +
    '<p class="desc" style="font-size:14px">하루 쉬었다고 지금까지 외운 문장이 사라지지 않아요. 오늘 복습하면 1일째가 시작돼요.</p>' +
    '<div class="tiles" style="margin-top:16px"><div class="tile"><span>최고 기록</span><b>' + state.best + '일</b></div><div class="tile"><span>이번 달 복습</span><b>' + monthReviews() + '개</b></div></div></div>' +
    '<div class="foot">' +
      (due ? '<button class="btn dark" data-action="review-start">오늘 복습하기 · ' + due + '개</button>' : '<button class="btn dark" data-tab="feed">둘러보며 저장하기</button>') +
      '<button class="btn link" data-tab="feed">닫기</button></div>';
}

// ---------- 기록 ----------
function mastered(x){ return x.learned || (x.step || 0) >= 3; }
function renderStats(){
  var head = '<div class="hrow"><h2 class="title">기록</h2>' +
    '<div class="toggle2"><button class="chip' + (ui.statsRange === 'week' ? ' on' : '') + '" data-action="stats-range" data-v="week">주</button>' +
    '<button class="chip' + (ui.statsRange === 'month' ? ' on' : '') + '" data-action="stats-range" data-v="month">월</button></div></div>';
  var anyLog = Object.keys(state.log).length > 0;
  if (!state.saved.length && !anyLog) {
    $('stats-page').innerHTML = '<div class="hrow"><h2 class="title">기록</h2></div>' +
      '<div class="empty-state"><div class="em-ico">' + icon(ICON.chart) + '</div>' +
      '<b>아직 기록이 없어요</b><p>문장을 저장하고 복습하면<br>연속 일수와 진행률이 여기에 쌓여요.</p>' +
      '<button class="btn dark" data-tab="feed">둘러보러 가기</button></div>';
    return;
  }

  var reviewedToday = state.lastReview === todayKey();
  var streakCard = state.streak > 0
    ? '<div class="streak-card"><div class="fl">' + icon(ICON.flame) + '</div><div style="min-width:0"><b>' + state.streak + '일 연속 복습 중</b><span>' +
        (reviewedToday ? '오늘 복습 완료! 내일도 이어 가요' : '오늘도 복습하면 ' + (state.streak + 1) + '일째예요') + '</span></div><span class="best">최고 ' + Math.max(state.best, state.streak) + '일</span></div>'
    : '<div class="streak-card off"><div class="fl">' + icon(ICON.flame) + '</div><div style="min-width:0"><b>오늘 복습으로 시작해요</b><span>매일 복습하면 연속 일수가 쌓여요</span></div>' + (state.best ? '<span class="best">최고 ' + state.best + '일</span>' : '') + '</div>';

  // 막대 그래프
  var days = ui.statsRange === 'week' ? 7 : 30, cols = [], max = 1, sum = 0, ok = 0;
  for (var i = days - 1; i >= 0; i--) {
    var t = Date.now() - i * DAY, e = state.log[dayKey(t)] || {n: 0, ok: 0};
    cols.push({t: t, n: e.n, today: i === 0});
    max = Math.max(max, e.n); sum += e.n; ok += e.ok;
  }
  var W = ['일','월','화','수','목','금','토'];
  var chart = '<div class="chart' + (days > 7 ? ' month' : '') + '">' + cols.map(function(c){
    var h = Math.round(c.n / max * 100);
    return '<div class="col" title="' + c.n + '개"><div class="bar2' + (c.today ? ' today' : '') + '" style="height:' + Math.max(h, 3) + '%"></div>' +
      (days === 7 ? '<span>' + W[new Date(c.t).getDay()] + '</span>' : '') + '</div>';
  }).join('') + '</div>';

  // 언어별 진행률
  var langs = [];
  state.saved.forEach(function(x){ if (langs.indexOf(x.card.lang) < 0) langs.push(x.card.lang); });
  var prog = langs.map(function(code){
    var items = state.saved.filter(function(x){ return x.card.lang === code; });
    var m = items.filter(mastered).length;
    var pct = Math.round(m / items.length * 100);
    return '<div class="prog"><div class="t"><b>' + esc(lang(code).name) + '</b><span>외움 ' + m + ' / ' + items.length + '</span></div>' +
      '<div class="bar"><div style="width:' + Math.max(pct, 2) + '%"></div></div></div>';
  }).join('');

  $('stats-page').innerHTML = head + streakCard +
    '<div class="box"><h4>' + (days === 7 ? '최근 7일' : '최근 30일') + ' 복습</h4>' + chart + '</div>' +
    '<div class="tiles"><div class="tile"><span>' + (days === 7 ? '이번 주' : '이번 달') + ' 복습</span><b>' + sum + '개</b></div>' +
    '<div class="tile"><span>정답 비율</span><b>' + (sum ? Math.round(ok / sum * 100) + '%' : '—') + '</b></div></div>' +
    (prog ? '<div class="box"><h4>언어별 진행률</h4>' + prog + '</div>' : '') +
    '<p class="note">\'알았어요\'를 세 번 이상 받거나 \'외웠어요\'로 표시한 항목을 외운 것으로 셉니다.</p>';
}

// ---------- 설정 ----------
function row(label, value, action, opt){
  opt = opt || {};
  return '<button class="row' + (opt.red ? ' red' : '') + '" data-action="' + action + '"' + (opt.data || '') + (opt.disabled ? ' disabled' : '') + '>' +
    '<span class="lb">' + esc(label) + (opt.sub ? '<small>' + esc(opt.sub) + '</small>' : '') + '</span>' +
    (value ? '<em>' + esc(value) + '</em>' : '') + (opt.noChev ? '' : icon(ICON.chev, ' style="width:18px;height:18px;stroke:var(--icon);flex:none"')) + '</button>';
}
function toggleRow(label, sub, on, action, disabled){
  return '<button class="row" data-action="' + action + '"' + (disabled ? ' disabled' : '') + '><span class="lb">' + esc(label) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span><span class="switch' + (on ? ' on' : '') + '"></span></button>';
}
function notifySummary(){
  var p = notifPerm();
  if (p === 'denied' || p === 'unsupported') return '꺼짐';
  if (state.notify.morning && state.notify.evening) return '아침 · 저녁';
  if (state.notify.morning) return '매일 오전 8:00';
  if (state.notify.evening) return '매일 오후 8:00';
  return '꺼짐';
}
function accountName(){ return state.account ? state.account + ' 계정' : '로그인하지 않음'; }

function renderSettings(){
  var learnNames = state.learn.map(function(c){ return lang(c).name; });
  var langVal = lang(state.native).ko + ' → ' + learnNames[0] + (learnNames.length > 1 ? ' 외 ' + (learnNames.length - 1) : '');
  $('settings-page').innerHTML =
    '<h2 class="title" style="margin-bottom:14px">설정</h2>' +
    (state.account
      ? '<button class="profile" data-action="sub" data-v="account"><span class="avatar">' + esc(state.account[0]) + '</span><span style="flex:1;min-width:0"><b>' + esc(accountName()) + '</b><span>데모 로그인 · 이 기기에 저장</span></span>' + icon(ICON.chev, ' style="width:18px;height:18px;stroke:var(--icon)"') + '</button>'
      : '<button class="profile" data-action="open-login"><span class="avatar">' + icon(ICON.mark, ' style="width:22px;height:22px;stroke:var(--blue)"') + '</span><span style="flex:1;min-width:0"><b>로그인하기</b><span>다른 기기에서도 이어서 볼 수 있어요</span></span>' + icon(ICON.chev, ' style="width:18px;height:18px;stroke:var(--icon)"') + '</button>') +
    '<div class="group-t">학습</div><div class="group">' +
      row('언어', langVal, 'sub', {data: ' data-v="langs"'}) +
      row('학습 설정', (state.auto ? '자동재생' : '수동') + ' · ' + MODES[state.mode].name, 'sub', {data: ' data-v="learn"'}) +
      row('알림', notifySummary(), 'sub', {data: ' data-v="notify"'}) +
    '</div>' +
    '<div class="group-t">화면 · 데이터</div><div class="group">' +
      row('화면', FONT_SIZES[state.fontSize].name + ' · ' + THEMES[state.theme], 'sub', {data: ' data-v="display"'}) +
      row('데이터', state.lastBackup ? '백업함' : '백업', 'sub', {data: ' data-v="data"'}) +
    '</div>' +
    '<p class="note">문장 쇼츠 · 외국어 문장과 뜻은 아직 원어민 검수 전이에요.</p>';
}

function subHeader(title){
  return '<div class="hdr"><button class="ib" data-action="back" aria-label="뒤로">' + icon(ICON.back) + '</button><h2>' + esc(title) + '</h2></div>';
}

function renderSub(){
  var s = ui.sub, html = '';
  if (s === 'langs') {
    html = subHeader('언어') + '<p class="desc" id="langs-summary"></p><div class="lang-pickers"></div>';
    $('sub-page').innerHTML = html;
    renderLangPickers();
    return;
  }
  if (s === 'learn') {
    html = subHeader('학습') + '<div class="group">' +
      toggleRow('자동재생', '카드를 넘기면 발음이 자동으로 나와요', state.auto, 'set-auto') +
      toggleRow('천천히 듣기', '발음을 조금 느리게 들려줘요', state.slow, 'set-slow') +
      row('복습 방식', MODES[state.mode].name, 'sub', {data: ' data-v="review-mode"'}) +
      row('하루 복습 개수', state.daily + '문장', 'sub', {data: ' data-v="review-mode"'}) +
      row('난이도', state.level, 'open-level') +
      '</div>';
  }
  if (s === 'review-mode') {
    html = subHeader('복습 방식') + '<p class="desc" style="margin-bottom:14px">기억한 정도에 따라 다음 복습 시점이 달라져요.</p>' +
      '<span class="lbl" style="margin-top:0">복습 간격</span>' +
      Object.keys(MODES).map(function(k){
        var m = MODES[k];
        return '<button class="opt' + (state.mode === k ? ' on' : '') + '" data-action="set-mode" data-v="' + k + '"><span class="rd"></span><span><b>' + m.name + '</b><span>' +
          m.days.map(function(d){ return d === 1 ? '내일' : d + '일'; }).join(' → ') + '</span></span></button>';
      }).join('') +
      '<span class="lbl">하루 복습 개수</span><div class="cnt3">' + [5, 10, 20].map(function(n){
        return '<button class="' + (state.daily === n ? 'on' : '') + '" data-action="set-daily" data-v="' + n + '"><b>' + n + '</b><span>문장</span></button>';
      }).join('') + '</div>' +
      '<p class="note">이미 정해진 복습 날짜는 그대로 두고, 다음 평가부터 새 간격을 써요.</p>';
  }
  if (s === 'notify') {
    var p = notifPerm();
    var blocked = p === 'denied' || p === 'unsupported';
    html = subHeader('알림') +
      (p === 'denied' ? '<div class="banner warn">' + icon(ICON.warn) + '<div class="tx"><b>알림이 꺼져 있어요</b>브라우저 설정에서 이 사이트의 알림을 허용해 주세요</div></div>' : '') +
      (p === 'unsupported' ? '<div class="banner warn">' + icon(ICON.warn) + '<div class="tx"><b>이 브라우저는 알림을 지원하지 않아요</b>아이폰은 홈 화면에 추가하면 알림을 받을 수 있어요</div></div>' : '') +
      '<div class="group">' +
        toggleRow('아침 한 문장', '오전 8시에 오늘의 문장 1개를 보내 드려요', !blocked && state.notify.morning, 'notify-morning', blocked) +
        toggleRow('저녁 복습 알림', '복습할 문장이 있는 날만 오후 8시에 알려요', !blocked && state.notify.evening, 'notify-evening', blocked) +
      '</div>' +
      '<p class="note">지금은 서버 없이 브라우저만으로 동작해서, 알림 시각이 지난 뒤 앱을 열었을 때 알림을 띄워요.</p>';
  }
  if (s === 'display') {
    html = subHeader('화면') +
      '<div class="preview"><div class="words"><span class="w">Nice</span><span class="w key">to meet</span><span class="w">you.</span></div><p class="tr" style="margin-top:8px">만나서 반가워요.</p></div>' +
      '<span class="lbl">글자 크기</span><div class="cnt3">' + Object.keys(FONT_SIZES).map(function(k){
        return '<button class="' + (state.fontSize === k ? 'on' : '') + '" data-action="set-font" data-v="' + k + '"><b style="font-size:' + Math.round(18 * FONT_SIZES[k].v) + 'px">가</b><span>' + FONT_SIZES[k].name + '</span></button>';
      }).join('') + '</div>' +
      '<span class="lbl">다크 모드</span><div class="cnt3">' + Object.keys(THEMES).map(function(k){
        return '<button class="' + (state.theme === k ? 'on' : '') + '" data-action="set-theme" data-v="' + k + '"><b style="font-size:16px">' + THEMES[k] + '</b><span>' + (k === 'system' ? '기기 설정 따라' : k === 'dark' ? '어두운 화면' : '밝은 화면') + '</span></button>';
      }).join('') + '</div>';
  }
  if (s === 'data') {
    html = subHeader('데이터') +
      '<div class="banner info">' + icon(ICON.info) + '<div class="tx"><b>이 브라우저에만 저장돼 있어요</b><span>백업해 두면 폰을 바꿔도 이어서 쓸 수 있어요</span></div></div>' +
      '<div class="group">' +
        row('파일로 내보내기', 'JSON', 'export') +
        row('파일에서 가져오기', 'JSON', 'import') +
        row('\'이미 알아요\' 문장 다시 보기', state.known.length + '개', 'unhide-known', {disabled: !state.known.length}) +
      '</div>' +
      '<p class="note">마지막 백업: ' + (state.lastBackup ? new Date(state.lastBackup).toLocaleString('ko-KR') : '없음') + '</p>';
  }
  if (s === 'account') {
    html = subHeader('계정') +
      '<div class="acc-head"><span class="avatar lg">' + esc((state.account || '?')[0]) + '</span><b>' + esc(accountName()) + '</b><span>데모 로그인이라 실제 계정과 연결되지 않아요</span></div>' +
      '<div class="group">' + row('로그인 방식', state.account || '—', 'noop', {noChev: true}) + '</div>' +
      '<div class="group">' + row('데이터 내보내기', 'JSON', 'export') + row('데이터 가져오기', '', 'import') + '</div>' +
      '<div class="group">' + row('로그아웃', '', 'logout') + row('계정 삭제', '', 'delete-account', {red: true}) + '</div>';
  }
  $('sub-page').innerHTML = html;
}

// ---------- 화면 테마 · 글자 크기 ----------
var darkMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function applyDisplay(){
  var t = state.theme === 'system' ? (darkMQ && darkMQ.matches ? 'dark' : 'light') : state.theme;
  document.documentElement.dataset.theme = t;
  document.documentElement.style.setProperty('--fs', FONT_SIZES[state.fontSize].v);
}
if (darkMQ && darkMQ.addEventListener) darkMQ.addEventListener('change', applyDisplay);

// ---------- 알림 ----------
function notifPerm(){ return 'Notification' in window ? Notification.permission : 'unsupported'; }
function setNotify(key){
  var p = notifPerm();
  if (state.notify[key]) { state.notify[key] = false; persist(); renderSub(); return; }
  if (p === 'granted') { state.notify[key] = true; persist(); renderSub(); return; }
  if (p === 'default') {
    Notification.requestPermission().then(function(r){
      if (r === 'granted') state.notify[key] = true;
      persist();
      if (ui.screen === 'sub') renderSub();
    });
  }
}
function maybeAskNotify(){
  if (state.notifyAsked || notifPerm() !== 'default' || !state.onboarded) return;
  state.notifyAsked = true;
  persist();
  setTimeout(function(){
    if (ui.screen !== 'feed' || $('layer').innerHTML) return;
    openLayer(
      '<div class="grab"></div>' +
      '<div class="em-ico" style="width:56px;height:56px;border-radius:50%;background:var(--blue-tint);display:flex;align-items:center;justify-content:center">' + icon(ICON.bell, ' style="width:26px;height:26px;stroke:var(--blue)"') + '</div>' +
      '<h3>매일 한 문장, 알림으로 받을래요?</h3>' +
      '<p style="margin:-6px 0 2px;font-size:14px;color:var(--muted);line-height:1.55">아침에 오늘의 문장을, 저녁엔 복습할 게 있을 때만 알려 드려요. 설정에서 언제든 끌 수 있어요.</p>' +
      '<button class="btn dark" data-action="notify-allow">알림 받기</button>' +
      '<button class="btn link" data-action="close-layer">나중에</button>'
    );
  }, 1500);
}
function checkNotify(){
  if (notifPerm() !== 'granted') return;
  var now = new Date(), k = todayKey();
  state.notified = state.notified || {};
  try {
    if (state.notify.morning && now.getHours() >= 8 && state.notified.m !== k) {
      var cards = allCards();
      var c = cards[Math.floor(startOfDay(Date.now()) / DAY) % cards.length];
      if (c) new Notification('오늘의 한 문장', {body: sentence(c) + '\n' + trOf(c.tr), tag: 'daily'});
      state.notified.m = k;
    }
    if (state.notify.evening && now.getHours() >= 20 && state.notified.e !== k && todayCount()) {
      new Notification('복습할 문장이 ' + todayCount() + '개 있어요', {body: '오늘 복습하면 연속 기록을 이어 갈 수 있어요', tag: 'review'});
      state.notified.e = k;
    }
  } catch(e) { /* 모바일 크롬은 페이지에서 바로 알림을 띄우지 못한다 */ }
  persist();
}

// ---------- 데이터 내보내기 · 가져오기 ----------
function exportData(){
  try {
    state.lastBackup = Date.now();
    var blob = new Blob([JSON.stringify(state, null, 2)], {type: 'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sentence-shorts-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
    persist();
    toast('파일로 내보냈어요');
    if (ui.screen === 'sub') renderSub();
  } catch(e) {
    toast('내보내지 못했어요');
  }
}
$('import-file').addEventListener('change', function(){
  var f = this.files[0];
  this.value = '';
  if (!f) return;
  var r = new FileReader();
  r.onload = function(){
    var data;
    try { data = JSON.parse(r.result); } catch(e) { data = null; }
    if (!data || !Array.isArray(data.saved) || !Array.isArray(data.learn)) {
      openDialog('가져오지 못했어요', '문장 쇼츠에서 내보낸 파일이 아니거나 파일이 손상됐어요.', [{label: '확인', kind: 'dark'}]);
      return;
    }
    openDialog('데이터를 가져올까요?', '저장한 항목 ' + data.saved.length + '개를 가져와요. 지금 이 기기의 데이터는 파일 내용으로 바뀌어요.', [
      {label: '취소', kind: 'light'},
      {label: '가져오기', kind: 'dark', fn: function(){
        Object.keys(data).forEach(function(k){ state[k] = data[k]; });
        state.saved.forEach(function(x){ if (x.step === undefined) x.step = 0; if (x.wi === undefined) x.wi = -1; });
        persist();
        applyDisplay();
        toast('데이터를 가져왔어요');
        show('settings');
      }}
    ]);
  };
  r.readAsText(f);
});

function deleteAccount(){
  openDialog('계정을 삭제할까요?', '저장한 문장, 복습 기록, 설정이 이 기기에서 모두 지워져요. 되돌릴 수 없어요.', [
    {label: '취소', kind: 'light'},
    {label: '삭제', kind: 'danger', fn: function(){
      try { localStorage.removeItem(STORE_KEY); } catch(e){}
      location.reload();
    }}
  ]);
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
  state.saved.unshift(newItem('s', card));
  if (card.expr) state.saved.unshift(newItem('w', card, -1));
  var ok = persist();
  ui.add = null;
  ui.savedTab = 's';
  ui.savedFilter = 'learning';
  show('saved');
  if (ok) toast('내 문장을 저장했어요');
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
      ui.cats = d.cat === '전체' ? [] : [d.cat]; ui.index = 0; renderFeed(); autoPlay(); break;
    case 'word': onWord(+d.card, +d.w); break;
    case 'reveal':
      if (state.hideTr) el.classList.toggle('hide'); break;
    case 'save-card':
      if ((c = currentCard())) toggleSave('s', c); break;
    case 'speak-card':
      if ((c = currentCard())) speak(sentence(c), c.lang); break;
    case 'slow-card':
      if ((c = currentCard())) speak(sentence(c), c.lang, {rate: 0.55}); break;
    case 'known-card': markKnown(); break;
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
    case 'open-filter': openFilter(); break;
    case 'f-level': ui.draft.level = d.v; renderFilter(); break;
    case 'f-cat':
      var fi = ui.draft.cats.indexOf(d.v);
      if (fi >= 0) ui.draft.cats.splice(fi, 1); else ui.draft.cats.push(d.v);
      renderFilter(); break;
    case 'f-reset': ui.draft = {level: '전체', cats: []}; renderFilter(); break;
    case 'f-apply':
      state.level = ui.draft.level; ui.cats = ui.draft.cats.slice(); persist();
      ui.index = 0; closeLayer(); renderFeed(); autoPlay(); break;
    case 'unhide-known':
      var n = state.known.length;
      state.known = []; persist(); toast('숨긴 문장 ' + n + '개를 다시 보여줘요');
      if (ui.screen === 'feed') { closeLayer(); renderFeed(); }
      if (ui.screen === 'sub') renderSub();
      break;
    case 'open-auto': openAutoSheet(); break;
    case 'set-auto':
      state.auto = !state.auto; persist();
      if (ui.screen === 'feed') { openAutoSheet(); $('auto-chip').classList.toggle('on', state.auto); }
      else renderSub();
      break;
    case 'set-slow':
      state.slow = !state.slow; persist();
      if (ui.screen === 'feed') openAutoSheet(); else renderSub();
      break;
    case 'set-repeat': state.autoRepeat = +d.v; persist(); openAutoSheet(); break;
    case 'open-level': openLevelSheet(); break;
    case 'set-level': state.level = d.v; persist(); closeLayer(); renderSub(); break;
    case 'speak-expr':
      speak(wordInfo(ui.sheetCard, ui.sheetWi).speak, ui.sheetCard.lang); break;
    case 'save-expr':
      c = ui.sheetCard; closeLayer(); toggleSave('w', c, ui.sheetWi); break;
    case 'close-layer':
      closeLayer();
      if (ui.screen === 'feed' && el.closest('.sheet') === null) autoPlay();
      break;
    case 'dlg':
      var fn = ui.dlg[+d.k]; closeLayer(); if (fn) fn(); break;
    case 'open-login': openLogin(); break;
    case 'login':
      state.account = d.by; persist(); closeLayer(); toast(d.by + '(으)로 로그인했어요 · 데모');
      if (ui.screen === 'settings') renderSettings();
      break;
    case 'logout':
      openDialog('로그아웃할까요?', '저장한 문장은 이 기기에 그대로 남아요.', [
        {label: '취소', kind: 'light'},
        {label: '로그아웃', kind: 'dark', fn: function(){ state.account = null; persist(); show('settings'); toast('로그아웃했어요'); }}
      ]);
      break;
    case 'delete-account': deleteAccount(); break;
    case 'sub': openSub(d.v); break;
    case 'back': goBack(); break;
    case 'set-mode': state.mode = d.v; persist(); renderSub(); break;
    case 'set-daily': state.daily = +d.v; persist(); renderSub(); renderBadge(); break;
    case 'set-font': state.fontSize = d.v; persist(); applyDisplay(); renderSub(); break;
    case 'set-theme': state.theme = d.v; persist(); applyDisplay(); renderSub(); break;
    case 'notify-morning': setNotify('morning'); break;
    case 'notify-evening': setNotify('evening'); break;
    case 'notify-allow':
      closeLayer();
      if (notifPerm() === 'default') Notification.requestPermission().then(function(r){
        if (r === 'granted') { state.notify.morning = true; state.notify.evening = true; persist(); toast('알림을 켰어요'); }
        else toast('알림은 설정에서 다시 켤 수 있어요');
      });
      break;
    case 'export': exportData(); break;
    case 'import': $('import-file').click(); break;
    case 'stats-range': ui.statsRange = d.v; renderStats(); break;
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
      startReview(dueItems().slice(0, state.daily).map(function(x){ return x.id; })); break;
    case 'review-again':
      startReview(ui.rv.again.slice()); break;
    case 'review-quit': quitReview(); break;
    case 'review-speak':
      c = reviewItem().card; speak(sentence(c), c.lang); break;
    case 'reveal-answer': ui.rv.shown = true; renderReview(); break;
    case 'answer': answer(d.r); break;
  }
});

// ---------- 오프라인 ----------
function updateNet(){ $('net').hidden = navigator.onLine !== false; }
window.addEventListener('online', function(){ updateNet(); toast('다시 연결됐어요'); });
window.addEventListener('offline', updateNet);
updateNet();

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
document.addEventListener('visibilitychange', function(){ if (!document.hidden) checkNotify(); });
if (speechOk() && speechSynthesis.getVoices) speechSynthesis.getVoices();

// ---------- 시작 ----------
applyDisplay();
show('splash');
setTimeout(function(){
  if (!state.onboarded) { show('onboarding'); return; }
  if (!checkStreak()) show('feed');
  checkNotify();
}, 1100);
