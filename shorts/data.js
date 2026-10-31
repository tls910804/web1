// 언어 목록: code, 원어 이름, 한국어 이름, 음성 합성용 언어 코드
var LANGS = [
  {code:'en', name:'English', ko:'영어', voice:'en-US'},
  {code:'ko', name:'한국어', ko:'한국어', voice:'ko-KR'},
  {code:'ja', name:'日本語', ko:'일본어', voice:'ja-JP'},
  {code:'zh', name:'中文', ko:'중국어', voice:'zh-CN'},
  {code:'es', name:'Español', ko:'스페인어', voice:'es-ES'},
  {code:'fr', name:'Français', ko:'프랑스어', voice:'fr-FR'},
  {code:'de', name:'Deutsch', ko:'독일어', voice:'de-DE'},
  {code:'pt', name:'Português', ko:'포르투갈어', voice:'pt-BR'},
  {code:'ru', name:'Русский', ko:'러시아어', voice:'ru-RU'},
  {code:'vi', name:'Tiếng Việt', ko:'베트남어', voice:'vi-VN'},
  {code:'id', name:'Bahasa Indonesia', ko:'인도네시아어', voice:'id-ID'}
];

// 문장 카드. words = 화면에 보이는 단어 조각, key = 핵심 표현 조각의 위치,
// expr = 핵심 표현, tr = 문장 해석, mean = 핵심 표현의 뜻 (내 언어별: ko, en)
var CARDS = [];
var cardCount = {};
function c(lang, cat, words, key, expr, trKo, trEn, meanKo, meanEn){
  cardCount[lang] = (cardCount[lang] || 0) + 1;
  var tr = {}, mean = {};
  if (trKo) tr.ko = trKo;
  if (trEn) tr.en = trEn;
  if (meanKo) mean.ko = meanKo;
  if (meanEn) mean.en = meanEn;
  CARDS.push({id: lang + cardCount[lang], lang: lang, cat: cat, words: words, key: key, expr: expr, tr: tr, mean: mean});
}

// ---------- English ----------
c('en','일상',["I'm",'running late,','be','there','in','ten.'],[1],'running late','좀 늦어, 10분 안에 갈게.',"I'm late, I'll be there in ten minutes.",'예정보다 늦어지고 있다','behind schedule');
c('en','회사',["Let's",'call it a day.'],[1],'call it a day','오늘은 여기까지 하자.',"Let's stop working for today.",'하던 일을 그만 마치다','to stop working for the day');
c('en','카페·식당',['Can I','get','this','to go?'],[3],'to go','이거 포장해 주실 수 있나요?','Can I take this away?','포장해서 가져가는','for takeaway');
c('en','여행',['Is','it','within','walking distance?'],[3],'walking distance','걸어갈 수 있는 거리인가요?','Can I walk there?','걸어갈 수 있는 거리','close enough to walk');
c('en','감정',["I'm",'over the moon','about','it.'],[1],'over the moon','그거 때문에 정말 기뻐.',"I'm extremely happy about it.",'몹시 기쁜','extremely happy');
c('en','회사',['Let me','get back to you','on','that.'],[1],'get back to you','그건 확인하고 다시 알려 드릴게요.',"I'll check and reply to you about that.",'나중에 다시 연락하다','to reply later');
c('en','일상',["It's",'no big deal.'],[1],'no big deal','별일 아니야.',"It's not a problem.",'별것 아닌 일','not important');
c('en','여행',['Could you','point me to','the nearest station?'],[1],'point me to','가장 가까운 역이 어디인지 알려 주실래요?','Could you tell me where the nearest station is?','~로 가는 길을 알려 주다','to show me the way to');
c('en','카페·식당',['Could I','have','the check,','please?'],[2],'the check','계산서 좀 주시겠어요?','Could I get the bill, please?','계산서','the bill');
c('en','감정',["I'm",'feeling','under the weather','today.'],[2],'under the weather','오늘 몸이 좀 안 좋아.',"I don't feel well today.",'몸이 좀 안 좋은','slightly ill');

