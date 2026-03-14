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
  chrome.alarms.create('checkAnniversary', { periodInMinutes: 10 }); // 생일/데뷔 체크 (1시간)
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
    const response = await fetch(CHZZK_API_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('Network response was not ok');

    const data = await response.json();
    if (!data || !data.content) return;

    const content = data.content;
    const currentStatus = content.status; // 'OPEN' or 'CLOSE'

    // 방송 정보 정리
    const liveTitle = (content.liveTitle || '방송이 시작되었습니다!').replace(
      /\n/g,
      ' ',
    );
    const liveCategory = content.liveCategoryValue || '방송';

    chrome.storage.local.get(['lastChzzkStatus'], (result) => {
      const lastStatus = result.lastChzzkStatus || 'CLOSE';

      // 방송이 꺼져있다가 켜진 경우에만 알림 발생
      if (lastStatus !== 'OPEN' && currentStatus === 'OPEN') {
        const notificationId = `chzzk-${Date.now()}`;

        chrome.notifications.create(notificationId, {
          type: 'basic', // 'image'에서 'basic'으로 변경
          iconUrl: 'icon.png', // 확장 프로그램 내부 아이콘 사용 (안전)
          title: `${MUSE_LIST[0].name} 방송 시작!`,
          message: `#${liveCategory} ${liveTitle}`, // 제목에 카테고리 포함
          priority: 2,
        });
      }

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
    const response = await fetch(YOUTUBE_RSS_URL(channel.id), {
      cache: 'no-store',
    });
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
        title: `🎬 유튜브 새 영상 업로드!`,
        message: vTitle || '새 영상이 올라왔어요.',
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
// [기능 3] 생일 및 데뷔일 알림
// ========================================================
function checkBirthdays() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const todayStr = `${currentYear}-${currentMonth}-${currentDay}`;

  chrome.storage.local.get(['birthdayLog'], (result) => {
    let log = result.birthdayLog || {};
    let needUpdate = false;

    MUSE_LIST.forEach((muse) => {
      if (muse.month === currentMonth && muse.day === currentDay) {
        if (log[muse.name] !== todayStr) {
          const age = currentYear - muse.year + 1; // 한국 나이 계산 (만 나이라면 +1 제거)
          chrome.notifications.create(`birthday-${muse.name}`, {
            type: 'basic',
            iconUrl: 'icon.png',
            title: `🎂 오늘은 ${muse.name}님 생일!`,
            message: `생일을 축하해주세요!`,
            priority: 2,
          });
          log[muse.name] = todayStr;
          needUpdate = true;
        }
      }
    });
    if (needUpdate) chrome.storage.local.set({ birthdayLog: log });
  });
}

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
  } else if (notiId.startsWith('youtube-')) {
    // 하이픈(-) 기준으로 나누되, youtube 접두사와 마지막 비디오 ID를 제외한 중간 부분이 채널 ID입니다.
    const parts = notiId.split('-');
    // youtube - 채널ID - 비디오ID 구조이므로,
    // 채널 ID에 하이픈이 포함되어 있어도 정확하게 추출할 수 있도록 합니다.
    const videoId = parts.pop(); // 마지막 요소 (비디오 ID) 추출
    const channelId = parts.slice(1).join('-'); // 'youtube' 제외하고 나머지를 다시 합침

    chrome.storage.local.get(['lastVideoLinkByChannel'], (r) => {
      const byChannel = r.lastVideoLinkByChannel || {};
      const link = byChannel[channelId];

      // 만약 저장된 링크가 없다면 기본 유튜브 링크라도 생성해서 이동
      const finalLink = link || `https://www.youtube.com/watch?v=${videoId}`;
      chrome.tabs.create({ url: finalLink });
    });
  }
});
