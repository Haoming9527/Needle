export const products=[
 {id:'headphones',name:'Studio headphones',ko:'스튜디오 헤드폰',category:'Audio',image:'headphones',tags:'headphones audio 헤드폰 음악'},
 {id:'chair',name:'Everyday lounge chair',ko:'데일리 라운지 체어',category:'Home',image:'chair',tags:'chair home 의자 가구'},
 {id:'tent',name:'Weekend camping tent',ko:'위켄드 캠핑 텐트',category:'Outdoors',image:'tent',tags:'tent camping 텐트 캠핑'},
 {id:'laptop',name:'Lightweight laptop',ko:'라이트 노트북',category:'Work',image:'laptop',tags:'laptop computer 노트북 컴퓨터'}
];
const examples=[
 ['YouTube','Studio A','The everyday test','Comfortable and lightweight. Clear sound and noise cancelling made my commute easier. 편안하고 가벼운 헤드폰. 음질과 노이즈 캔슬링이 좋다.','편안한 일상 사용'],
 ['Shorts','Small details','A closer look','Beautiful minimal design. Sleek finish, but not affordable. 미니멀 디자인이 예쁘다. 저렴하지 않다.','디자인을 자세히'],
 ['Community','Everyday notes','After a month','Value for money and easy to use. Durable and sturdy after a month. 가성비가 좋고 간편하다. 튼튼한 마감.','한 달 사용 기록'],
 ['Reels','Carry light','Ready to go','Portable and easy to carry. Lightweight, convenient and comfortable. 휴대가 간편하고 가벼운 무게.','가볍게 떠나기']
];
export const records=products.flatMap(p=>examples.map((r,i)=>({id:p.id+'-'+i,productId:p.id,title:p.name+' · '+r[2],titleKo:p.ko+' · '+r[4],text:r[3],platform:r[0],creator:r[1],url:null,kind:'review',origin:'sample'})));
