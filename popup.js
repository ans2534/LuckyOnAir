// background.js에 선언된 리스트와 동일한 데이터를 사용합니다.
const MUSE_LIST = [{ name: '러끼', year: 1995, month: 12, day: 30 }];

const MUSE_DEBUT_LIST = [{ name: '러끼', year: 2018, month: 7, day: 14 }];

function calculateDDay(month, day) {
  const now = new Date();
  const currentYear = now.getFullYear();
  let targetDate = new Date(currentYear, month - 1, day);

  // 이미 올해 생일/기념일이 지났다면 내년으로 설정
  if (
    now > targetDate &&
    (now.getDate() !== targetDate.getDate() ||
      now.getMonth() !== targetDate.getMonth())
  ) {
    targetDate.setFullYear(currentYear + 1);
  }

  const diff = targetDate - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (
    days === 0 ||
    (now.getDate() === targetDate.getDate() &&
      now.getMonth() === targetDate.getMonth())
  ) {
    return 'D-Day 🎉';
  }
  return `D-${days}`;
}

function calculatePassedDays(year, month, day) {
  const now = new Date();
  const debutDate = new Date(year, month - 1, day);
  const diff = now - debutDate;
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

document.addEventListener('DOMContentLoaded', () => {
  const listElement = document.getElementById('anniversary-list');
  let html = '';

  // 1. 생일 D-Day 표시
  MUSE_LIST.forEach((muse) => {
    const dday = calculateDDay(muse.month, muse.day);
    html += `
      <div class="item">
        <span class="name">🎂 ${muse.name}님 생일</span>
        <span class="dday">${dday}</span>
      </div>
    `;
  });

  // 2. 데뷔일 및 경과일 표시
  MUSE_DEBUT_LIST.forEach((muse) => {
    const passedDays = calculatePassedDays(muse.year, muse.month, muse.day);
    const dday = calculateDDay(muse.month, muse.day);
    html += `
      <div class="item">
        <span class="name">💎 ${muse.name}님 데뷔</span>
        <span class="dday">${dday}</span>
      </div>
      <div class="anniv" style="margin-top:-5px; margin-bottom:10px; text-align:right;">
        함께한 지 ${passedDays}일째
      </div>
    `;
  });

  listElement.innerHTML = html;
});
