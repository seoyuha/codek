// =============================================================
//  CODE K 단원 데이터
//  - cards: 게임판에 나오는 카드 (id = 그림 파일 이름)
//  - tags : 이 카드와 연결되는 힌트 단어(hints의 w 값)
//  - q, a : 카드가 열릴 때 보여 주고 읽어 주는 문장
//  - hints: 힌트 담당이 고를 수 있는 영어 힌트 단어 (g = 묶음)
//  새 단원을 넣으려면 '11'과 같은 모양으로 '12' 등을 추가하세요.
// =============================================================
module.exports = {
  '11': {
    title: 'Lesson 11. Do You Know About Songpyeon?',
    hints: [
      { w: 'food', ko: '음식', g: '종류' }, { w: 'drink', ko: '마실 것', g: '종류' },
      { w: 'game', ko: '놀이', g: '종류' }, { w: 'sport', ko: '운동', g: '종류' },
      { w: 'music', ko: '음악', g: '종류' }, { w: 'dance', ko: '춤', g: '종류' },
      { w: 'clothes', ko: '옷', g: '종류' }, { w: 'house', ko: '집', g: '종류' },
      { w: 'art', ko: '공예', g: '종류' },
      { w: 'Chuseok', ko: '추석', g: '명절' }, { w: 'Seollal', ko: '설날', g: '명절' },
      { w: 'eat', ko: '먹다', g: '동작' }, { w: 'wear', ko: '입다·쓰다', g: '동작' },
      { w: 'play', ko: '놀다·연주하다', g: '동작' }, { w: 'throw', ko: '던지다', g: '동작' },
      { w: 'kick', ko: '차다', g: '동작' }, { w: 'jump', ko: '뛰다', g: '동작' },
      { w: 'fly', ko: '날리다', g: '동작' }, { w: 'spin', ko: '돌리다', g: '동작' },
      { w: 'make', ko: '만들다', g: '동작' }, { w: 'bow', ko: '절하다', g: '동작' },
      { w: 'sweet', ko: '달콤한', g: '특징' }, { w: 'spicy', ko: '매운', g: '특징' },
      { w: 'hot', ko: '뜨거운', g: '특징' }, { w: 'cold', ko: '차가운', g: '특징' },
      { w: 'round', ko: '둥근', g: '특징' }, { w: 'strong', ko: '힘센', g: '특징' },
      { w: 'red', ko: '빨간', g: '특징' },
      { w: 'rice', ko: '쌀', g: '재료·물건' }, { w: 'meat', ko: '고기', g: '재료·물건' },
      { w: 'noodles', ko: '국수', g: '재료·물건' }, { w: 'paper', ko: '종이', g: '재료·물건' },
      { w: 'wood', ko: '나무', g: '재료·물건' }, { w: 'stick', ko: '막대', g: '재료·물건' },
      { w: 'drum', ko: '북', g: '재료·물건' }, { w: 'hat', ko: '모자', g: '재료·물건' },
      { w: 'mask', ko: '탈', g: '재료·물건' }, { w: 'moon', ko: '달', g: '재료·물건' },
      { w: 'circle', ko: '원', g: '재료·물건' }, { w: 'wind', ko: '바람', g: '재료·물건' }
    ],
    cards: [
      { id: 'songpyeon', en: 'songpyeon', ko: '송편', tags: ['food', 'Chuseok', 'eat', 'rice', 'sweet', 'moon'], a: "It's a traditional Korean rice cake. People eat it on Chuseok." },
      { id: 'tteokguk', en: 'tteokguk', ko: '떡국', tags: ['food', 'Seollal', 'eat', 'rice', 'hot'], a: "It's rice cake soup. People eat it on Seollal." },
      { id: 'kimchi', en: 'kimchi', ko: '김치', tags: ['food', 'eat', 'spicy', 'red'], a: "It's a spicy Korean food. People eat it every day." },
      { id: 'bibimbap', en: 'bibimbap', ko: '비빔밥', tags: ['food', 'eat', 'rice', 'spicy', 'hot'], a: "It's rice with vegetables. People mix it and eat it." },
      { id: 'bulgogi', en: 'bulgogi', ko: '불고기', tags: ['food', 'eat', 'sweet', 'meat'], a: "It's sweet Korean meat. People eat it with rice." },
      { id: 'japchae', en: 'japchae', ko: '잡채', tags: ['food', 'eat', 'noodles'], a: "It's a Korean noodle dish. People eat it on holidays." },
      { id: 'yakgwa', en: 'yakgwa', ko: '약과', tags: ['food', 'eat', 'sweet', 'round'], a: "It's a sweet Korean cookie. People eat it on holidays." },
      { id: 'sikhye', en: 'sikhye', ko: '식혜', tags: ['drink', 'sweet', 'rice', 'cold'], a: "It's a sweet rice drink. People drink it cold." },
      { id: 'hanbok', en: 'hanbok', ko: '한복', tags: ['clothes', 'wear', 'Seollal', 'Chuseok'], a: "It's traditional Korean clothes. People wear it on holidays." },
      { id: 'gat', en: 'gat', ko: '갓', tags: ['hat', 'wear', 'clothes', 'round'], a: "It's a traditional Korean hat. Men wore it long ago." },
      { id: 'yunnori', en: 'yunnori', ko: '윷놀이', tags: ['game', 'play', 'stick', 'throw', 'Seollal'], a: "It's a traditional Korean board game. People play it on Seollal." },
      { id: 'tuho', en: 'tuho', ko: '투호', tags: ['game', 'play', 'throw', 'stick'], a: "It's a traditional Korean game. People throw sticks into a jar." },
      { id: 'jegichagi', en: 'jegichagi', ko: '제기차기', tags: ['game', 'play', 'kick', 'Seollal'], a: "It's a traditional Korean game. People kick a jegi." },
      { id: 'neolttwigi', en: 'neolttwigi', ko: '널뛰기', tags: ['game', 'play', 'jump', 'Seollal', 'wood'], a: "It's a traditional Korean game. People jump on a long board." },
      { id: 'yeonnalligi', en: 'yeonnalligi', ko: '연날리기', tags: ['game', 'play', 'fly', 'paper', 'wind', 'Seollal'], a: "It's kite flying. People fly kites on Seollal." },
      { id: 'paengichigi', en: 'paengichigi', ko: '팽이치기', tags: ['game', 'play', 'spin', 'wood', 'round'], a: "It's a traditional Korean game. People spin a top." },
      { id: 'ssireum', en: 'ssireum', ko: '씨름', tags: ['sport', 'strong', 'Chuseok'], a: "It's Korean wrestling. People do it on Chuseok." },
      { id: 'taekwondo', en: 'taekwondo', ko: '태권도', tags: ['sport', 'kick', 'strong'], a: "It's a Korean martial art. People kick and punch." },
      { id: 'ganggangsullae', en: 'ganggangsullae', ko: '강강술래', tags: ['dance', 'Chuseok', 'moon', 'circle'], a: "It's a traditional Korean dance. People dance in a circle on Chuseok." },
      { id: 'talchum', en: 'talchum', ko: '탈춤', tags: ['dance', 'mask', 'wear'], a: "It's a Korean mask dance. People wear masks and dance." },
      { id: 'samulnori', en: 'samulnori', ko: '사물놀이', tags: ['music', 'play', 'drum'], a: "It's Korean drum music. Four people play it together." },
      { id: 'gayageum', en: 'gayageum', ko: '가야금', tags: ['music', 'play', 'wood'], a: "It's a traditional Korean instrument. People play it with their fingers." },
      { id: 'janggu', en: 'janggu', ko: '장구', tags: ['music', 'play', 'drum', 'stick'], a: "It's a Korean drum. People play it with sticks." },
      { id: 'hanok', en: 'hanok', ko: '한옥', tags: ['house', 'wood'], a: "It's a traditional Korean house. It is made of wood." },
      { id: 'hanji', en: 'hanji', ko: '한지', tags: ['paper', 'art', 'make'], a: "It's traditional Korean paper. People make it from trees." },
      { id: 'buchae', en: 'buchae', ko: '부채', tags: ['art', 'paper', 'wind', 'make'], a: "It's a Korean fan. It makes a cool wind." },
      { id: 'sebae', en: 'sebae', ko: '세배', tags: ['Seollal', 'bow'], a: "It's a New Year's bow. Children bow on Seollal." },
      { id: 'bokjumeoni', en: 'bokjumeoni', ko: '복주머니', tags: ['Seollal', 'red', 'make'], a: "It's a lucky bag. People give it on Seollal." }
    ]
  }
};