// ---------- 한국어 ----------
c('ko','일상',['지금','가는 중','이에요.'],[1],'가는 중',null,"I'm on my way now.",null,'on the way');
c('ko','일상',['조금','늦을 것 같아요.'],[1],'늦을 것 같아요',null,"I think I'll be a little late.",null,'likely to be late');
c('ko','카페·식당',['아이스','아메리카노','한 잔','주세요.'],[3],'주세요',null,'One iced americano, please.',null,'please give me');
c('ko','카페·식당',['여기서','먹고 갈게요.'],[1],'먹고 갈게요',null,"For here, please. (I'll eat here.)",null,"I'll eat here");
c('ko','회사',['확인하고','다시','연락드릴게요.'],[2],'연락드릴게요',null,"I'll check and get back to you.",null,"I'll contact you (polite)");
c('ko','여행',['이거','얼마예요?'],[1],'얼마예요',null,'How much is this?',null,'how much is it');
c('ko','여행',['화장실이','어디예요?'],[1],'어디예요',null,'Where is the restroom?',null,'where is it');
c('ko','감정',['너무','기대돼요!'],[1],'기대돼요',null,"I'm really looking forward to it!",null,'looking forward to');
c('ko','일상',['수고','많으셨어요.'],[0,1],'수고 많으셨어요',null,'Thank you for your hard work.',null,'thanks for your effort');
c('ko','감정',['정말','고마워요.'],[1],'고마워요',null,'Thank you so much.',null,'thank you');

// ---------- 日本語 ----------
c('ja','일상',['ちょっと','遅れそう','です。'],[1],'遅れそう (おくれそう)','조금 늦을 것 같아요.',"I think I'll be a little late.",'늦을 것 같다','likely to be late');
c('ja','카페·식당',['お会計','お願いします。'],[0],'お会計 (おかいけい)','계산 부탁드립니다.','The bill, please.','계산, 결제','the bill');
c('ja','여행',['駅は','どこ','ですか？'],[1],'どこ','역은 어디인가요?','Where is the station?','어디','where');
c('ja','회사',['お疲れ','様です。'],[0,1],'お疲れ様 (おつかれさま)','수고하셨습니다.','Thank you for your hard work.','수고하셨습니다 (인사말)','thanks for your effort');
c('ja','회사',['少々','お待ち','ください。'],[0],'少々 (しょうしょう)','잠시만 기다려 주세요.','Please wait a moment.','잠시, 조금','a little while');
c('ja','카페·식당',['おすすめは','何','ですか？'],[0],'おすすめ','추천 메뉴는 뭔가요?',"What do you recommend?",'추천','recommendation');
c('ja','여행',['写真を','撮って','もらえますか？'],[0,1],'写真を撮る (しゃしんをとる)','사진 좀 찍어 주실 수 있나요?','Could you take a photo for me?','사진을 찍다','to take a photo');
c('ja','감정',['めっちゃ','嬉しい！'],[0],'めっちゃ','엄청 기뻐!',"I'm so happy!",'엄청, 매우 (구어)','super, very (casual)');
c('ja','일상',['また','今度','ね。'],[1],'今度 (こんど)','다음에 또 보자.','Let\'s meet again next time.','다음 번','next time');
c('ja','일상',['よろしく','お願いします。'],[0,1],'よろしくお願いします','잘 부탁드립니다.','Nice to meet you. / Thank you in advance.','잘 부탁드립니다 (인사말)','please treat me well (set phrase)');

// ---------- 中文 ----------
c('zh','카페·식당',['我要','一杯','冰美式。'],[2],'冰美式 (bīng měishì)','아이스 아메리카노 한 잔 주세요.',"I'd like an iced americano.",'아이스 아메리카노','iced americano');
c('zh','일상',['我','马上','就到。'],[1],'马上 (mǎshàng)','나 금방 도착해.',"I'll be there right away.",'곧, 금방','right away');
c('zh','여행',['请问','洗手间','在哪里？'],[1],'洗手间 (xǐshǒujiān)','실례지만 화장실이 어디예요?','Excuse me, where is the restroom?','화장실','restroom');
c('zh','카페·식당',['可以','打包','吗？'],[1],'打包 (dǎbāo)','포장 되나요?','Can I get this to go?','포장하다','to pack up / take away');
c('zh','일상',['不','客气。'],[0,1],'不客气 (bú kèqi)','천만에요.',"You're welcome.",'별말씀을요','you\'re welcome');
c('zh','회사',['我们','开会','吧。'],[1],'开会 (kāihuì)','우리 회의합시다.',"Let's have the meeting.",'회의하다','to have a meeting');
c('zh','여행',['多少','钱？'],[0,1],'多少钱 (duōshao qián)','얼마예요?','How much is it?','얼마예요','how much');
c('zh','감정',['我','太','开心了！'],[2],'开心 (kāixīn)','너무 기뻐요!',"I'm so happy!",'기쁘다, 즐겁다','happy');
c('zh','일상',['等','一下。'],[0,1],'等一下 (děng yíxià)','잠깐만요.','Wait a moment.','잠깐 기다려 주세요','wait a moment');
c('zh','회사',['辛苦','了。'],[0],'辛苦 (xīnkǔ)','수고했어요.','Thanks for your hard work.','수고하다','hardworking, to toil');

