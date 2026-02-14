// ========================================================
// [설정 1] 뮤즈(Muse) 정보 설정
// ========================================================
const MUSE_LIST = [{ name: '러끼', year: 1995, month: 12, day: 30 }];
const MUSE_DEBUT_LIST = [{ name: '러끼', year: 2018, month: 7, day: 14 }];

// ========================================================
// [설정 2] 외부 서비스 설정 (치지직, 유튜브)
// ========================================================

// 1. 치지직 (Chzzk) 설정
const CHZZK_CHANNEL_ID = '2708947b66f527fd74e6b3d6bcc1349b'; // 채널 ID
const CHZZK_API_URL = `https://api.chzzk.naver.com/service/v1/channels/${CHZZK_CHANNEL_ID}/live-detail`;
const CHZZK_LIVE_URL = `https://chzzk.naver.com/live/${CHZZK_CHANNEL_ID}`;

// 2. 유튜브 설정
const YOUTUBE_CHANNELS = [
  { id: 'UC_8GOc5dWX2Kpb74_nQ7vSQ', label: '본채널' },
  { id: 'UCWPyB55COIbbXG2UdXXAlig', label: '다시보기' },
];
const YOUTUBE_RSS_URL = (channelId) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

// ========================================================
// [시스템] 통합 알람 스케줄러 (설치 시 실행)
// ========================================================
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension Installed & Alarms Set');

  // 알람 생성 (주기적 실행)
  chrome.alarms.create('checkChzzkLive', { periodInMinutes: 1 }); // 치지직 체크 (1분)
  chrome.alarms.create('checkYoutube', { periodInMinutes: 1 }); // 유튜브 체크 (1분)
  chrome.alarms.create('checkAnniversary', { periodInMinutes: 60 }); // 생일/데뷔 체크 (1시간)
});

// 알람 발생 시 해당 기능 실행
chrome.alarms.onAlarm.addListener((alarm) => {
  switch (alarm.name) {
    case 'checkChzzkLive':
      checkChzzkStream();
      break;
    case 'checkYoutube':
      checkNewVideos();
      break;
    case 'checkNaverCafe':
      checkNaverCafe();
      break;
    case 'checkAnniversary':
      checkBirthdays();
      checkDebutDays();
      break;
  }
});

// ========================================================
// [기능 1] 치지직 (Chzzk) 방송 알림
// ========================================================
async function checkChzzkStream() {
  try {
    const response = await fetch(CHZZK_API_URL);
    const data = await response.json();

    // 데이터 유효성 검사
    if (!data || !data.content) return;

    const content = data.content;
    const currentStatus = content.status; // 'OPEN' or 'CLOSE'

    // 방송 제목 (없으면 기본 멘트), 줄바꿈 제거
    const liveTitle = (content.liveTitle || '방송이 시작되었습니다!').replace(
      /\n/g,
      ' ',
    );
    const liveCategory = content.liveCategoryValue || '방송';

    chrome.storage.local.get(['lastChzzkStatus'], (result) => {
      const lastStatus = result.lastChzzkStatus || 'CLOSE';

      // 방송이 'CLOSE'였다가 'OPEN'으로 바뀌었을 때만 알림 발송
      if (lastStatus !== 'OPEN' && currentStatus === 'OPEN') {
        const notificationId = `chzzk-${Date.now()}`;

        chrome.notifications.create(notificationId, {
          type: 'basic',
          iconUrl: 'icon.png',
          title: `📢 치지직 방송 시작! [${liveCategory}]`,
          message: liveTitle,
          priority: 2,
        });
      }

      // 현재 상태 저장
      chrome.storage.local.set({ lastChzzkStatus: currentStatus });
    });
  } catch (error) {
    console.error('Chzzk Check Error:', error);
  }
}

// ========================================================
// [기능 2] 유튜브 새 영상 체크
// ========================================================
function checkNewVideos() {
  YOUTUBE_CHANNELS.forEach((channel) => {
    checkNewVideoForChannel(channel);
  });
}