// ---------- Español ----------
c('es','카페·식당',['La cuenta,','por favor.'],[0],'la cuenta','계산서 부탁해요.','The bill, please.','계산서','the bill');
c('es','감정',['¡Qué','buena onda!'],[1],'buena onda','느낌 정말 좋다!','Such good vibes!','좋은 분위기, 좋은 느낌','good vibes');
c('es','일상',['Nos vemos','mañana.'],[0],'nos vemos','내일 보자.','See you tomorrow.','또 봐요','see you');
c('es','여행',['¿Dónde','está','la estación?'],[0,1],'dónde está','역이 어디예요?','Where is the station?','~는 어디에 있어요?','where is');
c('es','카페·식당',['Quisiera','un café','con leche.'],[0],'quisiera','카페 콘 레체 한 잔 주세요.',"I'd like a coffee with milk.",'~하고 싶습니다 (공손)',"I would like (polite)");
c('es','일상',['No pasa','nada.'],[0,1],'no pasa nada','괜찮아, 별일 아니야.',"It's fine, don't worry.",'괜찮아요',"no worries");
c('es','회사',['Estoy','en una reunión.'],[1],'en una reunión','지금 회의 중이야.',"I'm in a meeting.",'회의 중인','in a meeting');
c('es','감정',['Estoy','muy','emocionado.'],[2],'emocionado','정말 설레.',"I'm really excited.",'설레는, 감동한','excited, moved');
c('es','여행',['¿Cuánto','cuesta','esto?'],[0,1],'cuánto cuesta','이거 얼마예요?','How much does this cost?','얼마예요','how much does it cost');
c('es','일상',['Tengo','hambre.'],[0,1],'tener hambre','배고파.',"I'm hungry.",'배고프다','to be hungry');

// ---------- Français ----------
c('fr','일상',['Ça marche !'],[0],'ça marche','좋아, 그렇게 하자!','Sounds good!','좋아, 알겠어','sounds good');
c('fr','카페·식당',['Je voudrais','un café,',"s'il vous plaît."],[0],'je voudrais','커피 한 잔 주세요.',"I'd like a coffee, please.",'~하고 싶어요 (공손)','I would like (polite)');
c('fr','여행',['Où','est','la gare ?'],[2],'la gare','기차역이 어디예요?','Where is the train station?','기차역','train station');
c('fr','일상',["À tout à l'heure !"],[0],"à tout à l'heure",'이따 봐!','See you later!','이따 봐요','see you later');
c('fr','일상',['Pas','de souci.'],[0,1],'pas de souci','걱정 마, 문제없어.','No worries.','문제없어요','no problem');
c('fr','회사',['On fait','une pause ?'],[0,1],'faire une pause','잠깐 쉴까요?','Shall we take a break?','잠시 쉬다','to take a break');
c('fr','감정',['Je suis','ravi','de vous voir.'],[1],'ravi','만나서 정말 기뻐요.','I am delighted to see you.','매우 기쁜','delighted');
c('fr','여행',["C'est",'combien ?'],[0,1],"c'est combien",'얼마예요?','How much is it?','얼마예요','how much is it');
c('fr','카페·식당',["L'addition,","s'il vous plaît."],[0],"l'addition",'계산서 주세요.','The bill, please.','계산서','the bill');
c('fr','일상',['Bon','courage !'],[0,1],'bon courage','힘내요!','Good luck! / Hang in there!','힘내세요, 화이팅','good luck, hang in there');

// ---------- Deutsch ----------
c('de','여행',['Wo','ist','der Bahnhof?'],[2],'der Bahnhof','기차역은 어디예요?','Where is the train station?','기차역','train station');
c('de','카페·식당',['Die Rechnung,','bitte.'],[0],'die Rechnung','계산서 주세요.','The bill, please.','계산서','the bill');
c('de','일상',['Kein','Problem.'],[0,1],'kein Problem','문제없어요.','No problem.','문제없다','no problem');
c('de','회사',['Ich','melde mich','später.'],[1],'sich melden','나중에 연락드릴게요.',"I'll get in touch later.",'연락하다','to get in touch');
c('de','일상',['Bis','später!'],[0,1],'bis später','이따 봐요!','See you later!','이따 봐요','see you later');
c('de','여행',['Wie viel','kostet','das?'],[0,1],'wie viel kostet','이거 얼마예요?','How much is this?','얼마예요','how much does it cost');
c('de','감정',['Ich','freue mich','darauf.'],[1],'sich freuen','그게 기대돼요.',"I'm looking forward to it.",'기뻐하다, 기대하다','to be glad, to look forward');
c('de','카페·식당',['Einen Kaffee','zum Mitnehmen,','bitte.'],[1],'zum Mitnehmen','커피 한 잔 포장해 주세요.','A coffee to go, please.','포장해서 가져가는','to go');
c('de','일상',['Das','ist','mir egal.'],[2],'mir egal','나는 상관없어.',"I don't mind. / I don't care.",'상관없다',"I don't mind");
c('de','여행',['Sprechen Sie','Englisch?'],[0,1],'Sprechen Sie Englisch','영어 하세요?','Do you speak English?','영어 하시나요?','Do you speak English?');

// ---------- Português ----------
c('pt','일상',['Estou','chegando.'],[0,1],'estou chegando','거의 다 왔어.',"I'm almost there.",'도착하는 중이다','arriving');
c('pt','카페·식당',['A conta,','por favor.'],[0],'a conta','계산서 주세요.','The bill, please.','계산서','the bill');
c('pt','카페·식당',['Pode','ser','para viagem?'],[2],'para viagem','포장해 주실 수 있나요?','Can I get it to go?','포장','to go');
c('pt','여행',['Onde','fica','o metrô?'],[0,1],'onde fica','지하철은 어디에 있나요?','Where is the subway?','~는 어디에 있어요?','where is');
c('pt','일상',['Tudo','bem?'],[0,1],'tudo bem','잘 지내? 괜찮아?',"How are you? / Is everything okay?",'잘 지내요, 괜찮아요',"everything's fine");
c('pt','회사',['Vamos','marcar','uma reunião.'],[1,2],'marcar uma reunião','회의 일정 잡읍시다.',"Let's schedule a meeting.",'회의를 잡다','to schedule a meeting');
c('pt','감정',['Fiquei','muito','feliz!'],[0,2],'fiquei feliz','정말 기뻤어!','I was so happy!','기뻐졌다','I became happy');
c('pt','여행',['Quanto','custa','isso?'],[0,1],'quanto custa','이거 얼마예요?','How much does this cost?','얼마예요','how much does it cost');
c('pt','일상',['Sem','problema.'],[0,1],'sem problema','문제없어요.','No problem.','문제없다','no problem');
c('pt','감정',['Estou','com','saudade.'],[2],'saudade','보고 싶어.','I miss you. / I miss it.','그리움, 보고 싶은 마음','longing, missing someone');

// ---------- Русский ----------
c('ru','일상',['Я','уже','иду.'],[1,2],'уже иду','지금 가는 중이야.',"I'm already on my way.",'이미 가는 중이다','already on my way');
c('ru','카페·식당',['Счёт,','пожалуйста.'],[0],'счёт','계산서 주세요.','The bill, please.','계산서','the bill');
c('ru','여행',['Где','находится','вокзал?'],[0,1],'где находится','기차역이 어디에 있나요?','Where is the train station?','~는 어디에 있나요','where is it located');
c('ru','일상',['Ничего','страшного.'],[0,1],'ничего страшного','괜찮아요, 별일 아니에요.',"It's okay, no big deal.",'괜찮아요','no big deal');
c('ru','회사',['Давайте','начнём','совещание.'],[0,1],'давайте начнём','회의를 시작합시다.',"Let's start the meeting.",'시작합시다',"let's begin");
c('ru','카페·식당',['Мне','кофе','с собой.'],[2],'с собой','커피 포장해 주세요.','A coffee to go, please.','포장해서 가져가는','to go');
c('ru','감정',['Я','очень','рад.'],[2],'рад','정말 기뻐요.','I am very glad.','기쁜 (남성형)','glad (masculine)');
c('ru','여행',['Сколько','это','стоит?'],[0,2],'сколько стоит','이거 얼마예요?','How much does this cost?','얼마예요','how much does it cost');
c('ru','일상',['До','встречи!'],[0,1],'до встречи','다음에 봐요!','See you!','또 만나요','see you');
c('ru','카페·식당',['Приятного','аппетита!'],[0,1],'приятного аппетита','맛있게 드세요!','Enjoy your meal!','맛있게 드세요','enjoy your meal');