async function checkNewVideoForChannel(channel) {
  try {
    const response = await fetch(YOUTUBE_RSS_URL(channel.id));
    const text = await response.text();

    const entryMatch = text.match(/<entry>([\s\S]*?)<\/entry>/);
    if (!entryMatch) return;

    const entryBlock = entryMatch[1];
    const vid = entryBlock.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
    const vTitle = entryBlock.match(/<title>(.*?)<\/title>/)?.[1];
    const vLink = entryBlock.match(/<link rel="alternate" href="(.*?)"/)?.[1];

    if (!vid) return;

    const result = await chrome.storage.local.get([
      'lastVideoByChannel',
      'lastVideoLinkByChannel',
    ]);
    const lastVideoByChannel = result.lastVideoByChannel || {};
    const lastVideoLinkByChannel = result.lastVideoLinkByChannel || {};

    if (lastVideoByChannel[channel.id] !== vid) {
      chrome.notifications.create(`youtube-${channel.id}-${vid}`, {
        type: 'basic',
        iconUrl: 'icon.png',
        title: `유튜브 새 영상! (${channel.label})`,
        message: vTitle || '제목 없음',
        priority: 2,
      });

      lastVideoByChannel[channel.id] = vid;
      lastVideoLinkByChannel[channel.id] = vLink;

      await chrome.storage.local.set({
        lastVideoByChannel,
        lastVideoLinkByChannel,
      });
    }
  } catch (e) {
    console.error('YouTube Check Error:', e);
  }
}

// ========================================================
// [기능 3] 생일 알림
// ========================================================
function checkBirthdays() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  chrome.storage.local.get(['birthdayLog'], (result) => {
    let log = result.birthdayLog || {};
    let needUpdate = false;

    MUSE_LIST.forEach((muse) => {
      if (muse.month === currentMonth && muse.day === currentDay) {
        if (log[muse.name] !== currentYear) {
          const age = currentYear - muse.year + 1;
          chrome.notifications.create(`birthday-${muse.name}`, {
            type: 'basic',
            iconUrl: 'icon.png',
            title: `🎂 오늘은 ${muse.name}님 생일!`,
            message: `${age}번째 생일을 축하해주세요!`,
            priority: 2,
          });
          log[muse.name] = currentYear;
          needUpdate = true;
        }
      }
    });
    if (needUpdate) chrome.storage.local.set({ birthdayLog: log });
  });
}

// ========================================================
// [기능 4] 데뷔일 알림
// ========================================================
function checkDebutDays() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const currentYear = now.getFullYear();
  const todayStr = `${currentYear}-${now.getMonth() + 1}-${now.getDate()}`;

  chrome.storage.local.get(['debutLog'], (result) => {
    let log = result.debutLog || {};
    let needUpdate = false;

    MUSE_DEBUT_LIST.forEach((muse) => {
      const debutDate = new Date(muse.year, muse.month - 1, muse.day);
      debutDate.setHours(0, 0, 0, 0);
      const dayCount =
        Math.floor((now - debutDate) / (1000 * 60 * 60 * 24)) + 1;

      const isAnniversaryDate =
        muse.month === now.getMonth() + 1 && muse.day === now.getDate();
      const isSpecialDay = dayCount > 0 && dayCount % 100 === 0;

      if ((isAnniversaryDate || isSpecialDay) && log[muse.name] !== todayStr) {
        const titleMsg = isAnniversaryDate
          ? `🎉 ${muse.name} 님 데뷔 ${currentYear - muse.year}주년!`
          : `🎉 ${muse.name} 님 데뷔 ${dayCount}일!`;
        chrome.notifications.create(`debut-${muse.name}-${dayCount}`, {
          type: 'basic',
          iconUrl: 'icon.png',
          title: titleMsg,
          message: `함께한 지 ${dayCount}일째 되는 날입니다.`,
          priority: 2,
        });
        log[muse.name] = todayStr;
        needUpdate = true;
      }
    });
    if (needUpdate) chrome.storage.local.set({ debutLog: log });
  });
}

// ========================================================
// [공통] 알림 클릭 시 페이지 이동
// ========================================================
chrome.notifications.onClicked.addListener((notiId) => {
  if (notiId.startsWith('chzzk-')) {
    chrome.tabs.create({ url: CHZZK_LIVE_URL });
  } else if (notiId.startsWith('cafe-')) {
    chrome.storage.local.get(['lastCafeLink'], (r) => {
      if (r.lastCafeLink) chrome.tabs.create({ url: r.lastCafeLink });
    });
  } else if (notiId.startsWith('youtube-')) {
    const channelMatch = notiId.match(/^youtube-([^-]+)-/);
    const channelId = channelMatch?.[1];
    chrome.storage.local.get(
      ['lastVideoLinkByChannel', 'lastVideoLink'],
      (r) => {
        const byChannel = r.lastVideoLinkByChannel || {};
        const link = channelId ? byChannel[channelId] : r.lastVideoLink;
        if (link) chrome.tabs.create({ url: link });
      },
    );
  }
});