// ---------- Tiếng Việt ----------
c('vi','일상',['Tôi','sắp','đến','rồi.'],[1,2],'sắp đến','거의 다 왔어요.',"I'm almost there.",'곧 도착하다','about to arrive');
c('vi','카페·식당',['Cho','tôi','một ly','cà phê.'],[0,1],'cho tôi','커피 한 잔 주세요.','Can I have a coffee, please?','저에게 ~을 주세요','give me');
c('vi','카페·식당',['Tính tiền','giúp tôi.'],[0],'tính tiền','계산해 주세요.','The bill, please.','계산하다','to pay the bill');
c('vi','여행',['Nhà vệ sinh','ở đâu?'],[1],'ở đâu','화장실이 어디예요?','Where is the restroom?','어디에 있어요','where is it');
c('vi','일상',['Không','sao đâu.'],[0,1],'không sao','괜찮아요.',"It's okay.",'괜찮다','no problem');
c('vi','회사',['Chờ','tôi','một chút.'],[0,2],'chờ một chút','잠깐만 기다려 주세요.','Please wait a moment.','잠시 기다리다','wait a moment');
c('vi','감정',['Tôi','rất','vui.'],[2],'vui','정말 기뻐요.',"I'm very happy.",'기쁘다, 즐겁다','happy, glad');
c('vi','여행',['Cái này','bao nhiêu','tiền?'],[1,2],'bao nhiêu tiền','이거 얼마예요?','How much is this?','얼마예요','how much');
c('vi','일상',['Hẹn','gặp lại.'],[0,1],'hẹn gặp lại','또 만나요.','See you again.','다음에 또 봐요','see you again');
c('vi','감정',['Cảm ơn','nhiều.'],[0,1],'cảm ơn nhiều','정말 고마워요.','Thank you very much.','매우 감사합니다','thank you very much');

// ---------- Bahasa Indonesia ----------
c('id','일상',['Saya','hampir','sampai.'],[1,2],'hampir sampai','거의 다 왔어요.',"I'm almost there.",'거의 도착하다','almost arriving');
c('id','카페·식당',['Minta','tagihannya,','ya.'],[1],'tagihan','계산서 주세요.','The bill, please.','청구서, 계산서','bill');
c('id','카페·식당',['Satu','kopi','dibungkus,','ya.'],[2],'dibungkus','커피 한 잔 포장해 주세요.','One coffee to go, please.','포장하다 (bungkus)','to wrap / take away');
c('id','여행',['Di mana','toiletnya?'],[0],'di mana','화장실이 어디예요?','Where is the restroom?','어디에','where');
c('id','일상',['Tidak','apa-apa.'],[0,1],'tidak apa-apa','괜찮아요.',"It's okay.",'괜찮다','no problem');
c('id','회사',['Mohon','tunggu','sebentar.'],[1,2],'tunggu sebentar','잠시만 기다려 주세요.','Please wait a moment.','잠시 기다리다','wait a moment');
c('id','감정',['Saya','senang','sekali.'],[1,2],'senang sekali','정말 기뻐요.',"I'm very happy.",'매우 기쁘다','very happy');
c('id','여행',['Berapa','harganya?'],[0,1],'berapa harganya','얼마예요?','How much is it?','얼마예요','how much is it');
c('id','일상',['Sampai','jumpa','lagi.'],[0,1,2],'sampai jumpa lagi','또 만나요.','See you again.','또 만나요','see you again');
c('id','감정',['Terima','kasih','banyak.'],[0,1],'terima kasih','정말 감사합니다.','Thank you very much.','감사합니다','thank you');
